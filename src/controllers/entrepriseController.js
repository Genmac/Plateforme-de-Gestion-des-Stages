const db = require('../config/db');
const { notifier } = require('../services/notificationService');

const ROLES_ADMIN = ['admin', 'responsable'];
const COLONNES = `id, raison_sociale, secteur_activite, adresse, contact_nom,
  contact_email, contact_telephone, site_web, statut, proposee_par, created_at`;

const erreur = (res, status, code, message, extra = {}) =>
  res.status(status).json({ success: false, error: { code, message, ...extra } });

const estAdmin = (req) => ROLES_ADMIN.includes(req.utilisateur.role);

// Une notification qui échoue ne doit jamais bloquer l'action principale
const notifierSansBloquer = async (...args) => {
  try { await notifier(...args); } catch (e) { /* déjà loggé par le service */ }
};

// GET /api/entreprises?q=nom&statut=a_valider
const lister = async (req, res, next) => {
  try {
    const { q, statut } = req.query;
    const params = [];
    const where = [];

    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      where.push(`raison_sociale ILIKE $${params.length}`);
    }

    if (estAdmin(req)) {
      if (statut) {
        params.push(statut);
        where.push(`statut = $${params.length}`);
      }
    } else {
      // Étudiant : entreprises validées + ses propres propositions
      params.push(req.utilisateur.id);
      where.push(`(statut = 'validee' OR proposee_par = $${params.length})`);
    }

    const sql = `SELECT ${COLONNES} FROM entreprises
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY raison_sociale`;
    const result = await db.query(sql, params);
    res.status(200).json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// GET /api/entreprises/:id
const detail = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT ${COLONNES} FROM entreprises WHERE id = $1`, [req.params.id]
    );
    const e = result.rows[0];
    const visible = e && (estAdmin(req) || e.statut === 'validee' || e.proposee_par === req.utilisateur.id);
    if (!visible) return erreur(res, 404, 'ENTREPRISE_NOT_FOUND', 'Entreprise introuvable.');
    res.status(200).json({ success: true, data: e });
  } catch (err) { next(err); }
};

// POST /api/entreprises
const creer = async (req, res, next) => {
  try {
    const { secteur_activite, adresse, contact_nom, contact_email,
            contact_telephone, site_web, confirmer_doublon } = req.body;
    const raison_sociale = (req.body.raison_sociale || '').trim();

    if (!raison_sociale) {
      return erreur(res, 400, 'VALIDATION_ERROR', 'Le nom de l\'entreprise est obligatoire.');
    }

    // Alerte de doublon (même nom, sans tenir compte de la casse)
    const doublons = await db.query(
      `SELECT id, raison_sociale, statut FROM entreprises WHERE lower(raison_sociale) = lower($1)`,
      [raison_sociale]
    );
    if (doublons.rows.length > 0 && confirmer_doublon !== true) {
      return erreur(res, 409, 'DUPLICATE_WARNING',
        'Une entreprise portant ce nom existe déjà. Confirmez pour la créer quand même.',
        { doublons: doublons.rows });
    }

    const admin = estAdmin(req);
    const result = await db.query(
      `INSERT INTO entreprises (raison_sociale, secteur_activite, adresse, contact_nom,
         contact_email, contact_telephone, site_web, statut, proposee_par)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${COLONNES}`,
      [raison_sociale, secteur_activite, adresse, contact_nom, contact_email,
       contact_telephone, site_web, admin ? 'validee' : 'a_valider', req.utilisateur.id]
    );
    const entreprise = result.rows[0];

    // Proposition d'un étudiant : prévenir l'administration
    if (!admin) {
      const staff = await db.query(
        `SELECT u.id FROM utilisateurs u JOIN roles r ON u.role_id = r.id
         WHERE r.nom = ANY($1)`, [ROLES_ADMIN]
      );
      for (const s of staff.rows) {
        await notifierSansBloquer(
          s.id,
          `Nouvelle entreprise proposée à valider : ${raison_sociale}`,
          `/entreprises/${entreprise.id}`
        );
      }
    }

    res.status(201).json({ success: true, data: entreprise });
  } catch (err) { next(err); }
};

// PUT /api/entreprises/:id  (admin / responsable)
const modifier = async (req, res, next) => {
  try {
    const b = req.body;
    const result = await db.query(
      `UPDATE entreprises SET
         raison_sociale    = COALESCE($1, raison_sociale),
         secteur_activite  = COALESCE($2, secteur_activite),
         adresse           = COALESCE($3, adresse),
         contact_nom       = COALESCE($4, contact_nom),
         contact_email     = COALESCE($5, contact_email),
         contact_telephone = COALESCE($6, contact_telephone),
         site_web          = COALESCE($7, site_web)
       WHERE id = $8
       RETURNING ${COLONNES}`,
      [b.raison_sociale?.trim() || null, b.secteur_activite, b.adresse, b.contact_nom,
       b.contact_email, b.contact_telephone, b.site_web, req.params.id]
    );
    if (result.rows.length === 0) {
      return erreur(res, 404, 'ENTREPRISE_NOT_FOUND', 'Entreprise introuvable.');
    }
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// Fabrique les handlers valider / rejeter (même logique, statut différent)
const changerStatut = (nouveauStatut, verbe) => async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE entreprises SET statut = $1
       WHERE id = $2 AND statut = 'a_valider'
       RETURNING ${COLONNES}`,
      [nouveauStatut, req.params.id]
    );
    if (result.rows.length === 0) {
      return erreur(res, 409, 'NOT_PENDING',
        'Entreprise introuvable ou déjà traitée (seules les propositions « à valider » peuvent être traitées).');
    }
    const e = result.rows[0];
    if (e.proposee_par && e.proposee_par !== req.utilisateur.id) {
      await notifierSansBloquer(e.proposee_par,
        `Votre proposition « ${e.raison_sociale} » a été ${verbe}.`, `/entreprises/${e.id}`);
    }
    res.status(200).json({ success: true, data: e });
  } catch (err) { next(err); }
};

module.exports = {
  lister, detail, creer, modifier,
  valider: changerStatut('validee', 'validée'),
  rejeter: changerStatut('rejetee', 'rejetée')
};