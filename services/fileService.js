class FileService {
    static processUploadedFiles(files) {
        return files.map(file => ({
            fieldname: file.fieldname, // Nom du champ envoyé
            path: file.path,
            filename: file.filename
        }));
    }

    static deleteFile(filePath) {
        const fs = require('fs').promises;
        return fs.unlink(filePath);
    }
}

module.exports = FileService;