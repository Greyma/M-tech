const express = require('express');
const router = express.Router();
const ProduitController = require('../controllers/produitController');
const { anyUpload } = require('../config/multer');

router.get('/', ProduitController.getAllProduits);
router.get('/:id', ProduitController.getProduitById);
router.post('/', anyUpload, ProduitController.createProduit);
router.put('/:id', ProduitController.updateProduit);
router.delete('/:id', ProduitController.deleteProduit);

module.exports = router;