const mysql = require('mysql2/promise');
const config = require('./config');

// Fonction pour échapper les identifiants MySQL
function escapeIdentifier(value) {
    return '`' + value.replace(/`/g, '``') + '`';
}

const dbName = escapeIdentifier(process.env.DB_NAME || config.db.database);

// Configuration de la connexion admin
const adminPool = mysql.createPool({
    host: process.env.DB_HOST || config.db.host,
    user: process.env.DB_USER || config.db.user,
    password: process.env.DB_PASSWORD || config.db.password,
    waitForConnections: true,
    namedPlaceholders: true,
    connectionLimit: 10
});

// Configuration de la pool principale
const appPool = mysql.createPool({
    host: process.env.DB_HOST || config.db.host,
    user: process.env.DB_USER || config.db.user,
    password: process.env.DB_PASSWORD || config.db.password,
    database: process.env.DB_NAME || config.db.database,
    waitForConnections: true,
    namedPlaceholders: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',
    charset: 'utf8mb4'
});
// Schéma de la base de données
const databaseSchema = {
    database: process.env.DB_NAME || config.db.database,
    tables: [
        {
            name: 'categories',
            schema: `
                CREATE TABLE IF NOT EXISTS categories (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nom VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `
        },
        {
            name: 'produits',
            schema: `
                CREATE TABLE IF NOT EXISTS produits (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nom VARCHAR(255) NOT NULL,
                    marque VARCHAR(100),
                    description TEXT,
                    processeur VARCHAR(100),
                    ram VARCHAR(50),
                    stockage VARCHAR(50),
                    gpu VARCHAR(100),
                    batterie VARCHAR(100),
                    ecran_tactile BOOLEAN DEFAULT FALSE,
                    ecran_type VARCHAR(100),
                    code_amoire VARCHAR(50),
                    reference VARCHAR(100) UNIQUE,
                    etat ENUM('neuf', 'occasion', 'reconditionne') DEFAULT 'neuf',
                    prix_achat DECIMAL(10,2) NOT NULL,
                    prix_vente DECIMAL(10,2) NOT NULL,
                    quantite INT NOT NULL DEFAULT 0,
                    categorie_id INT,
                    image JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (categorie_id) REFERENCES categories(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `
        },
        {
            name: 'factures',
            schema: `
                CREATE TABLE IF NOT EXISTS factures (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nom_client VARCHAR(255) NOT NULL,
                    prix_total DECIMAL(10,2) NOT NULL,
                    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `
        },
        {
            name: 'articles_facture',
            schema: `
                CREATE TABLE IF NOT EXISTS articles_facture (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    facture_id INT NOT NULL,
                    produit_id INT NOT NULL,
                    quantite INT NOT NULL,
                    FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE,
                    FOREIGN KEY (produit_id) REFERENCES produits(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `
        }
    ]
};

async function initializeDatabase() {
    let adminConn;
    try {
        adminConn = await adminPool.getConnection();
        
        // Créer la base de données (avec échappement)
        await adminConn.query(
            `CREATE DATABASE IF NOT EXISTS ${dbName} 
             CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        
        console.log(`✅ Base de données ${databaseSchema.database} vérifiée/créée`);
        
        // Utiliser la base de données (avec échappement)
        await adminConn.query(`USE ${dbName}`);
        
        // Créer les tables
        for (const table of databaseSchema.tables) {
            await adminConn.query(table.schema);
            console.log(`✅ Table ${table.name} vérifiée/créée`);
        }
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de la base:', error.message);
        throw error;
    } finally {
        if (adminConn) adminConn.release();
    }
}


// Fonction pour exécuter les requêtes
async function query(sql, params) {
    let connection;
    try {
        await initializeDatabase(); // Vérifie que tout existe avant chaque requête
        connection = await appPool.getConnection();
        const [results] = await connection.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Erreur SQL:', {
            sql: sql,
            params: params,
            error: error.message
        });
        throw new Error(`Erreur de base de données: ${error.message}`);
    } finally {
        if (connection) connection.release();
    }
}

// Fonction pour les transactions
async function transaction(callback) {
    let connection;
    try {
        await initializeDatabase(); // Vérifie que tout existe avant la transaction
        connection = await appPool.getConnection();
        await connection.beginTransaction();
        
        const result = await callback(connection);
        
        await connection.commit();
        return result;
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Transaction failed:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

// Test de la connexion au démarrage
async function testConnection() {
    await initializeDatabase();
    let connection;
    try {
        connection = await appPool.getConnection();
        await connection.ping();
        console.log('✅ Connecté à la base de données MySQL');
    } catch (error) {
        console.error('❌ Erreur de connexion à la base de données:', error.message);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}


module.exports = {
    pool: appPool,
    getConnection: () => appPool.getConnection(),
    query,
    transaction,
    testConnection,
    initializeDatabase
};