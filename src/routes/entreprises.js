const express = require('express');
const router = express.Router();
const { authentifier, exigerRole } = require('../middleware/auth');
const ctrl = require('../controllers/entrepriseController');

const lecteurs = exigerRole('admin', 'responsable', 'etudiant');
const admins = exigerRole('admin', 'responsable');

// Refuse proprement un :id non numérique (évite une erreur SQL 500)
router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Identifiant invalide.' }
    });
  }
  next();
});

router.get('/', authentifier, lecteurs, ctrl.lister);
router.get('/:id', authentifier, lecteurs, ctrl.detail);
router.post('/', authentifier, lecteurs, ctrl.creer);
router.put('/:id', authentifier, admins, ctrl.modifier);
router.patch('/:id/valider', authentifier, admins, ctrl.valider);
router.patch('/:id/rejeter', authentifier, admins, ctrl.rejeter);

module.exports = router;