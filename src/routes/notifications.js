const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authentifier } = require('../middleware/auth');

/**
 * GET /api/notifications
 * Liste toutes les notifications de l'utilisateur connecté.
 */
router.get('/', authentifier, async (req, res, next) => {
  try {
    const utilisateurId = req.utilisateur.id;

    const result = await db.query(
      `SELECT id, message, lien, lu, created_at 
       FROM notifications 
       WHERE utilisateur_id = $1 
       ORDER BY created_at DESC`,
      [utilisateurId]
    );

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/:id/lire
 * Marque une notification spécifique comme lue.
 */
router.patch('/:id/lire', authentifier, async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const utilisateurId = req.utilisateur.id;

    const result = await db.query(
      `UPDATE notifications 
       SET lu = TRUE 
       WHERE id = $1 AND utilisateur_id = $2 
       RETURNING id, message, lien, lu, created_at`,
      [notificationId, utilisateurId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification introuvable ou non autorisée.' }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marquée comme lue.',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;