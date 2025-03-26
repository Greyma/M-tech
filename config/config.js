module.exports = {
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