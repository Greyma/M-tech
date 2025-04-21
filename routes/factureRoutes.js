const express = require('express');
const router = express.Router();
const FactureController = require('../controllers/factureController');
const { uploadPDFMiddleware } = require('../config/multer');

router.get('/', FactureController.getAllFactures);

router.post('/', uploadPDFMiddleware, FactureController.createFacture);

router.post('/with-client', uploadPDFMiddleware, FactureController.createFactureWithClient);

router.post('/add-versement', uploadPDFMiddleware, FactureController.ajouterPaiement);

router.put('/:id', FactureController.modifierFactureGarantieVersement);

router.put('/status/:id', FactureController.modifierFactureStatus);

router.delete('/:id', FactureController.deleteFacture);

module.exports = router;