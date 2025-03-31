const multer = require('multer');
const path = require('path');
const FileService = require('./fileService');

// Configuration Multer plus permissive
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

// Filtre étendu pour tous les formats image courants
const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png|webp|gif|bmp|tiff|svg|avif|heic|heif/;
  const mimeTypes = /image\/(jpeg|png|webp|gif|bmp|tiff|svg\+xml|avif|heic|heif)/;
  
  const extValid = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeValid = mimeTypes.test(file.mimetype);

  if (extValid && mimeValid) {
    return cb(null, true);
  }
  cb(new Error("Type de fichier image non supporté"));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: fileFilter
});

// Middleware de conversion AVIF
const processAndConvert = async (req, res, next) => {
  try {
    if (req.files?.length) {
      req.processedFiles = await FileService.convertToAVIF(req.files);
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadMiddleware: [upload.any(), processAndConvert],
  FileService
};