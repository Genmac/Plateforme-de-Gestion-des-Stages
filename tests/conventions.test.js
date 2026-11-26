// Tests d'intégration : stages et conventions (issue #16)
// Lancer avec : npm test

process.env.NODE_ENV = 'development';
process.env.DEV_AUTH = 'true';
process.env.PORT = '0'; // port libre : pas de conflit avec « npm run dev »

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/server');
const db = require('../src/config/db');

const MARQUEUR = 'TESTAUTO';
const HORODATAGE = Date.now();
const ADMIN = '1';

let etudiant;      // id (chaîne) de l'étudiant principal
let autreEtudiant; // second étudiant, pour tester l'isolation
let tuteur;        // utilisateur de rôle « entreprise »
let encadrant;     // utilisateur de rôle « responsable »
let entrepriseId;
let conventionId;
let stageId;

const api = {
  get: (url, user) => request(app).get(url).set('x-dev-user', user),
  post: (url, user) => request(app).post(url).set('x-dev-user', user),
  put: (url, user) => request(app).put(url).set('x-dev-user', user),
  patch: (url, user) => request(app).patch(url).set('x-dev-user', user)
};

const creerUtilisateur = async (prenom, nom, role) => {
  const r = await db.query(
    `INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role_id)
     VALUES ($1, $2, $3, 'inutilise', (SELECT id FROM roles WHERE nom = $4))
     RETURNING id`,
    [nom, prenom, `${MARQUEUR.toLowerCase()}.${role}.${nom.toLowerCase()}.${HORODATAGE}@test.local`, role]
  );
  return String(r.rows[0].id);
};

before(async () => {
  etudiant = await creerUtilisateur(MARQUEUR, 'Etudiant', 'etudiant');
  autreEtudiant = await creerUtilisateur(MARQUEUR, 'Autre', 'etudiant');
  tuteur = await creerUtilisateur(MARQUEUR, 'Tuteur', 'entreprise');
  encadrant = await creerUtilisateur(MARQUEUR, 'Encadrant', 'responsable');

  const e = await db.query(
    `INSERT INTO entreprises (utilisateur_id, raison_sociale) VALUES ($1, $2) RETURNING id`,
    [tuteur, `${MARQUEUR}-Entreprise-${HORODATAGE}`]
  );
  entrepriseId = e.rows[0].id;
});

after(async () => {
  // Notifications reçues par les vrais administrateurs lors des soumissions
  await db.query('DELETE FROM notifications WHERE message LIKE $1', [`%${MARQUEUR}%`]);
  // Supprimer les comptes nettoie tout en cascade (stages, conventions, historique, entreprise)
  await db.query('DELETE FROM utilisateurs WHERE id = ANY($1::int[])',
    [[etudiant, autreEtudiant, tuteur, encadrant].filter(Boolean).map(Number)]);
});

