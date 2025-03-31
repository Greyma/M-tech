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

        // Conversion AVIF avec optimisations
        await sharp(file.path)
          .avif({
            quality: 75,          // Optimal pour qualité/poids
            speed: 6,            // Compromise vitesse/compression
            chromaSubsample: '4:2:0', // Meilleure perf mobile
            effort: 5            // Niveau compression moyen
          })
          .toFile(avifPath);

        // Suppression fichier original
        await unlink(file.path);

        processedFiles.push({
          originalName: file.originalname,
          filename: avifFilename,
          path: avifPath,
          mimetype: 'image/avif',
          size: fs.statSync(avifPath).size
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
      }
    } catch (err) {
      console.error(`Erreur suppression fichier ${filePath}:`, err);
    }
  }
}

module.exports = FileService;