const config = {
    db: {
        host: "srv70.octenium.net", 
        user: "kdkrvfrx_M-tech", 
        password: "Aw&?PA#2wuY*",   
        database: "kdkrvfrx_M-tech" 
    },
    jwtSecret: process.env.JWT_SECRET || 'votre_clé_secrète_dev',
    uploadDir: 'uploads',
    photoDir: 'photos',
    port: process.env.PORT || 3000
};

// Validation de la configuration
try {
    // Vérification des champs obligatoires
    if (!config.db.host || !config.db.user || !config.db.database) {
        throw new Error('Configuration DB incomplète: host, user et database sont requis');
    }

    // Vérification du format du host
    if (!/^([a-z0-9.-]+|\[[a-f0-9:]+\])$/i.test(config.db.host)) {
        throw new Error('Format de host DB invalide');
    }

    // Vérification du secret JWT
    if (config.jwtSecret === 'votre_clé_secrète_dev') {
        console.warn('⚠️  Attention: Vous utilisez le secret JWT par défaut - Changez-le en production!');
    }

    console.log('✅ Configuration validée avec succès');
} catch (error) {
    console.error('❌ Erreur de configuration:', error.message);
    process.exit(1); // Quitte l'application avec un code d'erreur
}

module.exports = config;