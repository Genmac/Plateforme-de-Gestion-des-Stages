const db = require('../config/db');
const { notifier } = require('../services/notificationService');

const ROLES_ADMIN = ['admin', 'responsable'];
const CHAMPS_STAGE = [
  'entreprise_id', 'tuteur_id', 'origine', 'sujet', 'missions',
  'gratification', 'date_debut', 'date_fin', 'candidature_id'
];
const ORIGINES = ['initiative_etudiant', 'envoi_departement', 'demande_entreprise'];
const OBLIGATOIRES = ['entreprise_id', 'tuteur_id', 'sujet', 'missions', 'gratification', 'date_debut', 'date_fin'];
const STATUTS_EDITABLES = ['brouillon', 'a_corriger'];
const DECISIONS = ['validee', 'refusee', 'a_corriger'];
const MOTIF_OBLIGATOIRE = ['refusee', 'a_corriger'];

const estAdmin = (req) => ROLES_ADMIN.includes(req.utilisateur.role);

const erreurMetier = (statusCode, code, message, extra = {}) =>
  Object.assign(new Error(message), { statusCode, code, ...extra });

// Une notification qui échoue ne doit jamais bloquer l'action principale
const notifierSansBloquer = async (...args) => {
  try { await notifier(...args); } catch (e) { /* déjà loggé par le service */ }
};

const enTransaction = async (fn) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const resultat = await fn(client);
    await client.query('COMMIT');
    return resultat;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ---------------------------------------------------------------------------
// Requêtes de base
// ---------------------------------------------------------------------------
const SELECT_CONVENTION = `
  SELECT c.id, c.stage_id, c.statut, c.motif, c.soumise_le, c.created_at, c.updated_at,
         s.etudiant_id, s.entreprise_id, s.tuteur_id, s.encadrant_id, s.candidature_id,
         s.origine, s.sujet, s.missions, s.gratification, s.date_debut, s.date_fin,
         s.statut AS statut_stage,
         e.raison_sociale AS entreprise,
         et.prenom || ' ' || et.nom AS etudiant,
         tu.prenom || ' ' || tu.nom AS tuteur,
         en.prenom || ' ' || en.nom AS encadrant
  FROM conventions c
  JOIN stages s ON s.id = c.stage_id
  LEFT JOIN entreprises e ON e.id = s.entreprise_id
  LEFT JOIN utilisateurs et ON et.id = s.etudiant_id
  LEFT JOIN utilisateurs tu ON tu.id = s.tuteur_id
  LEFT JOIN utilisateurs en ON en.id = s.encadrant_id`;

// Filtre de visibilité selon le rôle (renvoie { clause, params })
const filtreVisibilite = (req, debutParam = 1) => {
  const u = req.utilisateur;
  if (estAdmin(req) && u.role === 'admin') return { clause: '', params: [] };
  if (u.role === 'etudiant') return { clause: `s.etudiant_id = $${debutParam}`, params: [u.id] };
  if (u.role === 'entreprise') return { clause: `s.tuteur_id = $${debutParam}`, params: [u.id] };
  if (u.role === 'responsable') return { clause: `s.encadrant_id = $${debutParam}`, params: [u.id] };
  return { clause: 'FALSE', params: [] };
};

const chargerConvention = async (req, id) => {
  const f = filtreVisibilite(req, 2);
  const r = await db.query(
    `${SELECT_CONVENTION} WHERE c.id = $1 ${f.clause ? 'AND ' + f.clause : ''}`,
    [id, ...f.params]
  );
  return r.rows[0] || null;
};

// ---------------------------------------------------------------------------
// Validation des champs du stage
// ---------------------------------------------------------------------------
const estVide = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

// Contrôle de forme (appliqué aussi aux brouillons) ; ne vérifie PAS les champs obligatoires
const verifierFormat = (d) => {
  for (const cle of ['entreprise_id', 'tuteur_id', 'candidature_id']) {
    if (!estVide(d[cle]) && !(Number.isInteger(Number(d[cle])) && Number(d[cle]) > 0)) {
      throw erreurMetier(400, 'VALIDATION_ERROR', `${cle} invalide.`);
    }
  }
  if (!estVide(d.origine) && !ORIGINES.includes(d.origine)) {
    throw erreurMetier(400, 'VALIDATION_ERROR', `origine invalide. Valeurs : ${ORIGINES.join(', ')}.`);
  }
  if (!estVide(d.gratification) && !(Number(d.gratification) >= 0)) {
    throw erreurMetier(400, 'VALIDATION_ERROR', 'gratification invalide (nombre positif attendu).');
  }
  for (const cle of ['date_debut', 'date_fin']) {
    if (!estVide(d[cle]) && (!/^\d{4}-\d{2}-\d{2}$/.test(d[cle]) || isNaN(new Date(d[cle])))) {
      throw erreurMetier(400, 'VALIDATION_ERROR', `${cle} invalide (format AAAA-MM-JJ).`);
    }
  }
  if (!estVide(d.date_debut) && !estVide(d.date_fin) && !(d.date_fin > d.date_debut)) {
    throw erreurMetier(400, 'INVALID_DATES', 'La date de fin doit être postérieure à la date de début.');
  }
};

