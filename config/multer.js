const multer = require('multer');
const path = require('path');
const FileService = require('../services/fileService');

// Configuration Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Dossier de destination
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); // Nom unique avec timestamp
  }
});

// Filtre pour accepter uniquement les images
const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png|webp|gif|bmp|tiff|svg|avif|heic|heif/;
  const mimeTypes = /image\/(jpeg|png|webp|gif|bmp|tiff|svg\+xml|avif|heic|heif)/;

  const extValid = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeValid = mimeTypes.test(file.mimetype);

  if (extValid && mimeValid) {
    return cb(null, true);
  }
  cb(new Error(`Type de fichier non supporté : ${file.originalname}`)); // Message d'erreur plus précis
};

// Initialisation de Multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // Limite à 15 Mo
  fileFilter: fileFilter
});

// Middleware de conversion AVIF
const processAndConvert = async (req, res, next) => {
  try {
    if (req.files?.length) {
      console.log('Fichiers reçus par Multer :', req.files); // Log pour débogage
      req.processedFiles = await FileService.convertToAVIF(req.files); // Conversion en AVIF
      console.log('Fichiers convertis :', req.processedFiles); // Log pour vérifier
    } else {
      req.processedFiles = []; // Initialisation vide si pas de fichiers
    }
    next();
  } catch (err) {
    console.error('Erreur dans processAndConvert :', err);
    next(err); // Passe l'erreur au gestionnaire d'erreurs
  }
};

module.exports = {
  uploadMiddleware: [upload.any(), processAndConvert], // Export du middleware
  FileService // Export du service pour réutilisation si besoin
};