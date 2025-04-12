const express = require('express');
const router = express.Router();
const ProduitController = require('../controllers/produitController');
const { uploadImageMiddleware } = require('../config/multer');

router.get('/', ProduitController.getAllProduits);
router.get('/:id', ProduitController.getProduitById);
router.post('/', uploadImageMiddleware, ProduitController.createProduit);
router.put('/:id',uploadImageMiddleware, ProduitController.updateProduit);
router.delete('/:id', ProduitController.deleteProduit);

module.exports = router;