// Vérifie que l'entreprise existe, et que le tuteur est bien un utilisateur « entreprise »
const verifierReferences = async (client, d) => {
  if (!estVide(d.entreprise_id)) {
    const e = await client.query('SELECT 1 FROM entreprises WHERE id = $1', [d.entreprise_id]);
    if (e.rows.length === 0) throw erreurMetier(422, 'ENTREPRISE_NOT_FOUND', 'Entreprise introuvable.');
  }
  if (!estVide(d.tuteur_id)) {
    const t = await client.query(
      `SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND r.nom = 'entreprise'`, [d.tuteur_id]);
    if (t.rows.length === 0) {
      throw erreurMetier(422, 'INVALID_TUTOR', 'Le tuteur doit être un utilisateur de rôle « entreprise ».');
    }
  }
};

// Garde uniquement les champs autorisés, en convertissant les chaînes vides en null
const extraire = (corps) => {
  const d = {};
  for (const cle of CHAMPS_STAGE) {
    if (corps[cle] !== undefined) d[cle] = estVide(corps[cle]) ? null : corps[cle];
  }
  return d;
};

// ---------------------------------------------------------------------------
// GET /api/conventions
// ---------------------------------------------------------------------------
const lister = async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    const f = filtreVisibilite(req, 1);
    if (f.clause) { where.push(f.clause); params.push(...f.params); }

    // ?a_traiter=true : conventions en attente de décision (encadrant / admin)
    if (req.query.a_traiter === 'true') where.push(`c.statut = 'soumise'`);
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`c.statut = $${params.length}`);
    }

    const r = await db.query(
      `${SELECT_CONVENTION} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY c.updated_at DESC`, params);
    res.status(200).json({ success: true, data: r.rows });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// GET /api/conventions/:id  (avec historique)
