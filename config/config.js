module.exports = {
    db: {
        host: 'srv70.octenium.net', 
        user: 'zpbavgpr_test', 
        password: '2S7pshgUgcQZc4W',   
        database: "zpbavgpr_M-tech" 
    },
    jwtSecret: process.env.JWT_SECRET || 'votre_clé_secrète_dev',
    uploadDir: 'uploads',
    photoDir: 'photos',
    port: process.env.PORT || 3000
};