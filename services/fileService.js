const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const unlink = promisify(fs.unlink);

class FileService {
  static async processUploadedFiles(files) {
    const processedFiles = [];

    await Promise.all(files.map(async (file) => {
      try {
        const avifFilename = `${path.parse(file.filename).name}.avif`;
        const avifPath = path.join('uploads', avifFilename);

        // Conversion en AVIF
        await sharp(file.path)
          .avif({
            quality: 75,
            speed: 6,
            chromaSubsample: '4:2:0',
            effort: 5
          })
          .toFile(avifPath);

        // Suppression du fichier original
        await unlink(file.path);

        processedFiles.push({
          fieldname: file.fieldname, // Conservé de l'ancienne version
          originalName: file.originalname,
          filename: avifFilename,
          path: avifPath,
          mimetype: 'image/avif',
          size: fs.statSync(avifPath).size
        });
      } catch (err) {
        console.error(`Échec conversion AVIF pour ${file.originalname}:`, err);
        // Fallback : conserver les données de l'original
        processedFiles.push({
          fieldname: file.fieldname,
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          mimetype: file.mimetype,
          size: file.size
        });
      }
    }));

    return processedFiles;
  }

  static processDefaultFiles(files) {
    // Méthode inchangée de l'ancienne version pour compatibilité
    return [{
      path: files.path,
      filename: files.filename
    }];
  }

  static async deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (err) {
      console.error(`Erreur suppression fichier ${filePath}:`, err);
    }
  }
}

module.exports = FileService;