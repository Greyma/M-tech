const db = require('../config/db');
const FileService = require('../services/fileService');

// Fonction utilitaire pour nettoyer les paramètres
const cleanParams = (params) => {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, value === null ? null : value])
  );
};

class ProduitController {
  static async getAllProduits(req, res) {
    try {
      await db.testConnection();
      
      const [produits] = await db.query(`
        SELECT 
          p.id, p.nom, p.marque, p.description, 
          p.processeur, p.ram, p.stockage, p.gpu,
          p.batterie, p.ecran_tactile, p.ecran_type,
          p.code_amoire, p.reference, p.etat,
          p.prix_achat, p.prix_vente, p.quantite,
          p.categorie_id, p.image,
          c.nom AS categorie_nom
        FROM produits p
        LEFT JOIN categories c ON p.categorie_id = c.id
      `);

      if (!produits || produits.length === 0) {
        return res.status(404).json({ 
          success: false,
          message: "Aucun produit trouvé",
          data: []
        });
      }

      const formattedProduits = produits.map(this.formatProduit);

      res.status(200).json({ 
        success: true,
        message: "Produits récupérés avec succès",
        data: formattedProduits,
        count: formattedProduits.length
      });

    } catch (err) {
      console.error('Erreur dans getAllProduits:', err);
      this.handleServerError(res, err, "récupération des produits");
    }
  }

  static async getProduitById(req, res) {
    try {
      const produitId = parseInt(req.params.id, 10);
      if (isNaN(produitId)) {
        return this.handleClientError(res, "ID invalide");
      }

      const [produit] = await db.query(`
        SELECT 
          p.id, p.nom, p.marque, p.description, 
          p.processeur, p.ram, p.stockage, p.gpu,
          p.batterie, p.ecran_tactile, p.ecran_type,
          p.code_amoire, p.reference, p.etat,
          p.prix_achat, p.prix_vente, p.quantite,
          p.categorie_id, p.image,
          c.nom AS categorie_nom
        FROM produits p
        LEFT JOIN categories c ON p.categorie_id = c.id
        WHERE p.id = ?
      `, [produitId]);

      if (!produit || produit.length === 0) {
        return this.handleNotFound(res, "Produit non trouvé");
      }

      res.status(200).json({
        success: true,
        message: "Produit récupéré avec succès",
        data: this.formatProduit(produit[0])
      });
    } catch (err) {
      console.error("Erreur lors de la récupération du produit :", err);
      this.handleServerError(res, err);
    }
  }

  static async createProduit(req, res) {
    try {
      const rawData = {
        nom: req.body.nom,
        marque: req.body.marque,
        description: req.body.description,
        processeur: req.body.processeur,
        ram: req.body.ram,
        stockage: req.body.stockage,
        gpu: req.body.gpu,
        batterie: req.body.batterie,
        ecran_tactile: req.body.ecran_tactile === 'true',
        ecran_type: req.body.ecran_type,
        code_amoire: req.body.code_amoire,
        reference: req.body.reference,
        etat: req.body.etat || 'neuf',
        prix_achat: req.body.prix_achat,
        prix_vente: req.body.prix_vente,
        quantite: req.body.quantite,
        categorie_id: req.body.categorie_id,
        image: req.files ? JSON.stringify(FileService.processUploadedFiles(req.files)) : null
      };

      const cleanData = cleanParams(rawData);

      // Validation des champs obligatoires
      const requiredFields = ['nom', 'prix_achat', 'prix_vente', 'quantite', 'categorie_id'];
      const missingFields = requiredFields.filter(field => !cleanData[field]);
      
      if (missingFields.length > 0) {
        return this.handleClientError(
          res, 
          `Champs obligatoires manquants: ${missingFields.join(', ')}`
        );
      }

      const [results] = await db.query(
        `INSERT INTO produits SET ?`,
        [cleanData]
      );

      res.status(201).json({
        success: true,
        message: "Produit créé avec succès",
        data: {
          id: results.insertId,
          ...cleanData,
          image: cleanData.image ? JSON.parse(cleanData.image) : null
        }
      });

    } catch (error) {
      console.error("Erreur création produit:", error);
      this.handleServerError(res, error);
    }
  }

