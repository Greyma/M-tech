const db = require('../config/db');

class FactureController {
    static async getAllFactures(req, res) {
        try {
            await db.testConnection();
            
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
                ORDER BY f.date_creation DESC
            `);

            if (!factures?.length) {
                return FactureController.handleNotFound(res, "Aucune facture trouvée");
            }

            const facturesMap = factures.reduce((acc, row) => {
                const factureId = row.facture_id;
                
                if (!acc[factureId]) {
                    acc[factureId] = { 
                        id: factureId, 
                        nom_client: row.nom_client, 
                        prix_total: Number(row.prix_total).toFixed(2),
                        date_creation: row.date_creation, 
                        produits: [] 
                    };
                }

                if (row.produit_id) {
                    acc[factureId].produits.push(FactureController.formatProduitFacture(row));
                }

                return acc;
            }, {});

            res.status(200).json({
                success: true,
                message: "Factures récupérées avec succès",
                data: Object.values(facturesMap),
                count: Object.keys(facturesMap).length
            });

        } catch (err) {
            console.error("Erreur lors de la récupération des factures:", err);
            FactureController.handleServerError(res, err, "récupération des factures");
        }
    }

    static async createFacture(req, res) {
        const { nom_client, produits } = req.body;
        let conn;

        // Validation des données
        if (!nom_client || typeof nom_client !== 'string' || nom_client.trim() === '' ||
            !Array.isArray(produits) || produits.length === 0) {
            return FactureController.handleClientError(
                res, 
                "Le nom du client (chaîne non vide) et une liste de produits non vide sont requis"
            );
        }

        try {
            conn = await db.getConnection();
            await conn.beginTransaction();

            // Vérification et calcul du prix total
            const { prix_total, produitsVerifies, errors } = 
                await FactureController.verifierProduits(conn, produits);

            if (errors.length > 0) {
                await conn.rollback();
                return FactureController.handleClientError(res, errors.join(' '));
            }

            // Création de la facture
            const factureId = await FactureController.creerFacture(conn, nom_client.trim(), prix_total);
            
            // Ajout des articles et mise à jour du stock
            await FactureController.ajouterArticlesFacture(conn, factureId, produitsVerifies);
            await FactureController.mettreAJourStocks(conn, produitsVerifies);

            await conn.commit();
            
            res.status(201).json({ 
                success: true,
                message: "Facture créée avec succès", 
                data: { 
                    id: factureId, 
                    nom_client: nom_client.trim(), 
                    prix_total: Number(prix_total).toFixed(2), 
                    produits: produitsVerifies,
                    date_creation: new Date()
                } 
            });

        } catch (error) {
            if (conn) await conn.rollback();
            console.error("Erreur lors de la création de la facture:", error);
            FactureController.handleServerError(res, error, "création de la facture");
        } finally {
            if (conn) conn.release();
        }
    }

    static async deleteFacture(req, res) {
        const factureId = parseInt(req.params.id, 10);
        let conn;

        if (isNaN(factureId)) {
            return FactureController.handleClientError(res, "ID de facture invalide");
        }

        try {
            conn = await db.getConnection();
            await conn.beginTransaction();

            const articles = await FactureController.recupererArticlesFacture(conn, factureId);
            
            if (!articles?.length) {
                await conn.rollback();
                return FactureController.handleNotFound(res, "Facture introuvable ou déjà supprimée");
            }

            await FactureController.restaurerStocks(conn, articles);
            await FactureController.supprimerArticlesFacture(conn, factureId);
            await FactureController.supprimerFacture(conn, factureId);

            await conn.commit();
            
            res.status(200).json({ 
                success: true,
                message: `Facture ${factureId} supprimée avec succès`
            });

        } catch (error) {
            if (conn) await conn.rollback();
            console.error("Erreur lors de la suppression de la facture:", error);
            FactureController.handleServerError(res, error, "suppression de la facture");
        } finally {
            if (conn) conn.release();
        }
    }

    // Méthodes utilitaires
    static async verifierProduits(conn, produits) {
        let prix_total = 0;
        const produitsVerifies = [];
        const errors = [];

        for (const produit of produits) {
            const produit_id = parseInt(produit.produit_id);
            const quantite = parseInt(produit.quantite);
            
            if (isNaN(produit_id) || isNaN(quantite) || quantite <= 0) {
                errors.push("Chaque produit doit avoir un ID et une quantité valide (nombre positif)");
                continue;
            }

            const [stockResults] = await conn.query(
                "SELECT id, nom, quantite, prix_vente FROM produits WHERE id = ?", 
                [produit_id]
            );

            if (!stockResults?.length) {
                errors.push(`Le produit avec l'ID ${produit_id} n'existe pas`);
                continue;
            }

            const stock = stockResults[0];
            if (stock.quantite < quantite) {
                errors.push(`Stock insuffisant pour ${stock.nom} (dispo: ${stock.quantite})`);
                continue;
            }

            produitsVerifies.push({ 
                produit_id, 
                quantite, 
                prix_vente: Number(stock.prix_vente), 
                nom: stock.nom 
            });
            prix_total += stock.prix_vente * quantite;
        }

        return { prix_total, produitsVerifies, errors };
    }

    static async creerFacture(conn, nom_client, prix_total) {
        const [factureResult] = await conn.query(
            "INSERT INTO factures (nom_client, prix_total, date_creation) VALUES (?, ?, NOW())", 
            [nom_client, prix_total]
        );
        return factureResult.insertId;
    }

    static async ajouterArticlesFacture(conn, factureId, produits) {
        const articlesData = produits.map(p => [factureId, p.produit_id, p.quantite]);
        await conn.query(
            "INSERT INTO articles_facture (facture_id, produit_id, quantite) VALUES ?", 
            [articlesData]
        );
    }

    static async mettreAJourStocks(conn, produits) {
        await Promise.all(produits.map(produit => 
            conn.query(
                "UPDATE produits SET quantite = quantite - ? WHERE id = ?", 
                [produit.quantite, produit.produit_id]
            )
        ));
    }

    static async recupererArticlesFacture(conn, factureId) {
        const [articles] = await conn.query(
            'SELECT produit_id, quantite FROM articles_facture WHERE facture_id = ?',
            [factureId]
        );
        return articles;
    }

    static async restaurerStocks(conn, articles) {
        await Promise.all(articles.map(({ produit_id, quantite }) => 
            conn.query(
                'UPDATE produits SET quantite = quantite + ? WHERE id = ?',
                [quantite, produit_id]
            )
        ));
    }

    static async supprimerArticlesFacture(conn, factureId) {
        await conn.query(
            'DELETE FROM articles_facture WHERE facture_id = ?',
            [factureId]
        );
    }

    static async supprimerFacture(conn, factureId) {
        const [result] = await conn.query(
            'DELETE FROM factures WHERE id = ?',
            [factureId]
        );
        if (!result.affectedRows) {
            throw new Error("Facture non trouvée lors de la suppression");
        }
    }

    static formatProduitFacture(row) {
        return {
            id: row.produit_id,
            nom: row.produit_nom,
            quantite: Number(row.produit_quantite),
            prix_vente: Number(row.produit_prix_vente).toFixed(2),
            prix_achat: Number(row.produit_prix_achat).toFixed(2),
            prix_total: Number(row.produit_prix_vente * row.produit_quantite).toFixed(2)
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

module.exports = FactureController;