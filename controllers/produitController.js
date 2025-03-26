const db = require('../config/db');
const FileService = require('../services/fileService');

class ProduitController {
    static async getAllProduits(req, res) {
        try {
            
            await db.testConnection();
            
            const results = await db.query(
                "SELECT id, categorie_id, nom, description, prix_vente, prix_achat, quantite, reference, image FROM produits"
            );
    
            // 3. Vérification approfondie des résultats
            if (!results || !Array.isArray(results) || results.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    message: "Aucun produit trouvé",
                    data: []
                });
            }
    
            const produits = results.map(produit => ({
                id: produit?.id || null,
                categorie_id: produit?.categorie_id || null,
                nom: produit?.nom || '',
                description: produit?.description || '',
                prix_vente: produit?.prix_vente ? Number(produit.prix_vente) : 0,
                prix_achat: produit?.prix_achat ? Number(produit.prix_achat) : 0,
                quantite: produit?.quantite ? Number(produit.quantite) : 0,
                reference: produit?.reference || '',
                image: produit?.image ? JSON.parse(produit.image) : []
            }));
    
            res.status(200).json({ 
                success: true,
                message: "Produits récupérés avec succès",
                data: produits,
                count: produits.length
            });
    
        } catch (err) {
            console.error('Erreur dans getAllProduits:', err);
            res.status(500).json({ 
                success: false,
                message: "Erreur lors de la récupération des produits",
                error: process.env.NODE_ENV === 'development' ? err.message : undefined,
                details: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
        }
    }


    static async getProduitById(req, res) {
        try {
            const produitId = parseInt(req.params.id, 10);
            if (isNaN(produitId)) {
                return res.status(400).json({ message: "ID invalide" });
            }

            const [results] = await db.query(
                `SELECT id, categorie_id, nom, description, prix_vente, 
                 prix_achat, quantite, reference, image 
                 FROM produits WHERE id = ?`,
                [produitId]
            );

            if (results.length === 0) {
                return res.status(404).json({ message: "Produit non trouvé" });
            }

            const produit = results[0];
            res.status(200).json({
                data: {
                    id: produit.id,
                    categorie_id: produit.categorie_id,
                    nom: produit.nom,
                    description: produit.description,
                    prix_vente: produit.prix_vente,
                    prix_achat: produit.prix_achat,
                    quantite: produit.quantite,
                    reference: produit.reference,
                    image: produit.image,
                },
                message: "Produit récupéré avec succès",
            });
        } catch (err) {
            console.error("Erreur lors de la récupération du produit :", err);
            res.status(500).json({ 
                message: "Erreur serveur", 
                error: err.message 
            });
        }
    }

    static async createProduit(req, res) {
        try {
            const { 
                categorie_id, 
                nom, 
                description, 
                prix_vente, 
                prix_achat, 
                quantite, 
                reference 
            } = req.body;

            // Validation des champs requis
            if (!(categorie_id && nom && prix_vente && prix_achat && quantite && reference)) {
                return res.status(400).json({ 
                    message: "Tous les champs requis doivent être fournis" 
                });
            }

            // Traitement des images
            const imagePaths = FileService.processUploadedFiles(req.files);

            // Insertion en base de données
            const [results] = await db.query(
                `INSERT INTO produits 
                 (categorie_id, nom, description, prix_vente, prix_achat, quantite, reference, image)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    categorie_id,
                    nom,
                    description,
                    prix_vente,
                    prix_achat,
                    quantite,
                    reference,
                    JSON.stringify(imagePaths)
                ]
            );

            res.status(201).json({
                data: {
                    id: results.insertId,
                    categorie_id,
                    nom,
                    description,
                    prix_vente,
                    prix_achat,
                    quantite,
                    reference,
                    image: imagePaths
                },
                message: "Produit créé avec succès"
            });
        } catch (error) {
            console.error("Erreur lors de la création du produit :", error);
            res.status(500).json({ 
                message: "Erreur serveur", 
                error: error.message 
            });
        }
    }

    static async updateProduit(req, res) {
        try {
            const { 
                categorie_id, 
                nom, 
                description, 
                prix_vente, 
                prix_achat, 
                quantite, 
                reference 
            } = req.body;

            // Validation des champs requis
            if (!(categorie_id && nom && prix_vente && prix_achat && quantite && reference)) {
                return res.status(400).json({ 
                    message: "Tous les champs requis doivent être fournis" 
                });
            }

            // Mise à jour en base de données
            const [results] = await db.query(
                `UPDATE produits 
                 SET categorie_id = ?, nom = ?, description = ?, 
                     prix_vente = ?, prix_achat = ?, quantite = ?, reference = ? 
                 WHERE id = ?`,
                [
                    categorie_id, 
                    nom, 
                    description, 
                    prix_vente, 
                    prix_achat, 
                    quantite, 
                    reference, 
                    req.params.id
                ]
            );

            if (results.affectedRows === 0) {
                return res.status(404).json({ message: "Produit non trouvé" });
            }

            res.status(200).json({ 
                data: { 
                    id: req.params.id, 
                    categorie_id, 
                    nom, 
                    description, 
                    prix_vente, 
                    prix_achat, 
                    quantite, 
                    reference 
                }, 
                message: "Produit mis à jour avec succès" 
            });
        } catch (err) {
            console.error("Erreur lors de la mise à jour du produit :", err);
            res.status(500).json({ 
                message: "Erreur serveur", 
                error: err.message 
            });
        }
    }

    static async deleteProduit(req, res) {
        try {
            const produitId = req.params.id;
            if (!produitId) {
                return res.status(400).json({ message: "ID du produit manquant" });
            }

            const [results] = await db.query(
                "DELETE FROM produits WHERE id = ?",
                [produitId]
            );

            if (results.affectedRows === 0) {
                return res.status(404).json({ message: "Produit non trouvé" });
            }

            res.status(200).json({ 
                message: "Produit supprimé avec succès" 
            });
        } catch (err) {
            console.error("Erreur lors de la suppression du produit :", err);
            res.status(500).json({ 
                message: "Erreur serveur lors de la suppression", 
                error: err.message 
            });
        }
    }
}

module.exports = ProduitController;