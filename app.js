const express = require('express');
const cors = require('cors');
const path = require('path');
const nocache = require('nocache');
const app = express();
const port = process.env.PORT || 5478;

// Import des routes
const authRoutes = require('./routes/authRoutes');
// ... autres imports de routes ...

// Middlewares
app.use(nocache());
app.use(cors());
app.use(express.json());

// Configuration des en-têtes de cache
app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
});

// Gestion des fichiers statiques
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/photos", express.static(path.join(__dirname, "photos")));

// Routes
app.use('/api/auth', authRoutes);
// ... autres routes ...

app.use('/api/produits', require('./routes/produitRoutes'));
app.use('/api/categories', require('./routes/categorieRoutes'));
app.use('/api/factures', require('./routes/factureRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));


// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({ message: "Route non trouvée" });
});

// Démarrage du serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});

module.exports = app; // Pour les tests