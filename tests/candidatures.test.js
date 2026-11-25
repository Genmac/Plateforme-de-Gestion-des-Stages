// Tests d'intégration : entreprises et candidatures (issue #18)
// Lancer avec : npm test

process.env.NODE_ENV = 'development';
process.env.DEV_AUTH = 'true';
process.env.PORT = '0'; // port libre : pas de conflit avec « npm run dev »

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

const app = require('../src/server');
const db = require('../src/config/db');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const PREFIXE = 'TEST-AUTO';
const NOM_ENTREPRISE = `${PREFIXE}-Entreprise-${Date.now()}`;
const EMAIL_AUTRE = `${PREFIXE.toLowerCase()}.autre.${Date.now()}@test.local`;

const ADMIN = '1';
const ETUDIANT = '3';
let autreEtudiant;   // id (en chaîne) du second étudiant créé pour les tests
let entrepriseId;
let candidatureId;

const PDF_VALIDE = Buffer.from('%PDF-1.4\n%%EOF');
const FAUX_PDF = Buffer.from('Ceci est du texte, pas un PDF.');

const api = {
  get: (url, user) => request(app).get(url).set('x-dev-user', user),
  post: (url, user) => request(app).post(url).set('x-dev-user', user),
  patch: (url, user) => request(app).patch(url).set('x-dev-user', user)
};

const deposer = (id, user, type, buffer, filename, contentType) =>
  api.post(`/api/candidatures/${id}/documents`, user)
    .field('type', type)
    .attach('fichier', buffer, { filename, contentType });

before(async () => {
  // Second étudiant, pour tester l'isolation des données
  const u = await db.query(
    `INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role_id)
     VALUES ('Test', 'Autre', $1, 'inutilise', (SELECT id FROM roles WHERE nom = 'etudiant'))
     RETURNING id`,
    [EMAIL_AUTRE]
  );
  autreEtudiant = String(u.rows[0].id);

  // Entreprise validée (créée par l'admin) sur laquelle on candidate
  const e = await api.post('/api/entreprises', ADMIN)
    .send({ raison_sociale: NOM_ENTREPRISE, secteur_activite: 'Test' });
  assert.equal(e.status, 201, 'préparation : création de l\'entreprise');
  entrepriseId = e.body.data.id;

  const c = await api.post('/api/candidatures', ETUDIANT)
    .send({ entreprise_id: entrepriseId, poste: `${PREFIXE} poste`, contact: 'RH' });
  assert.equal(c.status, 201, 'préparation : création de la candidature');
  candidatureId = c.body.data.id;
});

after(async () => {
  // Fichiers déposés pendant les tests
  const docs = await db.query(
    `SELECT d.chemin FROM candidature_documents d
     JOIN candidatures c ON c.id = d.candidature_id
     JOIN entreprises e ON e.id = c.entreprise_id
     WHERE e.raison_sociale LIKE $1`,
    [`${PREFIXE}%`]
  );
  for (const d of docs.rows) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(d.chemin))); } catch (e) { /* absent */ }
  }

  // Données (ordre imposé par les clés étrangères)
  await db.query(
    `DELETE FROM candidatures WHERE entreprise_id IN
       (SELECT id FROM entreprises WHERE raison_sociale LIKE $1)`,
    [`${PREFIXE}%`]
  );
  await db.query(`DELETE FROM entreprises WHERE raison_sociale LIKE $1`, [`${PREFIXE}%`]);
  await db.query(`DELETE FROM notifications WHERE message LIKE $1`, [`%${PREFIXE}%`]);
  if (autreEtudiant) await db.query('DELETE FROM utilisateurs WHERE id = $1', [autreEtudiant]);
});

describe('Entreprises : alerte de doublon', () => {
  test('même nom (casse différente) -> 409 DUPLICATE_WARNING avec la liste des doublons', async () => {
    const res = await api.post('/api/entreprises', ETUDIANT)
      .send({ raison_sociale: NOM_ENTREPRISE.toLowerCase() });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'DUPLICATE_WARNING');
    assert.ok(res.body.error.doublons.length >= 1);
  });

  test('avec confirmer_doublon -> 201, statut « a_valider » pour un étudiant', async () => {
    const res = await api.post('/api/entreprises', ETUDIANT)
      .send({ raison_sociale: NOM_ENTREPRISE, confirmer_doublon: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.statut, 'a_valider');
  });

  test('un étudiant ne peut pas valider une entreprise -> 403', async () => {
    const res = await api.patch(`/api/entreprises/${entrepriseId}/valider`, ETUDIANT);
    assert.equal(res.status, 403);
  });
});

describe('Candidatures : règles de création', () => {
  test('entreprise non validée -> 422 ENTREPRISE_NOT_VALIDATED', async () => {
    const proposee = await db.query(
      `SELECT id FROM entreprises WHERE raison_sociale = $1 AND statut = 'a_valider' LIMIT 1`,
      [NOM_ENTREPRISE]
    );
    assert.ok(proposee.rows.length > 0, 'une entreprise « a_valider » doit exister (test précédent)');
    const res = await api.post('/api/candidatures', ETUDIANT)
      .send({ entreprise_id: proposee.rows[0].id, poste: `${PREFIXE} poste` });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'ENTREPRISE_NOT_VALIDATED');
  });

  test('l\'admin ne peut pas créer de candidature -> 403', async () => {
    const res = await api.post('/api/candidatures', ADMIN)
      .send({ entreprise_id: entrepriseId, poste: 'x' });
    assert.equal(res.status, 403);
  });
});

