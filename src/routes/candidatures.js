const express = require('express');
const router = express.Router();
const { authentifier, exigerRole } = require('../middleware/auth');
const ctrl = require('../controllers/candidatureController');

const lecteurs = exigerRole('etudiant', 'admin', 'responsable');
const etudiants = exigerRole('etudiant');

// Refuse proprement un identifiant non numérique (évite une erreur SQL 500)
const idNumerique = (req, res, next, valeur) => {
  if (!/^\d+$/.test(valeur)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Identifiant invalide.' }
    });
  }
  next();
};
router.param('id', idNumerique);
router.param('docId', idNumerique);

router.get('/', authentifier, lecteurs, ctrl.lister);
router.get('/:id', authentifier, lecteurs, ctrl.detail);
router.post('/', authentifier, etudiants, ctrl.creer);
router.patch('/:id/statut', authentifier, etudiants, ctrl.changerStatut);

// Documents : propriétaire vérifié -> réception du fichier -> contrôle du contenu
router.post('/:id/documents', authentifier, etudiants,
  ctrl.verifierProprietaire, ctrl.recevoirFichier, ctrl.televerser);
router.get('/:id/documents/:docId', authentifier, lecteurs, ctrl.telecharger);

module.exports = router;