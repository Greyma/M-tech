const db = require('../config/db');
const { generateBarcode, decodeBarcode } = require('./barcode');
const FileService = require('../services/fileService');

class ProduitController {
  static async getAllProduits(req, res) {
    try {
      await db.testConnection();

      // Pas de déstructuration, car db.query retourne directement results
      const produits = await db.query(`
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
        return ProduitController.handleNotFound(res, "Aucun produit trouvé");
      }
      

      const formattedProduits = produits.map(produit => ProduitController.formatProduit(produit));


      res.status(200).json({ 
        success: true,
        message: "Produits récupérés avec succès",
        data: formattedProduits,
        count: formattedProduits.length
      });

    } catch (err) {
      console.error('Erreur dans getAllProduits:', err);
      ProduitController.handleServerError(res, err, "récupération des produits");
    }
  }

  static async getProduitById(req, res) {
    try {

      const prodId = parseInt(req.params.id, 10);

      
      const produitId = decodeBarcode(prodId.toString());


      if (isNaN(produitId.id)) {
          return ProduitController.handleClientError(res, "ID du produit invalide");
      }
     

      const produits = await db.query(`
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
      `, [produitId.id]);

      if (!produits?.length) {
        return ProduitController.handleNotFound(res, "Produit non trouvé");
      }
      
      res.status(200).json({
        success: true,
        message: "Produit récupéré avec succès",
        data: ProduitController.formatProduit(produits[0])
      });
    } catch (err) {
      console.error("Erreur lors de la récupération du produit :", err);
      ProduitController.handleServerError(res, err);
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
            image: req.processedFiles?.length ? JSON.stringify(req.processedFiles) : null
          };

        if (!produitData.nom || 
            isNaN(produitData.prix_achat) || 
            isNaN(produitData.prix_vente) || 
            isNaN(produitData.categorie_id)) {
            return ProduitController.handleClientError(res, "Champs obligatoires manquants ou invalides");
        }

        const categoryCheck = await db.query(
            'SELECT id FROM categories WHERE id = ?',
            [produitData.categorie_id]
        );
        console.log('categoryCheck:', categoryCheck);

        if (!categoryCheck?.length) {
            return ProduitController.handleClientError(res, "La catégorie spécifiée n'existe pas", 400);
        }

        const result = await db.query(
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
        if (error.message.includes("Duplicate entry") && error.message.includes("produits.reference")) {
            return ProduitController.handleClientError(
                res, 
                `Un produit avec la référence '${req.body.reference}' existe déjà`, 
                409
            );
        }
        ProduitController.handleServerError(res, error, "création du produit");
    }
}


static async updateProduit(req, res) {
  try {
       const prodId = parseInt(req.params.id, 10);

      
      const prod = decodeBarcode(prodId.toString());

      const produitId = prod.id;
      if (isNaN(produitId)) {
          return ProduitController.handleClientError(res, "ID du produit invalide");
      }

      const existingProduits = await db.query(
          `SELECT image FROM produits WHERE id = ?`,
          [produitId]
      );
      if (!existingProduits?.length) {
          return ProduitController.handleNotFound(res, "Produit non trouvé");
      }

      const existingProduit = existingProduits[0];

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
        updates.image = JSON.stringify(req.processedFiles);
        if (existingProduit.image) {
            const oldImages = JSON.parse(existingProduit.image || '[]');
            await Promise.all(
                oldImages.map(image => 
                    FileService.deleteFile(image.path).catch(err => 
                        console.error(`Erreur suppression ancienne image ${image.path}:`, err)
                    )
                )
            );
        }
    }

      const cleanUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

    
      if (!Object.keys(cleanUpdates).length) {
          return ProduitController.handleClientError(res, "Aucune donnée valide à mettre à jour");
      }

      if (cleanUpdates.categorie_id) {
          const categoryCheck = await db.query(
              'SELECT id FROM categories WHERE id = ?',
              [cleanUpdates.categorie_id]
          );
          if (!categoryCheck?.length) {
              return ProduitController.handleClientError(res, "La catégorie spécifiée n'existe pas", 400);
          }
      }


      // Construire la clause SET dynamiquement
      const setClause = Object.keys(cleanUpdates)
      .map(key => `${key} = ?`)
      .join(', ');
      const values = Object.values(cleanUpdates);

      const result = await db.query(
          `UPDATE produits SET ${setClause} WHERE id = ?`,
          [...values, produitId]
      );

      if (!result.affectedRows) {
          return ProduitController.handleNotFound(res, "Produit non trouvé");
      }

      const updatedProduit = await db.query(
          `SELECT * FROM produits WHERE id = ?`,
          [produitId]
      );

      res.json({
          success: true,
          message: "Produit mis à jour avec succès",
          data: ProduitController.formatProduit(updatedProduit[0])
      });

  } catch (error) {
      console.error("Erreur mise à jour produit:", error);
      if (error.message.includes("Duplicate entry") && error.message.includes("produits.reference")) {
          return ProduitController.handleClientError(
              res, 
              `Un produit avec la référence '${req.body.reference}' existe déjà`, 
              409
          );
      }
      ProduitController.handleServerError(res, error, "mise à jour du produit");
  }
}

  static async deleteProduit(req, res) {
    try {
        const prodId = parseInt(req.params.id, 10);

      
        const prod = decodeBarcode(prodId.toString());

        const produitId = prod.id;
        
        if (isNaN(produitId)) {
            return ProduitController.handleClientError(res, "ID du produit invalide");
        }

        const produits = await db.query(
            `SELECT id, image FROM produits WHERE id = ?`,
            [produitId]
        );

        if (!produits?.length) {
            return ProduitController.handleNotFound(res, "Produit non trouvé");
        }

        const produit = produits[0];
        if (produit.image) {
          const images = JSON.parse(produit.image || '[]'); // Désérialiser
          await Promise.all(
              images.map(image => 
                  FileService.deleteFile(image.path).catch(err => 
                      console.error(`Erreur suppression image ${image.path}:`, err)
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
        ProduitController.handleServerError(res, err, "suppression");
    }
}

static formatProduit(produit) {
  const barcode = generateBarcode(produit.id);

  // Fonction pour valider et parser le JSON en toute sécurité
  const parseImage = (image) => {
    if (!image) {
      return [{ filename: "default", path: "uploads/default.jpg" }];
    }
    try {
      // Vérifier si image est une chaîne valide avant de parser
      if (typeof image === 'string' && image.trim().startsWith('[')) {
        return JSON.parse(image);
      }
      console.warn(`Image invalide pour produit ${produit.id}: ${image}`);
      return [{ filename: "default", path: "uploads/default.jpg" }];
    } catch (err) {
      console.error(`Erreur parsing image pour produit ${produit.id}:`, err);
      return [{ filename: "default", path: "uploads/default.jpg" }];
    }
  };

  return {
    id: barcode,
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
    image: JSON.parse(produit.image) 
  };
}
  static handleNotFound(res, message = "Ressource non trouvée") {
    return res.status(404).json({
      success: false,
      message,
      data: []
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