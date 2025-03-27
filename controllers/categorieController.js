const db = require('../config/db');

class CategorieController {
  static async getAllCategories(req, res) {
    try {
      const results = await db.query(
        "SELECT id, nom, created_at FROM categories"
      );

      if (!results?.length) {
        return CategorieController.handleNotFound(res, "Aucune catégorie trouvée", {
          data: []
        });
      }

      const categories = results.map(cat => ({
        id: cat.id,
        nom: cat.nom,
        created_at: cat.created_at
      }));

      res.status(200).json({ 
        success: true,
        message: "Catégories récupérées avec succès",
        data: categories,
        count: categories.length
      });
    } catch (err) {
      console.error("Erreur dans la récupération des catégories:", err);
      CategorieController.handleServerError(res, err, "récupération des catégories");
    }
  }

  static async createCategorie(req, res) {
    const { nom } = req.body;

    if (!nom || typeof nom !== 'string' || nom.trim() === '') {
      return CategorieController.handleClientError(res, "Le nom est requis et doit être une chaîne valide");
    }

    try {
      const results = await db.query(
        "INSERT INTO categories (nom, created_at) VALUES (?, NOW())",
        [nom.trim()]
      );

      const insertId = results.insertId || (Array.isArray(results) ? results[0]?.insertId : null);

      res.status(201).json({
        success: true,
        message: "Catégorie créée avec succès",
        data: { 
          id: insertId, 
          nom: nom.trim(),
          created_at: new Date()
        }
      });
    } catch (err) {
      console.error("Erreur lors de la création de catégorie:", err);
      CategorieController.handleServerError(res, err, "création de la catégorie");
    }
  }

  static async updateCategorie(req, res) {
    const { nom } = req.body;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return CategorieController.handleClientError(res, "ID invalide");
    }

    if (!nom || typeof nom !== 'string' || nom.trim() === '') {
      return CategorieController.handleClientError(res, "Le nom est requis et doit être une chaîne valide");
    }

    try {
      const results = await db.query(
        "UPDATE categories SET nom = ?, updated_at = NOW() WHERE id = ?",
        [nom.trim(), id]
      );

      const affectedRows = results.affectedRows || (Array.isArray(results) ? results[0]?.affectedRows : 0);

      if (!affectedRows) {
        return CategorieController.handleNotFound(res, "Catégorie non trouvée");
      }

      res.status(200).json({
        success: true,
        message: "Catégorie mise à jour avec succès",
        data: { 
          id, 
          nom: nom.trim()
        }
      });
    } catch (err) {
      console.error("Erreur lors de la mise à jour de catégorie:", err);
      CategorieController.handleServerError(res, err, "mise à jour de la catégorie");
    }
  }

  static async deleteCategorie(req, res) {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return CategorieController.handleClientError(res, "ID invalide");
    }

    try {
      // Vérifier si la catégorie est utilisée dans produits
      const produits = await db.query(
        "SELECT COUNT(*) as count FROM produits WHERE categorie_id = ?",
        [id]
      );

      const count = produits[0]?.count || (Array.isArray(produits) ? produits[0][0]?.count : 0);

      if (count > 0) {
        return CategorieController.handleClientError(
          res, 
          "Impossible de supprimer cette catégorie car elle est utilisée par des produits", 
          409
        );
      }

      const results = await db.query(
        "DELETE FROM categories WHERE id = ?",
        [id]
      );

      const affectedRows = results.affectedRows || (Array.isArray(results) ? results[0]?.affectedRows : 0);

      if (!affectedRows) {
        return CategorieController.handleNotFound(res, "Catégorie non trouvée");
      }

      res.status(200).json({ 
        success: true,
        message: "Catégorie supprimée avec succès"
      });
    } catch (err) {
      console.error("Erreur lors de la suppression de catégorie:", err);
      CategorieController.handleServerError(res, err, "suppression de la catégorie");
    }
  }

  // Méthodes utilitaires
  static handleClientError(res, message, statusCode = 400) {
    return res.status(statusCode).json({
      success: false,
      message
    });
  }

  static handleNotFound(res, message = "Ressource non trouvée", additionalData = {}) {
    return res.status(404).json({
      success: false,
      message,
      ...additionalData
    });
  }

  static handleServerError(res, error, context = "") {
    return res.status(500).json({ 
      success: false,
      message: `Erreur serveur${context ? ` lors de la ${context}` : ''}`,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = CategorieController;