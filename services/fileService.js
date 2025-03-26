const fs = require('fs');
const path = require('path');

class FileService {
    static processUploadedFiles(files, defaultPath = '/uploads/default.png') {
        if (!files || files.length === 0) {
            return [defaultPath];
        }
        return files.map(file => '/uploads/' + file.filename);
    }

    static async deleteProductImages(imagePaths) {
        if (!imagePaths) return;
        
        try {
            const paths = JSON.parse(imagePaths);
            for (const path of paths) {
                if (path !== '/uploads/default.png') {
                    await this.deleteFile(path);
                }
            }
        } catch (error) {
            console.error("Erreur lors de la suppression des images:", error);
        }
    }

    static deleteFile(filePath) {
        const fullPath = path.join(__dirname, '../', filePath);
        
        return new Promise((resolve, reject) => {
            fs.unlink(fullPath, (err) => {
                if (err) {
                    if (err.code === 'ENOENT') {
                        console.log(`File ${filePath} doesn't exist`);
                        return resolve(false);
                    }
                    return reject(err);
                }
                resolve(true);
            });
        });
    }
}

module.exports = FileService;