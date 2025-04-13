const express = require('express');
const router = express.Router();
const FactureController = require('../controllers/factureController');
const { uploadPDFMiddleware } = require('../config/multer');

// GET /api/factures - Récupère toutes les factures
router.get('/', FactureController.getAllFactures);

// POST /api/factures - Crée une nouvelle facture
router.post('/', uploadPDFMiddleware, FactureController.createFacture);


router.post('/with-client', uploadPDFMiddleware, FactureController.createFactureWithClient);

// PUT /api/factures/:id - Ajoute ou modifie un versement à une méthode de paiement  et modifie une garantie
router.put('/:id', FactureController.modifierFactureGarantieVersement);

// DELETE /api/factures/:id - Supprime une facture
router.delete('/:id', FactureController.deleteFacture);

module.exports = router;