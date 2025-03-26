const express = require('express');
const router = express.Router();
const ProduitController = require('../controllers/produitController');
const { arrayUpload } = require('../config/multer');

router.get('/', ProduitController.getAllProduits);
router.get('/:id', ProduitController.getProduitById);
router.post('/', arrayUpload, ProduitController.createProduit);
router.put('/:id', ProduitController.updateProduit);
router.delete('/:id', ProduitController.deleteProduit);

module.exports = router;