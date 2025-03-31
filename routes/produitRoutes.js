const express = require('express');
const router = express.Router();
const ProduitController = require('../controllers/produitController');
const { uploadMiddleware } = require('../config/multer');

router.get('/', ProduitController.getAllProduits);
router.get('/:id', ProduitController.getProduitById);
router.post('/', uploadMiddleware, ProduitController.createProduit);
router.put('/:id',uploadMiddleware, ProduitController.updateProduit);
router.delete('/:id', ProduitController.deleteProduit);

module.exports = router;