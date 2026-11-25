const express = require('express');
const router = express.Router();
const { authentifier, exigerRole } = require('../middleware/auth');
const ctrl = require('../controllers/conventionController');

const lecteurs = exigerRole('etudiant', 'entreprise', 'responsable', 'admin');
const etudiants = exigerRole('etudiant');
const decideurs = exigerRole('responsable', 'admin');

// Refuse proprement un identifiant non numérique (évite une erreur SQL 500)
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
router.post('/', authentifier, etudiants, ctrl.creer);
router.put('/:id', authentifier, etudiants, ctrl.modifier);
router.post('/:id/soumettre', authentifier, etudiants, ctrl.soumettre);
router.patch('/:id/decision', authentifier, decideurs, ctrl.decider);

module.exports = router;