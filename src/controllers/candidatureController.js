const path = require('path');
const db = require('../config/db');
const upload = require('../middleware/upload');
const { detecterMime, supprimerFichier } = require('../services/fichierService');

const STATUTS = ['envoyee', 'en_attente', 'entretien', 'acceptee', 'refusee', 'retiree'];
const STATUTS_FINAUX = ['refusee', 'retiree']; // aucune sortie possible (à ajuster si besoin)
const ROLES_ADMIN = ['admin', 'responsable'];
const TYPES_DOC = ['cv', 'lettre', 'preuve_acceptation'];
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const estAdmin = (req) => ROLES_ADMIN.includes(req.utilisateur.role);

// Erreur métier : récupérée par le middleware centralisé (statusCode + code)
const erreurMetier = (statusCode, code, message) =>
  Object.assign(new Error(message), { statusCode, code });

// Exécute fn(client) dans une transaction (COMMIT si OK, ROLLBACK si erreur)
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

const SELECT_CANDIDATURE = `
  SELECT c.id, c.etudiant_id, c.entreprise_id, e.raison_sociale AS entreprise,
         c.poste, c.contact, c.date_candidature, c.statut, c.created_at
  FROM candidatures c
  JOIN entreprises e ON e.id = c.entreprise_id`;

// ---------------------------------------------------------------------------
// GET /api/candidatures
// Étudiant : ses candidatures uniquement. Admin / responsable : toutes.
// ---------------------------------------------------------------------------
const lister = async (req, res, next) => {
  try {
    const params = [];
    let where = '';
    if (!estAdmin(req)) {
      params.push(req.utilisateur.id);
      where = 'WHERE c.etudiant_id = $1';
    }
    const result = await db.query(
      `${SELECT_CANDIDATURE} ${where} ORDER BY c.created_at DESC`,
      params
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// GET /api/candidatures/:id  (avec historique et documents)
// ---------------------------------------------------------------------------
const detail = async (req, res, next) => {
  try {
    const result = await db.query(`${SELECT_CANDIDATURE} WHERE c.id = $1`, [req.params.id]);
    const c = result.rows[0];
    // 404 (et non 403) pour ne pas révéler l'existence d'une candidature d'autrui
    if (!c || (!estAdmin(req) && c.etudiant_id !== req.utilisateur.id)) {
      throw erreurMetier(404, 'CANDIDATURE_NOT_FOUND', 'Candidature introuvable.');
    }
    const historique = await db.query(
      `SELECT ancien_statut, nouveau_statut, change_par, change_le
       FROM candidature_historique
       WHERE candidature_id = $1
       ORDER BY change_le, id`,
      [c.id]
    );
    const documents = await db.query(
      `SELECT id, type, nom_original, mime_type, taille, depose_le
       FROM candidature_documents
       WHERE candidature_id = $1
       ORDER BY depose_le`,
      [c.id]
    );
    res.status(200).json({
      success: true,
      data: { ...c, historique: historique.rows, documents: documents.rows }
    });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// POST /api/candidatures  (étudiant)
// ---------------------------------------------------------------------------
const creer = async (req, res, next) => {
  try {
    const entrepriseId = Number(req.body.entreprise_id);
    const poste = (req.body.poste || '').trim();
    const contact = req.body.contact || null;
    const date = req.body.date_candidature || null;

    if (!Number.isInteger(entrepriseId) || entrepriseId <= 0 || !poste) {
      throw erreurMetier(400, 'VALIDATION_ERROR', 'entreprise_id et poste sont obligatoires.');
    }
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date)))) {
      throw erreurMetier(400, 'VALIDATION_ERROR', 'date_candidature invalide (format AAAA-MM-JJ).');
    }

    const candidature = await enTransaction(async (client) => {
      const ent = await client.query('SELECT statut FROM entreprises WHERE id = $1', [entrepriseId]);
      if (ent.rows.length === 0) {
        throw erreurMetier(404, 'ENTREPRISE_NOT_FOUND', 'Entreprise introuvable.');
      }
      if (ent.rows[0].statut !== 'validee') {
        throw erreurMetier(422, 'ENTREPRISE_NOT_VALIDATED',
          'On ne peut candidater qu\'à une entreprise validée par l\'administration.');
      }

      const ins = await client.query(
        `INSERT INTO candidatures (etudiant_id, entreprise_id, poste, contact, date_candidature)
         VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE))
         RETURNING id, etudiant_id, entreprise_id, poste, contact, date_candidature, statut, created_at`,
        [req.utilisateur.id, entrepriseId, poste, contact, date]
      );
      const c = ins.rows[0];
      await client.query(
        `INSERT INTO candidature_historique (candidature_id, ancien_statut, nouveau_statut, change_par)
         VALUES ($1, NULL, $2, $3)`,
        [c.id, c.statut, req.utilisateur.id]
      );
      return c;
    });

    res.status(201).json({ success: true, data: candidature });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// PATCH /api/candidatures/:id/statut  (étudiant propriétaire)
// ---------------------------------------------------------------------------
const changerStatut = async (req, res, next) => {
  try {
    const nouveau = req.body.statut;
    if (!STATUTS.includes(nouveau)) {
      throw erreurMetier(400, 'VALIDATION_ERROR', `Statut invalide. Valeurs : ${STATUTS.join(', ')}.`);
    }

    const candidature = await enTransaction(async (client) => {
      // Verrou : empêche deux changements simultanés de contourner la règle
      const cur = await client.query(
        'SELECT id, statut FROM candidatures WHERE id = $1 AND etudiant_id = $2 FOR UPDATE',
        [req.params.id, req.utilisateur.id]
      );
      if (cur.rows.length === 0) {
        throw erreurMetier(404, 'CANDIDATURE_NOT_FOUND', 'Candidature introuvable.');
      }
      const ancien = cur.rows[0].statut;

      if (ancien === nouveau) {
        throw erreurMetier(409, 'SAME_STATUS', 'La candidature a déjà ce statut.');
      }
      if (STATUTS_FINAUX.includes(ancien)) {
        throw erreurMetier(409, 'FINAL_STATUS',
          `Une candidature « ${ancien} » ne peut plus changer de statut.`);
      }

      // Règle du ticket : pas de « acceptée » sans preuve d'acceptation
      if (nouveau === 'acceptee') {
        const preuve = await client.query(
          `SELECT 1 FROM candidature_documents
           WHERE candidature_id = $1 AND type = 'preuve_acceptation' LIMIT 1`,
          [req.params.id]
        );
        if (preuve.rows.length === 0) {
          throw erreurMetier(422, 'PROOF_REQUIRED',
            'Impossible de passer à « acceptée » sans preuve d\'acceptation déposée.');
        }
      }

      const upd = await client.query(
        `UPDATE candidatures SET statut = $1 WHERE id = $2
         RETURNING id, etudiant_id, entreprise_id, poste, contact, date_candidature, statut, created_at`,
        [nouveau, req.params.id]
      );
      await client.query(
        `INSERT INTO candidature_historique (candidature_id, ancien_statut, nouveau_statut, change_par)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, ancien, nouveau, req.utilisateur.id]
      );
      return upd.rows[0];
    });

    res.status(200).json({ success: true, data: candidature });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// POST /api/candidatures/:id/documents  (étudiant propriétaire)
// Enchaînement : verifierProprietaire -> recevoirFichier -> televerser
// ---------------------------------------------------------------------------

// 1) Vérifie le propriétaire AVANT d'écrire quoi que ce soit sur le disque
const verifierProprietaire = async (req, res, next) => {
  try {
    const r = await db.query(
      'SELECT statut FROM candidatures WHERE id = $1 AND etudiant_id = $2',
      [req.params.id, req.utilisateur.id]
    );
    if (r.rows.length === 0) {
      throw erreurMetier(404, 'CANDIDATURE_NOT_FOUND', 'Candidature introuvable.');
    }
    if (STATUTS_FINAUX.includes(r.rows[0].statut)) {
      throw erreurMetier(409, 'FINAL_STATUS', 'Cette candidature est clôturée : dépôt impossible.');
    }
    next();
  } catch (err) { next(err); }
};

// 2) Reçoit le fichier (champ « fichier ») et convertit les erreurs Multer en 4xx
const recevoirFichier = (req, res, next) => {
  upload.single('fichier')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(erreurMetier(413, 'FILE_TOO_LARGE', 'Fichier trop volumineux (10 Mo maximum).'));
    }
    if (err.name === 'MulterError') {
      return next(erreurMetier(400, 'UPLOAD_ERROR', err.message));
    }
    if (err.code) return next(err); // erreur système (ex : dossier uploads/ absent) -> 500
    return next(erreurMetier(400, 'INVALID_FILE_TYPE', err.message)); // refus du fileFilter
  });
};

// 3) Contrôle le contenu réel, puis enregistre (un seul document par type : le nouveau remplace l'ancien)
const televerser = async (req, res, next) => {
  const fichier = req.file;
  try {
    if (!fichier) {
      throw erreurMetier(400, 'NO_FILE', 'Aucun fichier reçu (champ « fichier »).');
    }
    const type = req.body.type;
    if (!TYPES_DOC.includes(type)) {
      throw erreurMetier(400, 'VALIDATION_ERROR',
        `Type de document invalide. Valeurs : ${TYPES_DOC.join(', ')}.`);
    }

    const mimeReel = await detecterMime(fichier.path);
    if (mimeReel !== fichier.mimetype) {
      throw erreurMetier(400, 'INVALID_FILE_CONTENT',
        'Le contenu du fichier ne correspond pas à son type déclaré.');
    }

    // Multer décode le nom en latin1 : on le remet en UTF-8 pour garder les accents
    const nom = Buffer.from(fichier.originalname, 'latin1').toString('utf8').slice(0, 255);

    const { doc, anciens } = await enTransaction(async (client) => {
      const old = await client.query(
        'DELETE FROM candidature_documents WHERE candidature_id = $1 AND type = $2 RETURNING chemin',
        [req.params.id, type]
      );
      const ins = await client.query(
        `INSERT INTO candidature_documents (candidature_id, type, nom_original, chemin, mime_type, taille)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, type, nom_original, mime_type, taille, depose_le`,
        [req.params.id, type, nom, `uploads/${fichier.filename}`, mimeReel, fichier.size]
      );
      return { doc: ins.rows[0], anciens: old.rows };
    });

    // Nettoyage des fichiers remplacés (après le commit)
    for (const a of anciens) {
      await supprimerFichier(path.join(UPLOADS_DIR, path.basename(a.chemin)));
    }
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    if (fichier) await supprimerFichier(fichier.path); // aucun fichier refusé ne reste sur le disque
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/candidatures/:id/documents/:docId : téléchargement protégé
// ---------------------------------------------------------------------------
const telecharger = async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT d.nom_original, d.chemin, c.etudiant_id
       FROM candidature_documents d
       JOIN candidatures c ON c.id = d.candidature_id
       WHERE d.id = $1 AND d.candidature_id = $2`,
      [req.params.docId, req.params.id]
    );
    const d = r.rows[0];
    if (!d || (!estAdmin(req) && d.etudiant_id !== req.utilisateur.id)) {
      throw erreurMetier(404, 'DOCUMENT_NOT_FOUND', 'Document introuvable.');
    }
    // basename : on ne fait jamais confiance à un chemin stocké pour sortir de uploads/
    res.download(path.join(UPLOADS_DIR, path.basename(d.chemin)), d.nom_original, (err) => {
      if (err && !res.headersSent) {
        next(erreurMetier(404, 'FILE_MISSING', 'Fichier introuvable sur le serveur.'));
      }
    });
  } catch (err) { next(err); }
};

module.exports = {
  lister, detail, creer, changerStatut,
  verifierProprietaire, recevoirFichier, televerser, telecharger
};