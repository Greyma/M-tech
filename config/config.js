const mysql = require('mysql2/promise');

const config = {
    db: {
        host: "srv70.octenium.net",
        user: "kdkrvfrx_M-tech",
        password: "Aw&?PA#2wuY*",
        database: "kdkrvfrx_M-tech",
        waitForConnections: true,
        namedPlaceholders: true,
        connectionLimit: 10,
        queueLimit: 0
    },
    jwtSecret: process.env.JWT_SECRET || 'votre_clé_secrète_dev',
    uploadDir: 'uploads',
    photoDir: 'photos',
    port: process.env.PORT || 3000
};

// Fonction de test de connexion
async function testDbConnection() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: config.db.host,
            user: config.db.user,
            password: config.db.password,
            database: config.db.database
        });
        
        await connection.ping();
        console.log('✅ Connexion à la base de données établie avec succès');
        return true;
    } catch (error) {
        console.error('❌ Échec de la connexion à la base de données:', error.message);
        
        // Détails supplémentaires pour le débogage
        console.log('\nDétails de configuration utilisés:');
        console.log(`- Host: ${config.db.host}`);
        console.log(`- User: ${config.db.user}`);
        console.log(`- Database: ${config.db.database}`);
        console.log(`- Password: ${error.code === 'ER_ACCESS_DENIED_ERROR' ? '*** (mot de passe incorrect?) ***' : '***'}`);
        
        return false;
    } finally {
        if (connection) await connection.end();
    }
}

// Version immédiatement invoquée pour test au démarrage
(async () => {
    if (!await testDbConnection()) {
        console.error('\n🛑 Impossible de se connecter à la base de données. Le serveur va s\'arrêter.');
        process.exit(1);
    }
})();

module.exports = {
    ...config,
    testDbConnection // Exporte la fonction pour pouvoir la réutiliser
};