describe('Documents : fichier refusé (type ou taille)', () => {
  test('type MIME non autorisé -> 400 INVALID_FILE_TYPE', async () => {
    const res = await deposer(candidatureId, ETUDIANT, 'cv', FAUX_PDF, 'note.txt', 'text/plain');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_FILE_TYPE');
  });

  test('faux PDF (contenu ≠ type déclaré) -> 400 INVALID_FILE_CONTENT', async () => {
    const res = await deposer(candidatureId, ETUDIANT, 'cv', FAUX_PDF, 'faux.pdf', 'application/pdf');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_FILE_CONTENT');
  });

  test('fichier de plus de 10 Mo -> 413 FILE_TOO_LARGE', async () => {
    const gros = Buffer.concat([PDF_VALIDE, Buffer.alloc(11 * 1024 * 1024)]);
    const res = await deposer(candidatureId, ETUDIANT, 'cv', gros, 'gros.pdf', 'application/pdf');
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, 'FILE_TOO_LARGE');
  });

  test('type de document inconnu -> 400 VALIDATION_ERROR', async () => {
    const res = await deposer(candidatureId, ETUDIANT, 'autre', PDF_VALIDE, 'ok.pdf', 'application/pdf');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('aucun fichier refusé ne reste sur le disque', async () => {
    const avant = fs.readdirSync(UPLOADS_DIR).length;
    await deposer(candidatureId, ETUDIANT, 'cv', FAUX_PDF, 'faux.pdf', 'application/pdf');
    await deposer(candidatureId, ETUDIANT, 'cv', FAUX_PDF, 'note.txt', 'text/plain');
    assert.equal(fs.readdirSync(UPLOADS_DIR).length, avant);
  });
});

describe('« acceptée » exige une preuve d\'acceptation', () => {
  test('sans preuve -> 422 PROOF_REQUIRED, statut inchangé', async () => {
    const res = await api.patch(`/api/candidatures/${candidatureId}/statut`, ETUDIANT)
      .send({ statut: 'acceptee' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'PROOF_REQUIRED');

    const detail = await api.get(`/api/candidatures/${candidatureId}`, ETUDIANT);
    assert.equal(detail.body.data.statut, 'envoyee');
  });

  test('statut invalide -> 400 VALIDATION_ERROR', async () => {
    const res = await api.patch(`/api/candidatures/${candidatureId}/statut`, ETUDIANT)
      .send({ statut: 'inconnu' });
    assert.equal(res.status, 400);
  });

  test('avec preuve déposée -> 200 et historique daté complet', async () => {
    const depot = await deposer(candidatureId, ETUDIANT, 'preuve_acceptation',
      PDF_VALIDE, 'preuve.pdf', 'application/pdf');
    assert.equal(depot.status, 201);

    const res = await api.patch(`/api/candidatures/${candidatureId}/statut`, ETUDIANT)
      .send({ statut: 'acceptee' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.statut, 'acceptee');

    const detail = await api.get(`/api/candidatures/${candidatureId}`, ETUDIANT);
    const h = detail.body.data.historique;
    assert.equal(h.length, 2);
    assert.equal(h[0].ancien_statut, null);
    assert.equal(h[0].nouveau_statut, 'envoyee');
    assert.equal(h[1].ancien_statut, 'envoyee');
    assert.equal(h[1].nouveau_statut, 'acceptee');
    assert.ok(h[1].change_le);
  });
});

describe('Isolation : un étudiant ne voit que ses propres données', () => {
  test('le détail d\'une candidature d\'autrui -> 404', async () => {
    const res = await api.get(`/api/candidatures/${candidatureId}`, autreEtudiant);
    assert.equal(res.status, 404);
  });

  test('la liste de l\'autre étudiant ne contient pas cette candidature', async () => {
    const res = await api.get('/api/candidatures', autreEtudiant);
    assert.equal(res.status, 200);
    assert.ok(!res.body.data.some((c) => c.id === candidatureId));
  });

  test('changer le statut d\'une candidature d\'autrui -> 404', async () => {
    const res = await api.patch(`/api/candidatures/${candidatureId}/statut`, autreEtudiant)
      .send({ statut: 'retiree' });
    assert.equal(res.status, 404);
  });

  test('déposer un document sur la candidature d\'autrui -> 404', async () => {
    const res = await deposer(candidatureId, autreEtudiant, 'cv', PDF_VALIDE, 'cv.pdf', 'application/pdf');
    assert.equal(res.status, 404);
  });

  test('télécharger le document d\'autrui -> 404 ; le propriétaire et l\'admin -> 200', async () => {
    const detail = await api.get(`/api/candidatures/${candidatureId}`, ETUDIANT);
    const doc = detail.body.data.documents[0];
    assert.ok(doc, 'un document doit exister (test précédent)');
    const url = `/api/candidatures/${candidatureId}/documents/${doc.id}`;

    assert.equal((await api.get(url, autreEtudiant)).status, 404);
    assert.equal((await api.get(url, ETUDIANT)).status, 200);
    assert.equal((await api.get(url, ADMIN)).status, 200);
  });

  test('l\'admin voit toutes les candidatures, y compris celle-ci', async () => {
    const res = await api.get('/api/candidatures', ADMIN);
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some((c) => c.id === candidatureId));
  });
});