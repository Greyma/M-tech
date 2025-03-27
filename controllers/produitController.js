const db = require('../config/db');
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
      const produitId = parseInt(req.params.id, 10);
      if (isNaN(produitId)) {
        return ProduitController.handleClientError(res, "ID invalide");
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
      `, [produitId]);

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
            image: req.files?.length ? JSON.stringify(FileService.processUploadedFiles(req.files)) : null // Gère tous les fichiers envoyés
        };

        // Log pour débogage
        console.log('req.files:', req.files);

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
      const produitId = parseInt(req.params.id, 10);
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
          updates.image = JSON.stringify(FileService.processUploadedFiles(req.files));
          if (existingProduit.image) {
              const oldImages = Array.isArray(existingProduit.image) ? existingProduit.image : [];
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
        const produitId = parseInt(req.params.id, 10);
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
            // Pas besoin de JSON.parse, produit.image est déjà un objet ou null
            const images = Array.isArray(produit.image) ? produit.image : [];
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

static generateBarcode(id) {
  // Vérifier que l'ID est un nombre valide
  const idNum = parseInt(id, 10);
  if (isNaN(idNum) || idNum < 0) {
      throw new Error("L'ID doit être un nombre positif");
  }

  // Préfixe fixe (par exemple, "370" pour un code pays fictif, ajustez selon vos besoins)
  const prefix = "370";

  // Convertir l'ID en chaîne et le compléter avec des zéros à gauche pour avoir une longueur fixe
  const idString = idNum.toString().padStart(9, "0"); // 9 chiffres pour l'ID

  // Combiner le préfixe et l'ID (12 chiffres au total)
  const baseNumber = prefix + idString;

  // Calculer la clé de contrôle (check digit) pour EAN-13
  const checkDigit = ProduitController.calculateEAN13CheckDigit(baseNumber);

  // Retourner le code-barres complet (13 chiffres)
  return baseNumber + checkDigit;
}

// Fonction pour calculer la clé de contrôle EAN-13
static calculateEAN13CheckDigit(number) {
  if (number.length !== 12) {
      throw new Error("Le numéro de base doit avoir exactement 12 chiffres");
  }

  // Convertir en tableau de chiffres
  const digits = number.split('').map(Number);

  // Calculer la somme selon l'algorithme EAN-13 :
  // - Poids 1 pour les positions impaires (0, 2, 4, ...)
  // - Poids 3 pour les positions paires (1, 3, 5, ...)
  let sum = 0;
  for (let i = 0; i < 12; i++) {
      sum += i % 2 === 0 ? digits[i] : digits[i] * 3;
  }

  // Calculer le check digit
  const remainder = sum % 10;
  const checkDigit = remainder === 0 ? 0 : 10 - remainder;

  return checkDigit.toString();
}

static formatProduit(produit) {

  const barcode = ProduitController.generateBarcode(produit.id);

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
      image: produit.image ?? [{ filename : "default" , path : "uploads/default.jpg"}]
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