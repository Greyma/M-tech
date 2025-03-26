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

            if (!produits || produits.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    message: "Aucun produit trouvé",
                    data: []
                });
            }

            const formattedProduits = produits.map(p => ({
                id: p.id,
                nom: p.nom || '',
                marque: p.marque || '',
                description: p.description || '',
                processeur: p.processeur || '',
                ram: p.ram || '',
                stockage: p.stockage || '',
                gpu: p.gpu || '',
                batterie: p.batterie || '',
                ecran_tactile: Boolean(p.ecran_tactile),
                ecran_type: p.ecran_type || '',
                code_amoire: p.code_amoire || '',
                reference: p.reference || '',
                etat: p.etat || 'neuf',
                prix_achat: Number(p.prix_achat) || 0,
                prix_vente: Number(p.prix_vente) || 0,
                quantite: Number(p.quantite) || 0,
                categorie_id: p.categorie_id || null,
                categorie_nom: p.categorie_nom || '',
                image: p.image ? JSON.parse(p.image) : []
            }));

            res.status(200).json({ 
                success: true,
                message: "Produits récupérés avec succès",
                data: formattedProduits,
                count: formattedProduits.length
            });

        } catch (err) {
            console.error('Erreur dans getAllProduits:', err);
            res.status(500).json({ 
                success: false,
                message: "Erreur lors de la récupération des produits",
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }

    static async getProduitById(req, res) {
        try {
            const produitId = parseInt(req.params.id, 10);
            if (isNaN(produitId)) {
                return res.status(400).json({ 
                    success: false,
                    message: "ID invalide" 
                });
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
                return res.status(404).json({ 
                    success: false,
                    message: "Produit non trouvé" 
                });
            }

            const p = produit[0];
            const result = {
                id: p.id,
                nom: p.nom || '',
                marque: p.marque || '',
                description: p.description || '',
                processeur: p.processeur || '',
                ram: p.ram || '',
                stockage: p.stockage || '',
                gpu: p.gpu || '',
                batterie: p.batterie || '',
                ecran_tactile: Boolean(p.ecran_tactile),
                ecran_type: p.ecran_type || '',
                code_amoire: p.code_amoire || '',
                reference: p.reference || '',
                etat: p.etat || 'neuf',
                prix_achat: Number(p.prix_achat) || 0,
                prix_vente: Number(p.prix_vente) || 0,
                quantite: Number(p.quantite) || 0,
                categorie_id: p.categorie_id || null,
                categorie_nom: p.categorie_nom || '',
                image: p.image ? JSON.parse(p.image) : []
            };

            res.status(200).json({
                success: true,
                message: "Produit récupéré avec succès",
                data: result
            });
        } catch (err) {
            console.error("Erreur lors de la récupération du produit :", err);
            res.status(500).json({ 
                success: false,
                message: "Erreur serveur",
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }

    static async createProduit(req, res) {
        try {
            const {
                nom,
                marque,
                description,
                processeur,
                ram,
                stockage,
                gpu,
                batterie,
                ecran_tactile,
                ecran_type,
                code_amoire,
                reference,
                etat,
                prix_achat,
                prix_vente,
                quantite,
                categorie_id
            } = req.body;
    
            // Validation des champs obligatoires
            if (!nom || !prix_achat || !prix_vente || !quantite || !categorie_id) {
                return res.status(400).json({
                    success: false,
                    message: "Les champs nom, prix_achat, prix_vente, quantite et categorie_id sont obligatoires"
                });
            }
    
            // Traitement des images
            const imagePaths = FileService.processUploadedFiles(req.files);
    
            const [results] = await db.query(
                `INSERT INTO produits SET ?`,
                {
                    nom,
                    marque,
                    description,
                    processeur,
                    ram,
                    stockage,
                    gpu,
                    batterie,
                    ecran_tactile: ecran_tactile === 'true',
                    ecran_type,
                    code_amoire,
                    reference,
                    etat: etat || 'neuf',
                    prix_achat,
                    prix_vente,
                    quantite,
                    categorie_id,
                    image: JSON.stringify(imagePaths)
                }
            );
    
            res.status(201).json({
                success: true,
                message: "Produit créé avec succès",
                data: {
                    id: results.insertId,
                    ...req.body,
                    image: imagePaths,
                    ecran_tactile: ecran_tactile === 'true'
                }
            });
        } catch (error) {
            console.error("Erreur création produit:", error);
            res.status(500).json({
                success: false,
                message: "Erreur serveur",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
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
    
            const [results] = await db.query(
                `UPDATE produits SET ? WHERE id = ?`,
                [updates, produitId]
            );
    
            if (results.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Produit non trouvé"
                });
            }
    
            // Récupérer le produit mis à jour pour le retourner
            const [updatedProduit] = await db.query(
                `SELECT * FROM produits WHERE id = ?`,
                [produitId]
            );
    
            res.json({
                success: true,
                message: "Produit mis à jour avec succès",
                data: {
                    ...updatedProduit[0],
                    image: updatedProduit[0].image ? JSON.parse(updatedProduit[0].image) : []
                }
            });
        } catch (error) {
            console.error("Erreur mise à jour produit:", error);
            res.status(500).json({
                success: false,
                message: "Erreur serveur",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    static async deleteProduit(req, res) {
        try {
            const produitId = req.params.id;
            if (!produitId) {
                return res.status(400).json({ 
                    success: false,
                    message: "ID du produit manquant" 
                });
            }

            // Vérifier d'abord si le produit existe
            const [produit] = await db.query(
                `SELECT id, image FROM produits WHERE id = ?`,
                [produitId]
            );

            if (!produit || produit.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    message: "Produit non trouvé" 
                });
            }

            // Supprimer les images associées si elles existent
            if (produit[0].image) {
                const images = JSON.parse(produit[0].image);
                for (const imagePath of images) {
                    await FileService.deleteFile(imagePath);
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
            res.status(500).json({ 
                success: false,
                message: "Erreur serveur lors de la suppression", 
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
}

module.exports = ProduitController;