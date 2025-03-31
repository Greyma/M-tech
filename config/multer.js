const multer = require('multer');
const path = require('path');
const FileService = require('../services/fileService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png|webp|gif|bmp|tiff|svg|avif|heic|heif/;
  const mimeTypes = /image\/(jpeg|png|webp|gif|bmp|tiff|svg\+xml|avif|heic|heif)/;

  const extValid = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeValid = mimeTypes.test(file.mimetype);

  if (extValid && mimeValid) {
    return cb(null, true);
  }
  cb(new Error(`Type de fichier non supporté : ${file.originalname}`));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // Garder 15 Mo comme amélioration
  fileFilter: fileFilter
});

const processAndConvert = async (req, res, next) => {
  try {
    if (req.files?.length) {
      req.processedFiles = await FileService.convertToAVIF(req.files);
      if (!Array.isArray(req.processedFiles) || req.processedFiles.length === 0) {
        throw new Error('Échec de la conversion des fichiers en AVIF');
      }
    } else {
      req.processedFiles = []; // Tableau vide si pas de fichiers
    }
    next();
  } catch (err) {
    // Fallback : conserver les fichiers originaux si la conversion échoue
    req.processedFiles = req.files?.length ? FileService.processUploadedFiles(req.files) : [];
    next(); // Continuer même en cas d'erreur pour ne pas bloquer
  }
};

module.exports = {
  uploadMiddleware: [upload.any(), processAndConvert]
};