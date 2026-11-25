const express = require('express');
const router = express.Router();
const { authentifier, exigerRole } = require('../middleware/auth');
const ctrl = require('../controllers/conventionController');

router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Identifiant invalide.' }
    });
  }
  next();
});

// Affectation de l'encadrant académique par l'administration
router.patch('/:id/encadrant', authentifier, exigerRole('admin', 'responsable'), ctrl.affecterEncadrant);

module.exports = router;