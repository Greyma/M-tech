const express = require('express');
const router = express.Router();
const FactureController = require('../controllers/factureController');

// GET /api/factures - Récupère toutes les factures
router.get('/', FactureController.getAllFactures);

// POST /api/factures - Crée une nouvelle facture
router.post('/', FactureController.createFacture);

// DELETE /api/factures/:id - Supprime une facture
router.delete('/:id', FactureController.deleteFacture);

module.exports = router;