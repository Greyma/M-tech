const pool = require('../config/db');

// Obtenir tous les clients
exports.getClients = async (req, res) => {
    try {
        const [clients] = await pool.query("SELECT * FROM clients");
        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error });
    }
};

// Obtenir un client par ID
exports.getClientById = async (req, res) => {
    try {
        const [client] = await pool.query("SELECT * FROM clients WHERE id = ?", [req.params.id]);
        if (client.length === 0) {
            return res.status(404).json({ message: "Client non trouvé" });
        }
        res.json(client[0]);
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error });
    }
};

// Ajouter un client
exports.createClient = async (req, res) => {
    const { nom, email, telephone, wilaya, recommendation } = req.body;
    try {
        const [result] = await pool.query(
            "INSERT INTO clients (nom, email, telephone, wilaya, recommendation) VALUES (?, ?, ?, ?, ?)",
            [nom, email, telephone, wilaya, recommendation]
        );
        res.status(201).json({ id: result.insertId, nom, email, telephone, wilaya, recommendation });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error });
    }
};

// Mettre à jour un client
exports.updateClient = async (req, res) => {
    const { nom, email, telephone, wilaya, recommendation } = req.body;
    try {
        const [result] = await pool.query(
            "UPDATE clients SET nom = ?, email = ?, telephone = ?, wilaya = ?, recommendation = ? WHERE id = ?",
            [nom, email, telephone, wilaya, recommendation, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Client non trouvé" });
        }
        res.json({ message: "Client mis à jour avec succès" });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error });
    }
};

// Supprimer un client
exports.deleteClient = async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM clients WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Client non trouvé" });
        }
        res.json({ message: "Client supprimé avec succès" });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error });
    }
};
