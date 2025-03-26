const express = require('express');
const router = express.Router();
const CategorieController = require('../controllers/categorieController');

// GET /api/categories - Récupère toutes les catégories
router.get('/', CategorieController.getAllCategories);

// POST /api/categories - Crée une nouvelle catégorie
router.post('/', CategorieController.createCategorie);

// PUT /api/categories/:id - Met à jour une catégorie existante
router.put('/:id', CategorieController.updateCategorie);

// DELETE /api/categories/:id - Supprime une catégorie
router.delete('/:id', CategorieController.deleteCategorie);

module.exports = router;