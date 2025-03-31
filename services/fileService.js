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

        // Vérifier si le fichier est déjà en AVIF (pas besoin de convertir)
        if (file.mimetype === 'image/avif') {
          processedFiles.push({
            filename: file.filename,
            path: file.path
          });
          return;
        }

        // Vérifier la validité de l'image avant conversion
        const metadata = await sharp(file.path).metadata();
        console.log(`Métadonnées fichier original : ${file.path}`, metadata);

        // Conversion en AVIF avec optimisations
        await sharp(file.path)
          .avif({
            quality: 75,          // Qualité équilibrée
            speed: 6,            // Vitesse raisonnable
            chromaSubsample: '4:2:0', // Optimisation mobile
            effort: 5            // Compression moyenne
          })
          .toFile(avifPath);

        // Vérifier le fichier généré
        const stats = fs.statSync(avifPath);
        if (stats.size === 0) {
          throw new Error('Le fichier AVIF généré est vide');
        }

        // Supprimer le fichier original après conversion réussie
        await unlink(file.path);

        processedFiles.push({
          filename: avifFilename,
          path: avifPath
        });
      } catch (err) {
        // Fallback : conserver le fichier original en cas d'erreur
        processedFiles.push({
          filename: file.filename,
          path: file.path
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
      path: file.path,
      filename: file.filename
    }));
  }
}

module.exports = FileService;