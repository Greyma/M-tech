const db = require('../config/db');

class FactureController {
    static async getAllFactures(req, res) {
        try {
            await db.testConnection();
            
            const [factures] = await db.query(`
                SELECT 
                    f.id AS facture_id,
                    c.nom AS nom_client,
                    f.prix_total,
                    f.date_creation,
                    p.id AS produit_id,
                    p.nom AS produit_nom,
                    p.prix_vente AS produit_prix_vente,
                    p.prix_achat AS produit_prix_achat,
                    af.quantite AS produit_quantite,
                    af.code_garantie,
                    af.duree_garantie
                FROM factures f
                LEFT JOIN clients c ON f.client_id = c.id
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

    static async creerFacture(conn, client_id, prix_total) {
        const [result] = await conn.query(
            "INSERT INTO factures (client_id, prix_total) VALUES (?, ?)", 
            [client_id, prix_total]
        );
        return result.insertId;
    }


    static async createFactureWithClient(req, res) {
        const { client, produits } = req.body;
        let conn;
    
        if (!client?.nom || !Array.isArray(produits) || produits.length === 0) {
            return FactureController.handleClientError(
                res, 
                "Un client (avec au moins un nom) et une liste de produits non vide sont requis"
            );
        }
    
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();
    
            // 1. Création du client
            const [clientResult] = await conn.query(
                "INSERT INTO clients (nom, email, telephone, wilaya, recommendation) VALUES (?, ?, ?, ?, ?)",
                [
                    client.nom,
                    client.email || null,
                    client.telephone || null,
                    client.wilaya || null,
                    client.recommendation || null
                ]
            );
    
            const clientId = clientResult.insertId;
    
            // 2. Vérification des produits et calcul du prix total
            const { prix_total, produitsVerifies, errors } = 
                await FactureController.verifierProduits(conn, produits);
    
            if (errors.length > 0) {
                await conn.rollback();
                return FactureController.handleClientError(res, errors.join(' '));
            }
    
            // 3. Création de la facture
            const factureId = await FactureController.creerFacture(conn, clientId, prix_total);
            
            // 4. Ajout des articles et mise à jour du stock
            await FactureController.ajouterArticlesFacture(conn, factureId, produitsVerifies);
            await FactureController.mettreAJourStocks(conn, produitsVerifies);
    
            await conn.commit();
            
            // Récupération du nom du client pour la réponse
            const clientNom = client.nom;
    
            res.status(201).json({ 
                success: true,
                message: "Facture et client créés avec succès", 
                data: { 
                    facture_id: factureId, 
                    client_id: clientId,
                    nom_client: clientNom, 
                    prix_total: Number(prix_total).toFixed(2), 
                    produits: produitsVerifies,
                    date_creation: new Date()
                } 
            });
    
        } catch (error) {
            if (conn) await conn.rollback();
            console.error("Erreur lors de la création de la facture avec client:", error);
            FactureController.handleServerError(res, error, "création de la facture avec client");
        } finally {
            if (conn) conn.release();
        }
    }

    static async createFacture(req, res) {
        const { client_id, produits } = req.body; // Retirer 'prix' car il est maintenant dans chaque produit
        let conn;
    
        if (!client_id || isNaN(client_id) || !Array.isArray(produits) || produits.length === 0) {
            return FactureController.handleClientError(
                res, 
                "Un client valide (ID numérique) et une liste de produits non vide sont requis"
            );
        }
    
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();
    
            // Vérification si le client existe
            const [clientResult] = await conn.query(
                "SELECT id, nom FROM clients WHERE id = ?", 
                [client_id]
            );
    
            if (!clientResult.length) {
                await conn.rollback();
                return FactureController.handleClientError(res, "Client introuvable");
            }
    
            const clientNom = clientResult[0].nom;
    
            // Vérification des produits et calcul du prix total
            const { prix_total, produitsVerifies, errors } = 
                await FactureController.verifierProduits(conn, produits);
    
            if (errors.length > 0) {
                await conn.rollback();
                return FactureController.handleClientError(res, errors.join(' '));
            }
    
            // Création de la facture
            const factureId = await FactureController.creerFacture(conn, client_id, prix_total);
            
            // Ajout des articles et mise à jour du stock
            await FactureController.ajouterArticlesFacture(conn, factureId, produitsVerifies);
            await FactureController.mettreAJourStocks(conn, produitsVerifies);
    
            await conn.commit();
            
            res.status(201).json({ 
                success: true,
                message: "Facture créée avec succès", 
                data: { 
                    id: factureId, 
                    nom_client: clientNom, 
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
    
    static async verifierProduits(conn, produits) {
        let prix_total = 0;
        const produitsVerifies = [];
        const errors = [];
    
        for (const produit of produits) {
                const produit_id = parseInt(produit.produit_id);
                const quantite = parseInt(produit.quantite);
                const prix = parseFloat(produit.prix);
                
                if (isNaN(produit_id) || isNaN(quantite) || quantite <= 0) {
                    errors.push("Chaque produit doit avoir un ID et une quantité valide (nombre positif)");
                    continue;
                }
        
                if (isNaN(prix) || prix <= 0) {
                    errors.push(`Prix invalide pour le produit ID ${produit_id}`);
                    continue;
                }
        
                const [stockResults] = await conn.query(
                    "SELECT id, nom, quantite FROM produits WHERE id = ?", 
                    [produit_id]
                );
        
                if (!stockResults?.length) {
                    errors.push(`Le produit avec l'ID ${produit_id} n'existe pas`);
                    continue;
                }
        
                const stock = stockResults[0];
                if (stock.quantite < quantite) {
                    errors.push(`Stock insuffisant pour le produit ${stock.nom}`);
                    continue;
                }
        
                prix_total += prix * quantite;
            
            // Validation des champs garantie
            if (produit.code_garantie && produit.code_garantie.length > 50) {
                errors.push(`Le code garantie pour le produit ${produit.produit_id} est trop long`);
            }
            
            if (produit.duree_garantie && produit.duree_garantie.length > 50) {
                errors.push(`La durée de garantie pour le produit ${produit.produit_id} est trop longue`);
            }
    
            produitsVerifies.push({ 
                produit_id, 
                quantite, 
                prix,
                code_garantie: produit.code_garantie || null,
                duree_garantie: produit.duree_garantie || null,
                nom: stock.nom,
                prix_original: stock.prix_vente
            });
        }
    
        return { prix_total, produitsVerifies, errors };
    }

    static async ajouterArticlesFacture(conn, factureId, produits) {
        if (!produits.length) return;
    
        const articlesData = produits.map(p => [
            factureId, 
            p.produit_id, 
            p.prix, 
            p.quantite,
            p.code_garantie || null,  // Nouveau champ
            p.duree_garantie || null // Nouveau champ
        ]);
    
        await conn.query(
            `INSERT INTO articles_facture 
            (facture_id, produit_id, prix, quantite, code_garantie, duree_garantie) 
            VALUES ?`,
            [articlesData]
        );
    }

    static async mettreAJourStocks(conn, produits) {
        await Promise.all(produits.map(async produit => {
            // Vérifier le stock avant modification
            const [[{ quantite }] = []] = await conn.query(
                "SELECT quantite FROM produits WHERE id = ?", [produit.produit_id]
            );

            if (quantite < produit.quantite) {
                throw new Error(`Stock insuffisant pour le produit ID: ${produit.produit_id}`);
            }

            // Mise à jour du stock
            await conn.query(
                "UPDATE produits SET quantite = quantite - ? WHERE id = ?", 
                [produit.quantite, produit.produit_id]
            );
        }));
    }

    static async recupererArticlesFacture(conn, factureId) {
        if (!factureId) throw new Error("Facture ID invalide");

        const [articles] = await conn.query(
            "SELECT produit_id, quantite FROM articles_facture WHERE facture_id = ?",
            [factureId]
        );
        return articles;
    }

    static async restaurerStocks(conn, articles) {
        await Promise.all(articles.map(async ({ produit_id, quantite }) => {
            const [[exists] = []] = await conn.query(
                "SELECT id FROM produits WHERE id = ?", [produit_id]
            );

            if (!exists) {
                throw new Error(`Produit ID ${produit_id} introuvable lors de la restauration du stock`);
            }

            await conn.query(
                "UPDATE produits SET quantite = quantite + ? WHERE id = ?",
                [quantite, produit_id]
            );
        }));
    }

    static async supprimerArticlesFacture(conn, factureId) {
        await conn.query(
            "DELETE FROM articles_facture WHERE facture_id = ?",
            [factureId]
        );
    }

    static async supprimerFacture(conn, factureId) {
        // Vérifier si la facture existe
        const [[facture] = []] = await conn.query(
            "SELECT id FROM factures WHERE id = ?", [factureId]
        );
        if (!facture) {
            throw new Error("Facture non trouvée");
        }

        // Supprimer d'abord les articles liés
        await FactureController.supprimerArticlesFacture(conn, factureId);

        // Supprimer ensuite la facture
        const [result] = await conn.query(
            "DELETE FROM factures WHERE id = ?", [factureId]
        );

        if (!result.affectedRows) {
            throw new Error("Erreur lors de la suppression de la facture");
        }
    }

    static formatProduitFacture(row) {
        const quantite = Number(row.produit_quantite) || 0;
        const prixVente = Number(row.produit_prix_vente) || 0;
        const prixAchat = Number(row.produit_prix_achat) || 0;
    
        return {
            id: row.produit_id,
            nom: row.produit_nom,
            quantite,
            prix_vente: prixVente.toFixed(2),
            prix_achat: prixAchat.toFixed(2),
            prix_total: (prixVente * quantite).toFixed(2),
            code_garantie: row.code_garantie,
            duree_garantie: row.duree_garantie
        };
    }
    
}
module.exports = FactureController;
