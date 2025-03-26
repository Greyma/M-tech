const db = require('../config/db');

class FactureController {
    static async getAllFactures(req, res) {
        try {
            const [factures] = await db.query(`
                SELECT 
                    f.id AS facture_id,
                    f.nom_client,
                    f.prix_total,
                    f.date_creation,
                    p.id AS produit_id,
                    p.nom AS produit_nom,
                    p.prix_vente AS produit_prix_vente,
                    p.prix_achat AS produit_prix_achat,
                    af.quantite AS produit_quantite
                FROM factures f
                LEFT JOIN articles_facture af ON f.id = af.facture_id
                LEFT JOIN produits p ON af.produit_id = p.id
            `);

            const facturesMap = {};
            factures.forEach(row => {
                const factureId = row.facture_id;
                if (!facturesMap[factureId]) {
                    facturesMap[factureId] = { 
                        id: factureId, 
                        nom_client: row.nom_client, 
                        prix_total: row.prix_total, 
                        date_creation: row.date_creation, 
                        produits: [] 
                    };
                }
                if (row.produit_id) {
                    facturesMap[factureId].produits.push({
                        id: row.produit_id, 
                        nom: row.produit_nom, 
                        quantite: row.produit_quantite,
                        prix_vente: row.produit_prix_vente, 
                        prix_achat: row.produit_prix_achat,
                        prix_total: (row.produit_prix_vente * row.produit_quantite).toFixed(2)
                    });
                }
            });

            res.status(200).json(Object.values(facturesMap));
        } catch (err) {
            console.error("Erreur lors de la récupération des factures:", err);
            res.status(500).json({ 
                message: "Erreur serveur", 
                error: err.message 
            });
        }
    }

    static async createFacture(req, res) {
        const { nom_client, produits } = req.body;
        
        // Validation des données
        if (!nom_client || !Array.isArray(produits) || produits.length === 0) {
            return res.status(400).json({ 
                message: "Le nom du client et les produits sont requis" 
            });
        }

        let conn;
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();

            let prix_total = 0;
            const produitsVerifies = [];

            // Vérification des produits
            for (const produit of produits) {
                const { produit_id, quantite } = produit;
                
                if (!produit_id || quantite <= 0) {
                    await conn.rollback();
                    return res.status(400).json({ 
                        message: "Chaque produit doit avoir un ID et une quantité valide" 
                    });
                }

                const [stockResults] = await conn.query(
                    "SELECT nom, quantite, prix_vente FROM produits WHERE id = ?", 
                    [produit_id]
                );

                if (stockResults.length === 0) {
                    await conn.rollback();
                    return res.status(404).json({ 
                        message: `Le produit avec l'ID ${produit_id} n'existe pas.` 
                    });
                }

                const stock = stockResults[0];
                if (stock.quantite < quantite) {
                    await conn.rollback();
                    return res.status(400).json({ 
                        message: `Le produit ${stock.nom} n'a pas assez de stock.` 
                    });
                }

                produitsVerifies.push({ 
                    produit_id, 
                    quantite, 
                    prix_vente: stock.prix_vente, 
                    nom: stock.nom 
                });
                prix_total += stock.prix_vente * quantite;
            }

            // Création de la facture
            const [factureResult] = await conn.query(
                "INSERT INTO factures (nom_client, prix_total, date_creation) VALUES (?, ?, NOW())", 
                [nom_client, prix_total]
            );
            const factureId = factureResult.insertId;

            // Ajout des articles de facture
            const articlesData = produitsVerifies.map(p => [factureId, p.produit_id, p.quantite]);
            await conn.query(
                "INSERT INTO articles_facture (facture_id, produit_id, quantite) VALUES ?", 
                [articlesData]
            );

            // Mise à jour du stock
            for (const produit of produitsVerifies) {
                await conn.query(
                    "UPDATE produits SET quantite = quantite - ? WHERE id = ?", 
                    [produit.quantite, produit.produit_id]
                );
            }

            await conn.commit();
            
            res.status(201).json({ 
                message: "Facture créée avec succès", 
                data: { 
                    factureId, 
                    nom_client, 
                    prix_total, 
                    produits: produitsVerifies 
                } 
            });
        } catch (error) {
            if (conn) await conn.rollback();
            console.error("Erreur lors de la création de la facture:", error);
            res.status(500).json({ 
                message: "Erreur serveur", 
                error: error.message 
            });
        } finally {
            if (conn) conn.release();
        }
    }

    static async deleteFacture(req, res) {
        const factureId = req.params.id;
        let conn;

        try {
            conn = await db.getConnection();
            await conn.beginTransaction();

            // 1. Récupérer les articles liés à la facture
            const [articles] = await conn.query(
                'SELECT produit_id, quantite FROM articles_facture WHERE facture_id = ?',
                [factureId]
            );

            if (articles.length === 0) {
                return res.status(404).json({ 
                    message: "Facture introuvable ou déjà supprimée" 
                });
            }

            // 2. Réapprovisionner les produits
            for (const { produit_id, quantite } of articles) {
                await conn.query(
                    'UPDATE produits SET quantite = quantite + ? WHERE id = ?',
                    [quantite, produit_id]
                );
            }

            // 3. Supprimer les articles de la facture
            await conn.query(
                'DELETE FROM articles_facture WHERE facture_id = ?',
                [factureId]
            );

            // 4. Supprimer la facture
            await conn.query(
                'DELETE FROM factures WHERE id = ?',
                [factureId]
            );

            await conn.commit();
            res.status(200).json({ 
                message: `Facture ${factureId} supprimée avec succès.` 
            });
        } catch (error) {
            if (conn) await conn.rollback();
            console.error("Erreur lors de la suppression de la facture:", error);
            res.status(500).json({ 
                message: "Erreur lors de la suppression de la facture.",
                error: error.message
            });
        } finally {
            if (conn) conn.release();
        }
    }
}

module.exports = FactureController;