  static async updateProduit(req, res) {
    try {
      const produitId = req.params.id;
      const updates = req.body;

      // Conversion pour le champ booléen
      if (updates.ecran_tactile !== undefined) {
        updates.ecran_tactile = updates.ecran_tactile === 'true';
      }

      // Mise à jour des images si fournies
      if (req.files && req.files.length > 0) {
        updates.image = JSON.stringify(FileService.processUploadedFiles(req.files));
      }

      const cleanData = cleanParams(updates);

      if (Object.keys(cleanData).length === 0) {
        return this.handleClientError(res, "Aucune donnée valide à mettre à jour");
      }

      const [results] = await db.query(
        `UPDATE produits SET ? WHERE id = ?`,
        [cleanData, produitId]
      );

      if (results.affectedRows === 0) {
        return this.handleNotFound(res, "Produit non trouvé");
      }

      // Récupérer le produit mis à jour
      const [updatedProduit] = await db.query(
        `SELECT * FROM produits WHERE id = ?`,
        [produitId]
      );

      res.json({
        success: true,
        message: "Produit mis à jour avec succès",
        data: this.formatProduit(updatedProduit[0])
      });
    } catch (error) {
      console.error("Erreur mise à jour produit:", error);
      this.handleServerError(res, error);
    }
  }

  static async deleteProduit(req, res) {
    try {
      const produitId = req.params.id;
      if (!produitId) {
        return this.handleClientError(res, "ID du produit manquant");
      }

      // Vérifier si le produit existe
      const [produit] = await db.query(
        `SELECT id, image FROM produits WHERE id = ?`,
        [produitId]
      );

      if (!produit || produit.length === 0) {
        return this.handleNotFound(res, "Produit non trouvé");
      }

      // Supprimer les images associées
      if (produit[0].image) {
        const images = JSON.parse(produit[0].image);
        for (const imagePath of images) {
          await FileService.deleteFile(imagePath).catch(err => 
            console.error(`Erreur suppression image ${imagePath}:`, err)
          );
        }
      }

      // Supprimer le produit
      const [results] = await db.query(
        "DELETE FROM produits WHERE id = ?",
        [produitId]
      );

      res.status(200).json({ 
        success: true,
        message: "Produit supprimé avec succès" 
      });
    } catch (err) {
      console.error("Erreur lors de la suppression du produit :", err);
      this.handleServerError(res, err, "suppression");
    }
  }

  // Méthodes utilitaires
  static formatProduit(produit) {
    return {
      id: produit.id,
      nom: produit.nom || '',
      marque: produit.marque || '',
      description: produit.description || '',
      processeur: produit.processeur || '',
      ram: produit.ram || '',
      stockage: produit.stockage || '',
      gpu: produit.gpu || '',
      batterie: produit.batterie || '',
      ecran_tactile: Boolean(produit.ecran_tactile),
      ecran_type: produit.ecran_type || '',
      code_amoire: produit.code_amoire || '',
      reference: produit.reference || '',
      etat: produit.etat || 'neuf',
      prix_achat: Number(produit.prix_achat) || 0,
      prix_vente: Number(produit.prix_vente) || 0,
      quantite: Number(produit.quantite) || 0,
      categorie_id: produit.categorie_id || null,
      categorie_nom: produit.categorie_nom || '',
      image: produit.image ? JSON.parse(produit.image) : []
    };
  }

  static handleClientError(res, message, statusCode = 400) {
    return res.status(statusCode).json({
      success: false,
      message
    });
  }

  static handleNotFound(res, message = "Ressource non trouvée") {
    return res.status(404).json({
      success: false,
      message
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

module.exports = ProduitController;