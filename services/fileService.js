const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const unlink = promisify(fs.unlink);

class FileService {
    static async convertToAVIF(files) {
        const processedFiles = [];
      
        await Promise.all(files.map(async (file) => {
          try {
            const avifFilename = `${path.parse(file.filename).name}.avif`;
            const avifPath = path.join('uploads', avifFilename);
      
            if (file.mimetype === 'image/avif') {
              processedFiles.push({
                originalName: file.originalname,
                filename: file.filename,
                path: file.path,
                mimetype: file.mimetype,
                size: file.size
              });
              return;
            }
      
            const metadata = await sharp(file.path).metadata();
            console.log(`Métadonnées fichier original : ${file.path}`, metadata);
      
            await sharp(file.path)
              .avif({ quality: 75, speed: 6, chromaSubsample: '4:2:0', effort: 5 })
              .toFile(avifPath);
      
            const stats = fs.statSync(avifPath);
            if (stats.size === 0) {
              throw new Error('Le fichier AVIF généré est vide');
            }
      
            // Tenter de supprimer le fichier original avec gestion d'erreur
            try {
              await unlink(file.path);
            } catch (unlinkErr) {
              console.error(`Échec suppression fichier original ${file.path}:`, unlinkErr);
              // Continuer malgré l'erreur
            }
      
            processedFiles.push({
              originalName: file.originalname,
              filename: avifFilename,
              path: avifPath,
              mimetype: 'image/avif',
              size: stats.size
            });
          } catch (err) {
            console.error(`Échec conversion AVIF pour ${file.originalname}:`, err);
            processedFiles.push({
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

  static async deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
        console.log(`Fichier supprimé : ${filePath}`);
      }
    } catch (err) {
      console.error(`Erreur suppression fichier ${filePath}:`, err);
    }
  }

  static processUploadedFiles(files) {
    return files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size
    }));
  }
}

module.exports = FileService;