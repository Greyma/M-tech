const db = require('../config/db');

class CategorieController {
    static async getAllCategories(req, res) {
        try {
            const [results] = await db.query(
                "SELECT id, nom, created_at FROM categories"
            );

            if (results.length === 0) {
                return res.status(404).json({ 
                    message: "Aucune catégorie trouvée" 
                });
            }

            const categories = results.map(cat => ({
                id: cat.id,
                nom: cat.nom,
                date: cat.created_at
            }));

            res.status(200).json({ 
                data: categories, 
                message: "success" 
            });
        } catch (err) {
            console.error("Erreur dans la récupération des catégories:", err);
            res.status(500).json({ 
                message: "Erreur serveur", 
                error: err.message 
            });
        }
    }

    static async createCategorie(req, res) {
        const { nom } = req.body;

        if (!nom) {
            return res.status(400).json({ 
                message: "Le nom est requis" 
            });
        }

        try {
            const [results] = await db.query(
                "INSERT INTO categories (nom, created_at) VALUES (?, NOW())",
                [nom]
            );

            res.status(201).json({
                data: { 
                    id: results.insertId, 
                    nom 
                },
                message: "Catégorie créée avec succès"
            });
        } catch (err) {
            console.error("Erreur lors de la création de catégorie:", err);
            res.status(500).json({ 
                message: "Erreur serveur", 
                error: err.message 
            });
        }
    }

    static async updateCategorie(req, res) {
        const { nom } = req.body;
        const id = req.params.id;

        if (!nom) {
            return res.status(400).json({ 
                message: "Le nom est requis" 
            });
        }

        try {
            const [results] = await db.query(
                "UPDATE categories SET nom = ?, updated_at = NOW() WHERE id = ?",
                [nom, id]
            );

            if (results.affectedRows === 0) {
                return res.status(404).json({ 
                    message: "Catégorie non trouvée" 
                });
            }

            res.status(200).json({
                data: { 
                    id, 
                    nom 
                },
                message: "Catégorie mise à jour avec succès"
            });
        } catch (err) {
            console.error("Erreur lors de la mise à jour de catégorie:", err);
            res.status(500).json({ 
                message: "Erreur serveur", 
                error: err.message 
            });
        }
    }

    static async deleteCategorie(req, res) {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id)) {
            return res.status(400).json({ 
                message: "ID invalide" 
            });
        }

        try {
            const [results] = await db.query(
                "DELETE FROM categories WHERE id = ?",
                [id]
            );

            if (results.affectedRows === 0) {
                return res.status(404).json({ 
                    message: "Catégorie non trouvée" 
                });
            }

            res.status(200).json({ 
                message: "Catégorie supprimée avec succès" 
            });
        } catch (err) {
            console.error("Erreur lors de la suppression de catégorie:", err);
            res.status(500).json({ 
                message: "Erreur serveur", 
                error: err.message 
            });
        }
    }
}

module.exports = CategorieController;