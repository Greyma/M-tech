const db = require('../config/db');
const { generateBarcode, decodeBarcode } = require('./barcode');
const FileService = require('../services/fileService');
const { json } = require('body-parser');

class ProduitController {

  static async getAllProduits(req, res) {
    try {
        await db.testConnection();

        // Pas de déstructuration, car db.query retourne directement results
        const produits = await db.query(`
            SELECT 
                p.id, p.nom, p.marque, p.description, p.cpu,
                p.cpu_generation, p.cpu_type, p.ram, 
                p.ecran_pouce, p.ecran_tactile, p.ecran_type,
                p.stockage_ssd, p.stockage_hdd, 
                p.gpu_1, p.gpu_2,
                p.prix_achat, p.prix_vente,
                p.batterie, p.code_amoire, p.reference, p.etat,
                p.quantite, p.categorie_id, p.image,
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
                p.cpu_generation, p.cpu, p.cpu_type, p.ram, 
                p.ecran_pouce, p.ecran_tactile, p.ecran_type,
                p.stockage_ssd, p.stockage_hdd, 
                p.gpu_1, p.gpu_2,
                p.prix_achat, p.prix_vente,
                p.batterie, p.code_amoire, p.reference, p.etat,
                p.quantite, p.categorie_id, p.image,
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
            
            // CPU
            cpu: req.body.cpu ?? null,
            cpu_generation: req.body.cpu_generation ?? null,
            cpu_type: req.body.cpu_type ?? null,
            
            // RAM
            ram: req.body.ram ?? null,
            
            // Écran
            ecran_pouce: req.body.ecran_pouce ? parseFloat(req.body.ecran_pouce) : null,
            ecran_tactile: req.body.ecran_tactile === 'true',
            ecran_type: req.body.ecran_type ?? null,
            
            // Stockage
            stockage_ssd: req.body.stockage_ssd ?? null,
            stockage_hdd: req.body.stockage_hdd ?? null,
            
            // GPU
            gpu_1: req.body.gpu_1 ?? null,
            gpu_2: req.body.gpu_2 ?? null,
            
            // Prix
            prix_achat: parseFloat(req.body.prix_achat),
            prix_vente: parseFloat(req.body.prix_vente),
            
            // Autres champs
            batterie: req.body.batterie ?? null,
            code_amoire: req.body.code_amoire ?? null,
            reference: req.body.reference ?? null,
            etat: req.body.etat || 'neuf',
            quantite: parseInt(req.body.quantite) || 0,
            categorie_id: parseInt(req.body.categorie_id),
            image: req.processedFiles?.length ? JSON.stringify(req.processedFiles) : null
        };

        // Validation des champs obligatoires
        if (!produitData.nom || 
            isNaN(produitData.prix_achat) || 
            isNaN(produitData.prix_vente) || 
            isNaN(produitData.categorie_id)) {
            return ProduitController.handleClientError(res, "Champs obligatoires manquants ou invalides");
        }

        // Vérification de l'existence de la catégorie
        const categoryCheck = await db.query(
            'SELECT id FROM categories WHERE id = ?',
            [produitData.categorie_id]
        );
        console.log('categoryCheck:', categoryCheck);

        if (!categoryCheck?.length) {
            return ProduitController.handleClientError(res, "La catégorie spécifiée n'existe pas", 400);
        }

        // Insertion dans la base de données
        const result = await db.query(
            `INSERT INTO produits (
                nom, marque, description, cpu, cpu_generation, cpu_type, ram, 
                ecran_pouce, ecran_tactile, ecran_type, stockage_ssd, stockage_hdd, 
                gpu_1, gpu_2, prix_achat, prix_vente, batterie, 
                code_amoire, reference, etat, quantite, categorie_id, image
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            Object.values(produitData)
        );

        // Réponse réussie
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

    const existingProduitsRaw = await db.query(
      `SELECT image FROM produits WHERE id = ?`,
      [produitId]
    );
    console.log('Résultat brut de db.query :', existingProduitsRaw);

    // Normalisation : s'assurer que c'est un tableau
    let existingProduits = Array.isArray(existingProduitsRaw) ? existingProduitsRaw : [existingProduitsRaw];
    console.log('existingProduits après normalisation :', existingProduits);

    if (!existingProduits.length || !existingProduits[0]) {
      return ProduitController.handleNotFound(res, "Produit non trouvé");
    }

    const existingProduit = existingProduits[0];
    console.log('existingProduit :', existingProduit);

    const updates = {
      nom: req.body.nom,
      marque: req.body.marque ?? undefined,
      description: req.body.description ?? undefined,
      
      // CPU
      cpu: req.body.cpu ?? undefined,
      cpu_generation: req.body.cpu_generation ?? undefined,
      cpu_type: req.body.cpu_type ?? undefined,
      
      // RAM
      ram: req.body.ram ?? undefined,
      
      // Écran
      ecran_pouce: req.body.ecran_pouce ? parseFloat(req.body.ecran_pouce) : undefined,
      ecran_tactile: req.body.ecran_tactile !== undefined ? req.body.ecran_tactile === 'true' : undefined,
      ecran_type: req.body.ecran_type ?? undefined,
      
      // Stockage
      stockage_ssd: req.body.stockage_ssd ?? undefined,
      stockage_hdd: req.body.stockage_hdd ?? undefined,
      
      // GPU
      gpu_1: req.body.gpu_1 ?? undefined,
      gpu_2: req.body.gpu_2 ?? undefined,
      
      // Prix
      prix_achat: req.body.prix_achat ? parseFloat(req.body.prix_achat) : undefined,
      prix_vente: req.body.prix_vente ? parseFloat(req.body.prix_vente) : undefined,
      
      // Autres champs
      batterie: req.body.batterie ?? undefined,
      code_amoire: req.body.code_amoire ?? undefined,
      reference: req.body.reference ?? undefined,
      etat: req.body.etat,
      quantite: req.body.quantite ? parseInt(req.body.quantite, 10) : undefined,
      categorie_id: req.body.categorie_id ? parseInt(req.body.categorie_id, 10) : undefined
    };

    // Gestion sécurisée des images
    if (req.processedFiles?.length) {
      if (!Array.isArray(req.processedFiles) || 
          !req.processedFiles.every(file => file.filename && file.path)) {
        throw new Error("Données d'image invalides dans req.processedFiles");
      }
      updates.image = JSON.stringify(req.processedFiles);
      if (existingProduit.image) {
        let oldImages = [];
        if (typeof existingProduit.image === 'string') {
          try {
            oldImages = JSON.parse(existingProduit.image || '[]');
            if (!Array.isArray(oldImages)) throw new Error("Format d'image invalide");
          } catch (err) {
            console.error(`Erreur parsing image existante pour produit ${produitId}:`, err);
            oldImages = [];
          }
        } else if (Array.isArray(existingProduit.image)) {
          oldImages = existingProduit.image; // Si c'est déjà un tableau
        }
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
      if (!categoryCheck.length) {
        return ProduitController.handleClientError(res, "La catégorie spécifiée n'existe pas", 400);
      }
    }

    const setClause = Object.keys(cleanUpdates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(cleanUpdates);

    const result = await db.query(
      `UPDATE produits SET ${setClause} WHERE id = ?`,
      [...values, produitId]
    );

    if (!result.affectedRows) {
      return ProduitController.handleNotFound(res, "Produit non trouvé ou aucune modification appliquée");
    }

    const updatedProduits = await db.query(
      `SELECT * FROM produits WHERE id = ?`,
      [produitId]
    );

    res.json({
      success: true,
      message: "Produit mis à jour avec succès",
      data: ProduitController.formatProduit(updatedProduits[0])
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

  const img = [
    {
        "path": "uploads/default.jpg",
        "size": 36387,
        "filename": "default.jpg",
        "mimetype": "image/jpg",
        "originalName": "default.jpg"
    }
];

  return {
    id: barcode,
    nom: produit.nom || '',
    marque: produit.marque ?? null,
    description: produit.description ?? null,
    
    // CPU
    cpu: produit.cpu || '',
    cpu_generation: produit.cpu_generation ?? null,
    cpu_type: produit.cpu_type ?? null,
    
    // RAM
    ram: produit.ram ?? null,
    
    // Écran
    ecran_pouce: produit.ecran_pouce ?? null,
    ecran_tactile: Boolean(produit.ecran_tactile),
    ecran_type: produit.ecran_type ?? null,
    
    // Stockage
    stockage_ssd: produit.stockage_ssd ?? null,
    stockage_hdd: produit.stockage_hdd ?? null,
    
    // GPU
    gpu_1: produit.gpu_1 ?? null,
    gpu_2: produit.gpu_2 ?? null,
    
    // Prix
    prix_achat: Number(produit.prix_achat) || 0,
    prix_vente: Number(produit.prix_vente) || 0,
    
    // Autres champs
    batterie: produit.batterie ?? null,
    code_amoire: produit.code_amoire ?? null,
    reference: produit.reference ?? null,
    etat: produit.etat || 'neuf',
    quantite: Number(produit.quantite) || 0,
    categorie_id: produit.categorie_id ?? null,
    categorie_nom: produit.categorie_nom ?? null,
    image: produit.image ? produit.image : img
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