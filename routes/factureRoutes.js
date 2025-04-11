const express = require('express');
const router = express.Router();
const FactureController = require('../controllers/factureController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/factures - Récupère toutes les factures
router.get('/', FactureController.getAllFactures);

// POST /api/factures - Crée une nouvelle facture
router.post('/', FactureController.createFacture);

router.post('/with-client', upload.none(), FactureController.createFactureWithClient);

// PUT /api/factures/:id/payment - Ajoute un versement à une méthode de paiement
router.put('/:id/payment', async (req, res) => {
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
});

// DELETE /api/factures/:id - Supprime une facture
router.delete('/:id', FactureController.deleteFacture);

module.exports = router;