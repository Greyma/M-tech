const multer = require('multer');
const path = require('path');
const FileService = require('../services/fileService');

// Configuration pour les images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Configuration pour les PDFs
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/PDFs/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `pdf-${uniqueSuffix}.pdf`);
  }
});

// Filtre pour les images
const imageFileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png|webp|gif|bmp|tiff|svg|avif|heic|heif/;
  const mimeTypes = /image\/(jpeg|png|webp|gif|bmp|tiff|svg\+xml|avif|heic|heif)/;

  const extValid = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeValid = mimeTypes.test(file.mimetype);

  if (extValid && mimeValid) {
    return cb(null, true);
  }
  cb(new Error(`Type de fichier non supporté : ${file.originalname}`));
};

// Filtre pour les PDFs
const pdfFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    return cb(null, true);
  }
  cb(new Error(`Seul le format PDF est supporté : ${file.originalname}`));
};

// Multer pour les images
const uploadImages = multer({
  storage: imageStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 Mo
  fileFilter: imageFileFilter
});

// Multer pour les PDFs
const uploadPDFs = multer({
  storage: pdfStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 Mo, ajustable
  fileFilter: pdfFileFilter
});

// Middleware pour traiter les images (conversion AVIF)
const processAndConvertImages = async (req, res, next) => {
  try {
    if (req.files?.length) {
      req.processedFiles = await FileService.convertToAVIF(req.files);
      if (!Array.isArray(req.processedFiles) || req.processedFiles.length === 0) {
        throw new Error('Échec de la conversion des fichiers en AVIF');
      }
    } else {
      req.processedFiles = [];
    }
    next();
  } catch (err) {
    req.processedFiles = req.files?.length ? FileService.processUploadedFiles(req.files) : [];
    next();
  }
};

// Middleware pour traiter les PDFs (pas de conversion)
const processPDFs = async (req, res, next) => {
  try {
    if (req.files?.length) {
      req.processedFiles = req.files.map(file => ({
        originalname: file.originalname,
        filename: file.filename,
        path: path.join('uploads/PDFs', file.filename).replace(/\\/g, '/')
      }));
    } else {
      req.processedFiles = [];
    }
    next();
  } catch (err) {
    req.processedFiles = [];
    next();
  }
};

module.exports = {
  uploadImageMiddleware: [uploadImages.any(), processAndConvertImages],
  uploadPDFMiddleware: [uploadPDFs.any(), processPDFs]
};