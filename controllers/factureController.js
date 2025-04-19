const db = require('../config/db');
const { generateBarcode, decodeBarcode } = require('./barcode');
const path = require('path');
const fs = require('fs').promises;

async function generateFactureId() {
    const prefix = 'FAC';
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    let conn;
  
    try {
      conn = await db.getConnection();
      
      const [rows] = await conn.execute(
        'SELECT COUNT(*) AS count FROM factures WHERE id LIKE ?',
        [`${prefix}${datePart}%`]
      );
  
      const count = (rows[0]?.count || 0) + 1;
      const countPart = String(count).padStart(4, '0');
  
      return `${prefix}${datePart}${countPart}`;
    } catch (error) {
      console.error('Erreur lors de la génération de l\'ID de facture:', error);
      
      // Fallback en cas d'erreur avec la base de données
      const randomPart = Math.floor(Math.random() * 9000 + 1000).toString();
      return `${prefix}${datePart}${randomPart}`;
    } finally {
      if (conn) conn.release();
    }
  }

class FactureController {
    
    static async getAllFactures(req, res) {
        try {
            await db.testConnection();
            
            const factures = await db.query(`
                SELECT 
                    f.id AS facture_id,
                    c.nom AS nom_client,
                    c.email AS email_client,
                    c.telephone AS telephone_client,
                    c.wilaya AS wilaya_client,
                    c.recommendation AS recommandation_client,
                    f.prix_total,
                    f.date_creation,
                    f.sale_type,
                    f.sale_mode,
                    f.delivery_provider,
                    f.delivery_price,
                    f.delivery_code,
                    f.installment_remark,
                    f.comment,
                    f.status,
                    p.id AS produit_id,
                    p.nom AS produit_nom,
                    af.prix AS produit_prix_vente,
                    p.prix_vente AS produit_prix_original,
                    af.quantite AS produit_quantite,
                    af.code_garantie,
                    af.duree_garantie
                FROM factures f
                LEFT JOIN clients c ON f.client_id = c.id
                LEFT JOIN articles_facture af ON f.id = af.facture_id
                LEFT JOIN produits p ON af.produit_id = p.id
                ORDER BY f.date_creation DESC
            `);
        
            const rows = Array.isArray(factures[0]) ? factures[0] : factures;
            
            if (!rows?.length) {
                return FactureController.handleNotFound(res, "Aucune facture trouvée");
            }
    
            const factureIds = [...new Set(rows.map(row => row.facture_id))];
           
            const placeholders = factureIds.map(() => '?').join(', ');
            
            // Utiliser une connexion explicite
            const connection = await db.pool.getConnection();
            try {
                const [payment_methods, fields] = await connection.execute(
                    `
                    SELECT 
                        pm.id AS payment_method_id,
                        pm.facture_id,
                        pm.method,
                        i.id AS installment_id,
                        i.amount,
                        i.date,
                        i.pdf_file
                    FROM payment_methods pm
                    LEFT JOIN installments i ON pm.id = i.payment_method_id
                    WHERE pm.facture_id IN (${placeholders})
                    ORDER BY pm.facture_id, pm.method, i.date
                    `,
                    factureIds
                );

                
                
                const normalizedRows = Array.isArray(payment_methods) ? payment_methods : payment_methods ? [payment_methods] : [];
        
                if (!normalizedRows.length) {
                    console.warn('[WARN] Aucune méthode de paiement trouvée.');
                }
        
                const paymentsByInvoice = {};
        
                normalizedRows.forEach(row => {
                    if (!row.facture_id) return;
        
                    if (!paymentsByInvoice[row.facture_id]) {
                        paymentsByInvoice[row.facture_id] = [];
                    }
        
                    let paymentMethod = paymentsByInvoice[row.facture_id]
                        .find(pm => pm.method === row.method);
        
                    if (!paymentMethod) {
                        paymentMethod = {
                            method: row.method,
                            installments: []
                        };
                        paymentsByInvoice[row.facture_id].push(paymentMethod);
                    }
        
                    if (row.installment_id) {
                        paymentMethod.installments.push({
                            amount: row.amount ? Number(row.amount).toFixed(2) : '0.00',
                            date: row.date || null,
                            pdf_file: row.pdf_file || null
                        });
                    }
                });
        
                
                const payments = paymentsByInvoice;
        
                const facturesMap = rows.reduce((acc, row) => {
                    const factureId = row.facture_id;
                    
                    if (!acc[factureId]) {
                        acc[factureId] = { 
                            id: factureId, 
                            client: {
                                nom: row.nom_client || 'Client inconnu',
                                email: row.email_client || null,
                                telephone: row.telephone_client || null,
                                wilaya: row.wilaya_client || null,
                                recommandation: row.recommandation_client || null 
                            },
                            prix_total: Number(row.prix_total || 0).toFixed(2),
                            date_creation: row.date_creation,
                            sale_type: row.sale_type || 'comptoir',
                            sale_mode: row.sale_mode || 'direct',
                            delivery: {
                                provider: row.delivery_provider,
                                price: row.delivery_price ? Number(row.delivery_price).toFixed(2) : null,
                                code: row.delivery_code
                            },
                            installment_remark: row.installment_remark,
                            comment: row.comment,
                            status: row.status || 'pending',
                            payment_methods: payments[factureId] || [],
                            produits: [] 
                        };
                    }
        
                    if (row.produit_id) {
                        acc[factureId].produits.push(FactureController.formatProduitFacture(row));
                    }
        
                    return acc;
                }, {});
                
                const formattedFactures = Object.values(facturesMap);
        
                res.status(200).json({
                    success: true,
                    message: "Factures récupérées avec succès",
                    data: formattedFactures,
                    count: formattedFactures.length
                });
            } finally {
                connection.release();
            }
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

    static async creerFacture(conn, factureData) {
        const id = await generateFactureId();
        const query = `
            INSERT INTO factures (
                id, client_id, prix_total, sale_type, sale_mode, 
                delivery_provider, delivery_price, delivery_code, 
                installment_remark, comment,status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
        `;
        
        const params = [
            id,
            factureData.client_id,
            factureData.prix_total,
            factureData.sale_type || 'comptoir',
            factureData.sale_mode || 'direct',
            factureData.delivery_provider || null,
            factureData.delivery_price || 0,
            factureData.delivery_code || null,
            factureData.installment_remark || null,
            factureData.comment || null, 
            factureData.status || 'pending'
        ];
    
        try {
            const [result] = await conn.query(query, params);
            return { factureId: id, insertId: result.insertId };
        } catch (error) {
            console.error('Erreur lors de la création de la facture:', {
                query,
                params,
                error
            });
            throw error;
        }
    }
    
    static async ajouterMethodesPaiement(conn, factureId, paymentMethods, req) {
        // Créer le répertoire si nécessaire
        const uploadDir = path.join(__dirname, '../uploads/PDFs');
        await fs.mkdir(uploadDir, { recursive: true });

        // Récupérer les fichiers traités depuis req.processedFiles
        const processedFiles = req.processedFiles || [];

        
        for (const method of paymentMethods) {
            const [methodResult] = await conn.query(
            "INSERT INTO payment_methods (facture_id, method) VALUES (?, ?)",
            [factureId, method.method || 'cash']
            );

            
           
            if (method.installments && method.installments.length > 0) {
            for (const [index, installment] of method.installments.entries()) {
                let pdfPath = null;

                // Associer un fichier PDF si disponible
                if (installment.pdfFile && processedFiles.length > 0) {
                // Trouver le fichier par fieldname ou index
                const file = processedFiles.find(
                    f => f.originalname === installment.pdfFile || f.fieldname === `installment-${index}`
                );
                if (file) {
                    pdfPath = file.path;
                }
                }

                await conn.query(
                "INSERT INTO installments (payment_method_id, amount, date, pdf_file) VALUES (?, ?, ?, ?)",
                [
                    methodResult.insertId,
                    installment.amount,
                    installment.date || null,
                    pdfPath
                ]
                );
            }

            // Mettre à jour le statut si des versements sont ajoutés
            await this.updatePaymentStatus(conn, methodResult.insertId);
            }
        }
    } 

    static async ajouterVersement(req, res) {
        const factureId = req.params.id;
            const { payment_method_id, amount, date, pdf_file } = req.body;
            let conn;

            try {
                conn = await db.getConnection();
                await conn.beginTransaction();

                // Ajouter le versement
                await conn.query(
                    "INSERT INTO installments (payment_method_id, amount, date, pdf_file) VALUES (?, ?, ?, ?)",
                    [payment_method_id, amount, date || new Date(), pdf_file || null]
                );

                // Mettre à jour le statut du paiement
                await FactureController.updatePaymentStatus(conn, payment_method_id);

                await conn.commit();

                res.status(200).json({
                    success: true,
                    message: "Versement ajouté avec succès"
                });

            } catch (error) {
                if (conn) await conn.rollback();
                console.error("Erreur lors de l'ajout du versement:", error);
                FactureController.handleServerError(res, error, "ajout du versement");
            } finally {
                if (conn) conn.release();
            } 
        }


            // Nouvelle méthode pour mettre à jour le statut de paiement
        static async updatePaymentStatus(conn, paymentMethodId) {
            // Récupérer le total de la facture associée
            const [paymentData] = await conn.query(`
                SELECT f.prix_total, pm.method, 
                    SUM(i.amount) as paid_amount
                FROM payment_methods pm
                JOIN factures f ON pm.facture_id = f.id
                LEFT JOIN installments i ON pm.id = i.payment_method_id
                WHERE pm.id = ?
                GROUP BY pm.id
            `, [paymentMethodId]);
            
            if (!paymentData.length) return;
            
            const { prix_total, method, paid_amount } = paymentData[0];
            const totalPaid = parseFloat(paid_amount || 0);
            const totalAmount = parseFloat(prix_total);
            
            let newStatus = 'pending';
            
            if (method === 'cash' && totalPaid >= totalAmount) {
                newStatus = 'completed';
            } else if (totalPaid >= totalAmount) {
                newStatus = 'completed';
            } else if (totalPaid > 0) {
                newStatus = 'partial';
            }
            
            await conn.query(
                "UPDATE payment_methods SET status = ? WHERE id = ?",
                [newStatus, paymentMethodId]
            );
        }

    static async getFacturePaymentStatus(conn, factureId) {
        const [results] = await conn.query(`
            SELECT 
                SUM(i.amount) as total_paid,
                f.prix_total as total_amount,
                GROUP_CONCAT(pm.status) as statuses
            FROM factures f
            LEFT JOIN payment_methods pm ON f.id = pm.facture_id
            LEFT JOIN installments i ON pm.id = i.payment_method_id
            WHERE f.id = ?
            GROUP BY f.id
        `, [factureId]);
    
        if (!results.length) return 'pending';
    
        const { total_paid, total_amount, statuses } = results[0];
        const paid = parseFloat(total_paid || 0);
        const total = parseFloat(total_amount);
    
        if (paid >= total) return 'validé';
        if (paid > 0) return 'retour';
        return 'en cours';
    }
    
    static async createFactureWithClient(req, res) {
        let client, produits, paymentMethods;
        try {
            client = req.body.client ? JSON.parse(req.body.client) : {};
            produits = req.body.produits ? JSON.parse(req.body.produits) : [];
            paymentMethods = req.body.paymentMethods ? JSON.parse(req.body.paymentMethods) : [];
        } catch (parseError) {
            console.error('[ERREUR] Échec du parsing des champs FormData:', parseError);
            return FactureController.handleClientError(res, "Champs FormData invalides ou mal formés");
        }

        const saleType = req.body.saleType || 'comptoir';
        const saleMode = req.body.saleMode || 'direct';
        const deliveryProvider = req.body.deliveryProvider || null;
        const deliveryPrice = req.body.deliveryPrice || 0;
        const deliveryCode = req.body.deliveryCode || null;
        const installmentRemark = req.body.installmentRemark || null;
        const comment = req.body.comment || null;

        let conn;
    
        if (!client?.nom || !Array.isArray(produits) || produits.length === 0) {
            console.log('[DEBUG] Validation échouée:', { client, produits });
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
                    client.recommandation || null
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
    
            // 3. Création de la facture avec les nouvelles données
            const factureData = {
                client_id: clientId,
                prix_total: prix_total,
                sale_type: saleType || 'comptoir',
                sale_mode: saleMode || 'direct',
                delivery_provider: deliveryProvider,
                delivery_price: deliveryPrice || 0,
                delivery_code: deliveryCode,
                installment_remark: installmentRemark,
                comment: comment
            };
    
            const { factureId } = await FactureController.creerFacture(conn, factureData);
            
            // 4. Ajout des méthodes de paiement
            if (paymentMethods && paymentMethods.length > 0) {
                await FactureController.ajouterMethodesPaiement(conn, factureId, paymentMethods, req);
            }
    
            // 5. Ajout des articles et mise à jour du stock
            await FactureController.ajouterArticlesFacture(conn, factureId, produitsVerifies);
            await FactureController.mettreAJourStocks(conn, produitsVerifies);
    
            await conn.commit();
            
            // Récupération des détails de la facture
            const [factureDetails] = await conn.query(
                "SELECT date_creation FROM factures WHERE id = ?", 
                [factureId]
            );
    
            res.status(201).json({ 
                success: true,
                message: "Facture et client créés avec succès", 
                data: { 
                    facture_id: factureId, 
                    client_id: clientId,
                    nom_client: client.nom, 
                    prix_total: Number(prix_total).toFixed(2), 
                    produits: produitsVerifies,
                    date_creation: factureDetails[0].date_creation,
                    sale_type: saleType,
                    sale_mode: saleMode,
                    payment_methods: paymentMethods || []
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
        const { client_id, produits, saleType, saleMode, deliveryProvider, deliveryPrice, deliveryCode, installmentRemark, paymentMethods, comment } = req.body;
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
    
            // Création de la facture avec les nouvelles données
            const factureData = {
                client_id: client_id,
                prix_total: prix_total,
                sale_type: saleType || 'comptoir',
                sale_mode: saleMode || 'direct',
                delivery_provider: deliveryProvider,
                delivery_price: deliveryPrice || 0,
                delivery_code: deliveryCode,
                installment_remark: installmentRemark,
                comment: comment
            };
    
            const { factureId } = await FactureController.creerFacture(conn, factureData);
            
            // Ajout des méthodes de paiement
            if (paymentMethods && paymentMethods.length > 0) {
                await FactureController.ajouterMethodesPaiement(conn, factureId, paymentMethods, req);
            }
    
            // Ajout des articles et mise à jour du stock
            await FactureController.ajouterArticlesFacture(conn, factureId, produitsVerifies);
            await FactureController.mettreAJourStocks(conn, produitsVerifies);
    
            await conn.commit();
            
            // Récupération des détails de la facture
            const [factureDetails] = await conn.query(
                "SELECT date_creation FROM factures WHERE id = ?", 
                [factureId]
            );
    
            res.status(201).json({ 
                success: true,
                message: "Facture créée avec succès", 
                data: { 
                    id: factureId, 
                    nom_client: clientNom, 
                    prix_total: Number(prix_total).toFixed(2), 
                    produits: produitsVerifies,
                    date_creation: factureDetails[0].date_creation,
                    sale_type: saleType,
                    sale_mode: saleMode,
                    payment_methods: paymentMethods || []
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
                const produit_id = decodeBarcode(produit.produit_id.toString()).id;
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


    static async modifierFactureGarantieVersement(req, res) {
        const factureId = req.params.id;
        const { articles, versements } = req.body;
        let conn;
    
        if (!factureId) {
            return FactureController.handleClientError(res, "ID de facture invalide");
        }
    
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();
    
            // Vérifier si la facture existe
            const [facture] = await conn.query(
                "SELECT id FROM factures WHERE id = ?",
                [factureId]
            );
    
            if (!facture.length) {
                await conn.rollback();
                return FactureController.handleNotFound(res, "Facture introuvable");
            }
    
            // 1. Modification des garanties des articles
            if (articles && articles.length > 0) {
                for (const article of articles) {
                    if (!article.article_facture_id || !article.duree_garantie || !article.code_garantie) {
                        await conn.rollback();
                        return FactureController.handleClientError(res, "Données de garantie incomplètes");
                    }
    
                    await conn.query(
                        `UPDATE articles_facture 
                         SET duree_garantie = ?, code_garantie = ?
                         WHERE id = ? AND facture_id = ?`,
                        [
                            article.duree_garantie,
                            article.code_garantie,
                            article.article_facture_id,
                            factureId
                        ]
                    );
                }
            }
    
            // 2. Modification des versements
            if (versements && versements.length > 0) {
                for (const versement of versements) {
                    if (!versement.payment_method_id || !versement.amount) {
                        await conn.rollback();
                        return FactureController.handleClientError(res, "Données de versement incomplètes");
                    }
    
                    console.log(versement);
                    // Vérifier si le payment_method_id appartient à la facture
                    const [paymentMethod] = await conn.query(
                        "SELECT id FROM payment_methods WHERE id = ? AND facture_id = ?",
                        [versement.payment_method_id, factureId]
                    );
                    console.log(paymentMethod);
    
                    if (!paymentMethod.length) {
                        await conn.rollback();
                        return FactureController.handleClientError(res, "Méthode de paiement invalide pour cette facture");
                    }
    
                    // Ajouter ou mettre à jour le versement
                    if (versement.installment_id) {
                        // Mise à jour d'un versement existant
                        await conn.query(
                            `UPDATE installments 
                             SET amount = ?, date = ?, pdf_file = ?
                             WHERE id = ? AND payment_method_id = ?`,
                            [
                                versement.amount,
                                versement.date || new Date(),
                                versement.pdf_file || null,
                                versement.installment_id,
                                versement.payment_method_id
                            ]
                        );
                    } else {
                        // Ajout d'un nouveau versement
                        await conn.query(
                            `INSERT INTO installments 
                             (payment_method_id, amount, date, pdf_file) 
                             VALUES (?, ?, ?, ?)`,
                            [
                                versement.payment_method_id,
                                versement.amount,
                                versement.date || new Date(),
                                versement.pdf_file || null
                            ]
                        );
                    }
    
                    // Mettre à jour le statut du paiement
                    await FactureController.updatePaymentStatus(conn, versement.payment_method_id);
                }
            }
    
            await conn.commit();
    
            res.status(200).json({
                success: true,
                message: "Garanties et versements modifiés avec succès"
            });
    
        } catch (error) {
            if (conn) await conn.rollback();
            console.error("Erreur lors de la modification de la facture:", error);
            FactureController.handleServerError(res, error, "modification des garanties et versements");
        } finally {
            if (conn) conn.release();
        }
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

        static async modifierFactureStatus(req, res) {
            const factureId = req.params.id; 
            const {status} = req.body;
            let conn;

            try {

                console.log("Nouveau status:", req.body);
            // Valider le statut
            const validStatuses = ["pending", "paid", "canceled"];
            if (!status || !validStatuses.includes(status)) {
                return res.status(400).json({
                success: false,
                message: `Statut invalide. Les statuts valides sont : ${validStatuses.join(", ")}`,
                });
            }

            // Obtenir une connexion à la base de données
            conn = await db.getConnection();

            // Vérifier si la facture existe
            const [factureRows] = await conn.query("SELECT id FROM factures WHERE id = ?", [factureId]);
            if (factureRows.length === 0) {
                return res.status(404).json({
                success: false,
                message: `Facture avec l'ID ${factureId} non trouvée`,
                });
            }

            // Mettre à jour le statut de la facture
            await conn.query("UPDATE factures SET status = ? WHERE id = ?", [status, factureId]);

            // Confirmer la mise à jour
            res.status(200).json({
                success: true,
                message: `Le statut de la facture ${factureId} a été mis à jour à "${status}"`,
            });
            } catch (error) {
            console.error("Erreur lors de la mise à jour du statut de la facture:", error);
            res.status(500).json({
                success: false,
                message: "Erreur serveur lors de la mise à jour du statut",
                error: error.message,
            });
            } finally {
            if (conn) conn.release();
            }
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
        const prix_original = Number(row.produit_prix_original) || 0;
    
        return {
            id: generateBarcode(row.produit_id),
            nom: row.produit_nom,
            quantite,
            prix_vente: prixVente.toFixed(2),
            prix_original: prix_original.toFixed(2),
            prix_total: (prixVente * quantite).toFixed(2),
            code_garantie: row.code_garantie,
            duree_garantie: row.duree_garantie
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

module.exports = FactureController;