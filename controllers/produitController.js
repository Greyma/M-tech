const db = require('../config/db');
const FileService = require('../services/fileService');

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

      if (!produits?.length) {
        return res.status(404).json({ 
          success: false,
          message: "Aucun produit trouvé",
          data: []
        });
      }

      const formattedProduits = produits.map(produit => this.formatProduit(produit));

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
        WHERE p.id = ?
      `, [produitId]);

      if (!produits?.length) {
        return this.handleNotFound(res, "Produit non trouvé");
      }

      res.status(200).json({
        success: true,
        message: "Produit récupéré avec succès",
        data: this.formatProduit(produits[0])
      });
    } catch (err) {
      console.error("Erreur lors de la récupération du produit :", err);
      this.handleServerError(res, err);
    }
  }

  static async createProduit(req, res) {
    try {
      const produitData = {
        nom: req.body.nom,
        marque: req.body.marque ?? null,
        description: req.body.description ?? null,
        processeur: req.body.processeur ?? null,
        ram: req.body.ram ?? null,
        stockage: req.body.stockage ?? null,
        gpu: req.body.gpu ?? null,
        batterie: req.body.batterie ?? null,
        ecran_tactile: req.body.ecran_tactile === 'true',
        ecran_type: req.body.ecran_type ?? null,
        code_amoire: req.body.code_amoire ?? null,
        reference: req.body.reference ?? null,
        etat: req.body.etat || 'neuf',
        prix_achat: parseFloat(req.body.prix_achat),
        prix_vente: parseFloat(req.body.prix_vente),
        quantite: parseInt(req.body.quantite) || 0,
        categorie_id: parseInt(req.body.categorie_id),
        image: req.files?.length ? JSON.stringify(FileService.processUploadedFiles(req.files)) : null
      };

      // Validation des champs obligatoires
      if (!produitData.nom || 
          isNaN(produitData.prix_achat) || 
          isNaN(produitData.prix_vente) || 
          isNaN(produitData.categorie_id)) {
        return ProduitController.handleClientError(res, "Champs obligatoires manquants ou invalides");
      }

      // Vérifier si la catégorie existe
      const [categoryCheck] = await db.query(
        'SELECT id FROM categories WHERE id = ?',
        [produitData.categorie_id]
      );

      if (!categoryCheck?.length) {
        return ProduitController.handleClientError(res, "La catégorie spécifiée n'existe pas", 400);
      }

      const [result] = await db.query(
        `INSERT INTO produits (
          nom, marque, description, processeur, ram, stockage, 
          gpu, batterie, ecran_tactile, ecran_type, code_amoire, 
          reference, etat, prix_achat, prix_vente, quantite, 
          categorie_id, image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        Object.values(produitData)
      );

      res.status(201).json({
        success: true,
        message: "Produit créé avec succès",
        data: {
          id: result.insertId,
          ...produitData,
          image: produitData.image ? JSON.parse(produitData.image) : null
        }
      });

    } catch (error) {
      console.error("Erreur création produit:", error);
      ProduitController.handleServerError(res, error, "création du produit");
    }
  }

  static async updateProduit(req, res) {
    try {
      const produitId = parseInt(req.params.id);
      if (isNaN(produitId)) {
        return this.handleClientError(res, "ID du produit invalide");
      }

      const updates = {
        nom: req.body.nom,
        marque: req.body.marque ?? undefined,
        description: req.body.description ?? undefined,
        processeur: req.body.processeur ?? undefined,
        ram: req.body.ram ?? undefined,
        stockage: req.body.stockage ?? undefined,
        gpu: req.body.gpu ?? undefined,
        batterie: req.body.batterie ?? undefined,
        ecran_tactile: req.body.ecran_tactile !== undefined ? req.body.ecran_tactile === 'true' : undefined,
        ecran_type: req.body.ecran_type ?? undefined,
        code_amoire: req.body.code_amoire ?? undefined,
        reference: req.body.reference ?? undefined,
        etat: req.body.etat,
        prix_achat: req.body.prix_achat ? parseFloat(req.body.prix_achat) : undefined,
        prix_vente: req.body.prix_vente ? parseFloat(req.body.prix_vente) : undefined,
        quantite: req.body.quantite ? parseInt(req.body.quantite) : undefined,
        categorie_id: req.body.categorie_id ? parseInt(req.body.categorie_id) : undefined
      };

      if (req.files?.length) {
        updates.image = JSON.stringify(FileService.processUploadedFiles(req.files));
      }

      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      if (!Object.keys(cleanUpdates).length) {
        return this.handleClientError(res, "Aucune donnée valide à mettre à jour");
      }

      const [results] = await db.query(
        `UPDATE produits SET ? WHERE id = ?`,
        [cleanUpdates, produitId]
      );

      if (!results.affectedRows) {
        return this.handleNotFound(res, "Produit non trouvé");
      }

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
      this.handleServerError(res, error, "mise à jour du produit");
    }
  }

  static async deleteProduit(req, res) {
    try {
      const produitId = parseInt(req.params.id);
      if (isNaN(produitId)) {
        return this.handleClientError(res, "ID du produit invalide");
      }

      const [produits] = await db.query(
        `SELECT id, image FROM produits WHERE id = ?`,
        [produitId]
      );

      if (!produits?.length) {
        return this.handleNotFound(res, "Produit non trouvé");
      }

      const produit = produits[0];
      if (produit.image) {
        const images = JSON.parse(produit.image);
        await Promise.all(
          images.map(imagePath => 
            FileService.deleteFile(imagePath).catch(err => 
              console.error(`Erreur suppression image ${imagePath}:`, err)
            )
          )
        );
      }

      await db.query("DELETE FROM produits WHERE id = ?", [produitId]);

      res.status(200).json({ 
        success: true,
        message: "Produit supprimé avec succès" 
      });
    } catch (err) {
      console.error("Erreur lors de la suppression du produit :", err);
      this.handleServerError(res, err, "suppression");
    }
  }

  static formatProduit(produit) {
    return {
      id: produit.id,
      nom: produit.nom || '',
      marque: produit.marque ?? null,
      description: produit.description ?? null,
      processeur: produit.processeur ?? null,
      ram: produit.ram ?? null,
      stockage: produit.stockage ?? null,
      gpu: produit.gpu ?? null,
      batterie: produit.batterie ?? null,
      ecran_tactile: Boolean(produit.ecran_tactile),
      ecran_type: produit.ecran_type ?? null,
      code_amoire: produit.code_amoire ?? null,
      reference: produit.reference ?? null,
      etat: produit.etat || 'neuf',
      prix_achat: Number(produit.prix_achat) || 0,
      prix_vente: Number(produit.prix_vente) || 0,
      quantite: Number(produit.quantite) || 0,
      categorie_id: produit.categorie_id ?? null,
      categorie_nom: produit.categorie_nom ?? null,
      image: produit.image ? JSON.parse(produit.image) : null
    };
  }

  static handleNotFound(res, message = "Ressource non trouvée") {
    return res.status(404).json({
      success: false,
      message
    });
  }

  static handleClientError(res, message, statusCode = 400) {
    return res.status(statusCode).json({
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