const db = require('../config/db');

/**
 * GET /api/conventions/options
 * Données du formulaire de convention : entreprises d'accueil disposant d'un compte tuteur,
 * et (admin / responsable) liste des encadrants possibles.
 */
const options = async (req, res, next) => {
  try {
    const entreprises = await db.query(
      `SELECT id, raison_sociale, utilisateur_id AS tuteur_id
       FROM entreprises WHERE utilisateur_id IS NOT NULL
       ORDER BY raison_sociale`
    );

    let encadrants = [];
    if (['admin', 'responsable'].includes(req.utilisateur.role)) {
      const r = await db.query(
        `SELECT u.id, u.prenom || ' ' || u.nom AS nom
         FROM utilisateurs u JOIN roles ro ON ro.id = u.role_id
         WHERE ro.nom = 'responsable' ORDER BY u.nom, u.prenom`
      );
      encadrants = r.rows;
    }

    res.status(200).json({ success: true, data: { entreprises: entreprises.rows, encadrants } });
  } catch (err) { next(err); }
};

module.exports = { options };