describe('Brouillon : champs obligatoires vérifiés seulement à la soumission', () => {
  test('brouillon incomplet accepté -> 201, statut « brouillon »', async () => {
    const res = await api.post('/api/conventions', etudiant).send({ sujet: `${MARQUEUR} sujet` });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.statut, 'brouillon');
    assert.equal(res.body.data.missions, null);
    conventionId = res.body.data.id;
    stageId = res.body.data.stage_id;
  });

  test('second stage actif refusé -> 409 ACTIVE_STAGE_EXISTS', async () => {
    const res = await api.post('/api/conventions', etudiant).send({ sujet: 'Deuxième stage' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'ACTIVE_STAGE_EXISTS');
  });

  test('date de fin avant la date de début -> 400 INVALID_DATES', async () => {
    const res = await api.put(`/api/conventions/${conventionId}`, etudiant)
      .send({ date_debut: '2027-05-01', date_fin: '2027-04-01' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_DATES');
  });

  test('origine inconnue -> 400 VALIDATION_ERROR', async () => {
    const res = await api.put(`/api/conventions/${conventionId}`, etudiant).send({ origine: 'inconnue' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('soumission incomplète refusée -> 422 INCOMPLETE avec la liste des champs manquants', async () => {
    const res = await api.post(`/api/conventions/${conventionId}/soumettre`, etudiant);
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'INCOMPLETE');
    assert.ok(res.body.error.manquants.includes('missions'));
    assert.ok(res.body.error.manquants.includes('date_debut'));
  });

  test('tuteur qui n\'est pas de rôle « entreprise » -> 422 INVALID_TUTOR', async () => {
    const res = await api.put(`/api/conventions/${conventionId}`, etudiant).send({ tuteur_id: Number(autreEtudiant) });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'INVALID_TUTOR');
  });

  test('compléter le brouillon -> 200', async () => {
    const res = await api.put(`/api/conventions/${conventionId}`, etudiant).send({
      entreprise_id: entrepriseId,
      tuteur_id: Number(tuteur),
      missions: 'Développement d\'une application de suivi.',
      gratification: 60000,
      date_debut: '2027-02-01',
      date_fin: '2027-07-31'
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.statut, 'brouillon');
    assert.equal(Number(res.body.data.gratification), 60000);
  });
});

describe('Soumission, décision et affectation de l\'encadrant', () => {
  test('soumettre -> 200, statut « soumise »', async () => {
    const res = await api.post(`/api/conventions/${conventionId}/soumettre`, etudiant);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.statut, 'soumise');
    assert.ok(res.body.data.soumise_le);
  });

  test('le tuteur est notifié de la soumission', async () => {
    const r = await db.query(
      `SELECT 1 FROM notifications WHERE utilisateur_id = $1 AND message LIKE '%soumise%'`, [tuteur]);
    assert.ok(r.rows.length >= 1);
  });

  test('modifier une convention soumise -> 409 LOCKED', async () => {
    const res = await api.put(`/api/conventions/${conventionId}`, etudiant).send({ sujet: 'Changement' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'LOCKED');
  });

  test('refus sans motif -> 400 MOTIF_REQUIRED, statut inchangé', async () => {
    const res = await api.patch(`/api/conventions/${conventionId}/decision`, ADMIN).send({ decision: 'refusee' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'MOTIF_REQUIRED');

    const detail = await api.get(`/api/conventions/${conventionId}`, etudiant);
    assert.equal(detail.body.data.statut, 'soumise');
  });

  test('correction sans motif -> 400 MOTIF_REQUIRED', async () => {
    const res = await api.patch(`/api/conventions/${conventionId}/decision`, ADMIN).send({ decision: 'a_corriger' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'MOTIF_REQUIRED');
  });

  test('un encadrant non affecté à ce stage ne peut pas décider -> 404', async () => {
    const res = await api.patch(`/api/conventions/${conventionId}/decision`, encadrant)
      .send({ decision: 'validee' });
    assert.equal(res.status, 404);
  });

  test('un étudiant ne peut pas décider -> 403', async () => {
    const res = await api.patch(`/api/conventions/${conventionId}/decision`, etudiant)
      .send({ decision: 'validee' });
    assert.equal(res.status, 403);
  });

  test('un étudiant ne peut pas affecter un encadrant -> 403', async () => {
    const res = await api.patch(`/api/stages/${stageId}/encadrant`, etudiant)
      .send({ encadrant_id: Number(encadrant) });
    assert.equal(res.status, 403);
  });

  test('encadrant qui n\'est pas « responsable » -> 422 INVALID_SUPERVISOR', async () => {
    const res = await api.patch(`/api/stages/${stageId}/encadrant`, ADMIN)
      .send({ encadrant_id: Number(autreEtudiant) });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'INVALID_SUPERVISOR');
  });

  test('l\'administration affecte l\'encadrant -> 200', async () => {
    const res = await api.patch(`/api/stages/${stageId}/encadrant`, ADMIN)
      .send({ encadrant_id: Number(encadrant) });
    assert.equal(res.status, 200);
    assert.equal(String(res.body.data.encadrant_id), encadrant);
  });

  test('l\'encadrant demande une correction avec motif -> 200, « a_corriger »', async () => {
    const res = await api.patch(`/api/conventions/${conventionId}/decision`, encadrant)
      .send({ decision: 'a_corriger', motif: 'Préciser les missions.' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.statut, 'a_corriger');
    assert.equal(res.body.data.motif, 'Préciser les missions.');
  });

  test('l\'étudiant reprend sa convention puis la soumet à nouveau -> 200', async () => {
    const maj = await api.put(`/api/conventions/${conventionId}`, etudiant)
      .send({ missions: 'Missions précisées : analyse, développement, tests.' });
    assert.equal(maj.status, 200);

    const res = await api.post(`/api/conventions/${conventionId}/soumettre`, etudiant);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.statut, 'soumise');
    assert.equal(res.body.data.motif, null);
  });

  test('l\'encadrant valide -> 200, « validee »', async () => {
    const res = await api.patch(`/api/conventions/${conventionId}/decision`, encadrant)
      .send({ decision: 'validee' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.statut, 'validee');
  });

  test('décider sur une convention déjà validée -> 409 NOT_SUBMITTED', async () => {
    const res = await api.patch(`/api/conventions/${conventionId}/decision`, ADMIN)
      .send({ decision: 'refusee', motif: 'Trop tard' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'NOT_SUBMITTED');
  });
});

describe('Isolation et historique', () => {
  test('la convention d\'un autre étudiant est inaccessible -> 404', async () => {
    const res = await api.get(`/api/conventions/${conventionId}`, autreEtudiant);
    assert.equal(res.status, 404);
  });

  test('la liste de l\'autre étudiant ne contient pas cette convention', async () => {
    const res = await api.get('/api/conventions', autreEtudiant);
    assert.equal(res.status, 200);
    assert.ok(!res.body.data.some((c) => c.id === conventionId));
  });

  test('l\'autre étudiant ne peut ni modifier ni soumettre -> 404', async () => {
    const modif = await api.put(`/api/conventions/${conventionId}`, autreEtudiant).send({ sujet: 'x' });
    assert.equal(modif.status, 404);
    const soum = await api.post(`/api/conventions/${conventionId}/soumettre`, autreEtudiant);
    assert.equal(soum.status, 404);
  });

  test('le tuteur désigné la voit mais ne peut pas la modifier', async () => {
    const lecture = await api.get(`/api/conventions/${conventionId}`, tuteur);
    assert.equal(lecture.status, 200);
    const ecriture = await api.put(`/api/conventions/${conventionId}`, tuteur).send({ sujet: 'x' });
    assert.equal(ecriture.status, 403);
  });

  test('l\'administration voit la convention dans la liste', async () => {
    const res = await api.get('/api/conventions', ADMIN);
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some((c) => c.id === conventionId));
  });

  test('l\'historique montre chaque étape avec son auteur', async () => {
    const res = await api.get(`/api/conventions/${conventionId}`, etudiant);
    const h = res.body.data.historique;
    const etapes = h.map((l) => `${l.ancien_statut}>${l.nouveau_statut}`);
    assert.deepEqual(etapes, [
      'null>brouillon',
      'brouillon>soumise',
      'soumise>a_corriger',
      'a_corriger>soumise',
      'soumise>validee'
    ]);
    assert.equal(h[2].commentaire, 'Préciser les missions.');
    assert.ok(h.every((l) => l.change_le && l.auteur));
  });
});