// ---------------------------------------------------------------------------
const detail = async (req, res, next) => {
  try {
    const c = await chargerConvention(req, req.params.id);
    // 404 (et non 403) pour ne pas révéler l'existence d'une convention d'autrui
    if (!c) throw erreurMetier(404, 'CONVENTION_NOT_FOUND', 'Convention introuvable.');
    const h = await db.query(
      `SELECT h.ancien_statut, h.nouveau_statut, h.commentaire, h.change_le, h.change_par,
              u.prenom || ' ' || u.nom AS auteur
       FROM convention_historique h
       LEFT JOIN utilisateurs u ON u.id = h.change_par
       WHERE h.convention_id = $1 ORDER BY h.change_le, h.id`, [c.id]);
    res.status(200).json({ success: true, data: { ...c, historique: h.rows } });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// POST /api/conventions  (étudiant) : crée le stage et la convention en brouillon
// ---------------------------------------------------------------------------
const creer = async (req, res, next) => {
  try {
    const d = extraire(req.body);
    verifierFormat(d);

    const convention = await enTransaction(async (client) => {
      // Verrou sur l'étudiant : sérialise les créations simultanées
      await client.query('SELECT id FROM utilisateurs WHERE id = $1 FOR UPDATE', [req.utilisateur.id]);

      const actif = await client.query(
        `SELECT 1 FROM stages WHERE etudiant_id = $1 AND statut = 'actif'`, [req.utilisateur.id]);
      if (actif.rows.length > 0) {
        throw erreurMetier(409, 'ACTIVE_STAGE_EXISTS', 'Vous avez déjà un stage actif.');
      }
      await verifierReferences(client, d);

      const s = await client.query(
        `INSERT INTO stages (etudiant_id, entreprise_id, tuteur_id, candidature_id, origine,
                             sujet, missions, gratification, date_debut, date_fin)
         VALUES ($1,$2,$3,$4,COALESCE($5,'initiative_etudiant'),$6,$7,$8,$9,$10)
         RETURNING id`,
        [req.utilisateur.id, d.entreprise_id || null, d.tuteur_id || null, d.candidature_id || null,
         d.origine || null, d.sujet || null, d.missions || null, d.gratification ?? null,
         d.date_debut || null, d.date_fin || null]
      );
      const c = await client.query(
        `INSERT INTO conventions (stage_id) VALUES ($1) RETURNING id`, [s.rows[0].id]);
      await client.query(
        `INSERT INTO convention_historique (convention_id, ancien_statut, nouveau_statut, change_par, commentaire)
         VALUES ($1, NULL, 'brouillon', $2, 'Création du brouillon')`,
        [c.rows[0].id, req.utilisateur.id]);
      return c.rows[0].id;
    });

    const complet = await chargerConvention(req, convention);
    res.status(201).json({ success: true, data: complet });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// PUT /api/conventions/:id  (étudiant propriétaire) : modifie / reprend un brouillon
// ---------------------------------------------------------------------------
const modifier = async (req, res, next) => {
  try {
    const d = extraire(req.body);
    verifierFormat(d);

    await enTransaction(async (client) => {
      const cur = await client.query(
        `SELECT c.id, c.stage_id, c.statut,
                s.date_debut, s.date_fin
         FROM conventions c JOIN stages s ON s.id = c.stage_id
         WHERE c.id = $1 AND s.etudiant_id = $2 FOR UPDATE OF c`,
        [req.params.id, req.utilisateur.id]);
      const c = cur.rows[0];
      if (!c) throw erreurMetier(404, 'CONVENTION_NOT_FOUND', 'Convention introuvable.');
      if (!STATUTS_EDITABLES.includes(c.statut)) {
        throw erreurMetier(409, 'LOCKED', `Une convention « ${c.statut} » ne peut plus être modifiée.`);
      }

      // Cohérence des dates avec celles déjà enregistrées (modification partielle)
      const iso = (v) => (v instanceof Date ? v.toLocaleDateString('en-CA') : v);
      const debut = d.date_debut !== undefined ? d.date_debut : iso(c.date_debut);
      const fin = d.date_fin !== undefined ? d.date_fin : iso(c.date_fin);
      if (debut && fin && !(fin > debut)) {
        throw erreurMetier(400, 'INVALID_DATES', 'La date de fin doit être postérieure à la date de début.');
      }
      await verifierReferences(client, d);

      const cles = Object.keys(d);
      if (cles.length > 0) {
        const sets = cles.map((cle, i) => `${cle} = $${i + 1}`);
        await client.query(
          `UPDATE stages SET ${sets.join(', ')}, updated_at = now() WHERE id = $${cles.length + 1}`,
          [...cles.map((cle) => d[cle]), c.stage_id]);
        await client.query('UPDATE conventions SET updated_at = now() WHERE id = $1', [c.id]);
      }
    });

    const complet = await chargerConvention(req, req.params.id);
    res.status(200).json({ success: true, data: complet });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// POST /api/conventions/:id/soumettre  (étudiant propriétaire)
// ---------------------------------------------------------------------------
const soumettre = async (req, res, next) => {
  try {
    const resultat = await enTransaction(async (client) => {
      const cur = await client.query(
        `SELECT c.id, c.statut, s.etudiant_id, s.tuteur_id, s.encadrant_id,
                s.entreprise_id, s.sujet, s.missions, s.gratification, s.date_debut, s.date_fin
         FROM conventions c JOIN stages s ON s.id = c.stage_id
         WHERE c.id = $1 AND s.etudiant_id = $2 FOR UPDATE OF c`,
        [req.params.id, req.utilisateur.id]);
      const c = cur.rows[0];
      if (!c) throw erreurMetier(404, 'CONVENTION_NOT_FOUND', 'Convention introuvable.');
      if (!STATUTS_EDITABLES.includes(c.statut)) {
        throw erreurMetier(409, 'LOCKED', `Une convention « ${c.statut} » ne peut pas être soumise.`);
      }

      // Champs obligatoires : vérifiés seulement ici
      const manquants = OBLIGATOIRES.filter((cle) => estVide(c[cle]));
      if (manquants.length > 0) {
        throw erreurMetier(422, 'INCOMPLETE',
          `Convention incomplète. Champs manquants : ${manquants.join(', ')}.`, { manquants });
      }

      await client.query(
        `UPDATE conventions SET statut = 'soumise', motif = NULL, soumise_le = now(), updated_at = now()
         WHERE id = $1`, [c.id]);
      await client.query(
        `INSERT INTO convention_historique (convention_id, ancien_statut, nouveau_statut, change_par, commentaire)
         VALUES ($1, $2, 'soumise', $3, 'Soumission de la convention')`,
        [c.id, c.statut, req.utilisateur.id]);
      return c;
    });

    // Notifications (hors transaction) : tuteur et encadrant, sinon administrateurs
    const message = `Une convention a été soumise par ${req.utilisateur.prenom} ${req.utilisateur.nom}.`;
    const lien = `/conventions/${resultat.id}`;
    const destinataires = [resultat.tuteur_id, resultat.encadrant_id].filter(Boolean);
    if (!resultat.encadrant_id) {
      const admins = await db.query(
        `SELECT u.id FROM utilisateurs u JOIN roles r ON r.id = u.role_id WHERE r.nom IN ('admin','responsable')`);
      admins.rows.forEach((a) => destinataires.push(a.id));
    }
    for (const id of new Set(destinataires)) await notifierSansBloquer(id, message, lien);

    const complet = await chargerConvention(req, resultat.id);
    res.status(200).json({ success: true, data: complet });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// PATCH /api/conventions/:id/decision  (encadrant du stage ou administration)
// Corps : { decision: 'validee' | 'refusee' | 'a_corriger', motif }
// ---------------------------------------------------------------------------
const decider = async (req, res, next) => {
  try {
    const decision = req.body.decision;
    const motif = (req.body.motif || '').trim();
    if (!DECISIONS.includes(decision)) {
      throw erreurMetier(400, 'VALIDATION_ERROR', `Décision invalide. Valeurs : ${DECISIONS.join(', ')}.`);
    }
    if (MOTIF_OBLIGATOIRE.includes(decision) && !motif) {
      throw erreurMetier(400, 'MOTIF_REQUIRED', 'Un motif est obligatoire pour un refus ou une demande de correction.');
    }

    const c = await enTransaction(async (client) => {
      const cur = await client.query(
        `SELECT c.id, c.statut, s.etudiant_id, s.encadrant_id
         FROM conventions c JOIN stages s ON s.id = c.stage_id
         WHERE c.id = $1 FOR UPDATE OF c`, [req.params.id]);
      const conv = cur.rows[0];

      // L'encadrant ne peut agir que sur ses propres stages ; l'admin sur tous
      const autorise = conv && (req.utilisateur.role === 'admin' || conv.encadrant_id === req.utilisateur.id);
      if (!autorise) throw erreurMetier(404, 'CONVENTION_NOT_FOUND', 'Convention introuvable.');

      if (conv.statut !== 'soumise') {
        throw erreurMetier(409, 'NOT_SUBMITTED', 'Seule une convention « soumise » peut être validée ou refusée.');
      }

      await client.query(
        `UPDATE conventions SET statut = $1, motif = $2, updated_at = now() WHERE id = $3`,
        [decision, motif || null, conv.id]);
      await client.query(
        `INSERT INTO convention_historique (convention_id, ancien_statut, nouveau_statut, change_par, commentaire)
         VALUES ($1, 'soumise', $2, $3, $4)`,
        [conv.id, decision, req.utilisateur.id, motif || null]);
      return conv;
    });

    const libelles = { validee: 'validée', refusee: 'refusée', a_corriger: 'à corriger' };
    await notifierSansBloquer(
      c.etudiant_id,
      `Votre convention a été ${libelles[decision]}${motif ? ` : ${motif}` : '.'}`,
      `/conventions/${c.id}`);

    const complet = await chargerConvention(req, c.id);
    res.status(200).json({ success: true, data: complet });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// PATCH /api/stages/:id/encadrant  (admin / responsable)
// Corps : { encadrant_id }
// ---------------------------------------------------------------------------
const affecterEncadrant = async (req, res, next) => {
  try {
    const encadrantId = Number(req.body.encadrant_id);
    if (!Number.isInteger(encadrantId) || encadrantId <= 0) {
      throw erreurMetier(400, 'VALIDATION_ERROR', 'encadrant_id est obligatoire.');
    }
    const u = await db.query(
      `SELECT u.id, u.prenom, u.nom FROM utilisateurs u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND r.nom = 'responsable'`, [encadrantId]);
    if (u.rows.length === 0) {
      throw erreurMetier(422, 'INVALID_SUPERVISOR', 'L\'encadrant doit être un utilisateur de rôle « responsable ».');
    }

    const r = await db.query(
      `UPDATE stages SET encadrant_id = $1, updated_at = now() WHERE id = $2
       RETURNING id, etudiant_id, encadrant_id`, [encadrantId, req.params.id]);
    if (r.rows.length === 0) throw erreurMetier(404, 'STAGE_NOT_FOUND', 'Stage introuvable.');

    await notifierSansBloquer(encadrantId,
      'Un stage vous a été affecté pour le suivi pédagogique.', `/stages/${r.rows[0].id}`);
    await notifierSansBloquer(r.rows[0].etudiant_id,
      `Votre encadrant académique est ${u.rows[0].prenom} ${u.rows[0].nom}.`, `/stages/${r.rows[0].id}`);

    res.status(200).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
};

module.exports = {
  lister, detail, creer, modifier, soumettre, decider, affecterEncadrant
};