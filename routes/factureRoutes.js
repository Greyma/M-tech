const express = require('express');
const router = express.Router();
const FactureController = require('../controllers/factureController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/factures - Récupère toutes les factures
router.get('/', FactureController.getAllFactures);

// POST /api/factures - Crée une nouvelle facture
router.post('/', FactureController.createFacture);

router.post('/with-client', upload.none(), FactureController.createFactureWithClient);

// DELETE /api/factures/:id - Supprime une facture
router.delete('/:id', FactureController.deleteFacture);

module.exports = router;