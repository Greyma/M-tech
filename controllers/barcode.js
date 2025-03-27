// utils/barcode.js

// Fonction pour générer un code-barres (déjà existante)
function generateBarcode(id) {
    const idNum = parseInt(id, 10);
    if (isNaN(idNum) || idNum < 0) {
        throw new Error("L'ID doit être un nombre positif");
    }

    const prefix = "370"; // Préfixe fixe (ajustez selon votre besoin)
    const idString = idNum.toString().padStart(9, "0");
    const baseNumber = prefix + idString;
    const checkDigit = calculateEAN13CheckDigit(baseNumber);
    return baseNumber + checkDigit;
}

// Fonction pour calculer la clé de contrôle EAN-13
function calculateEAN13CheckDigit(number) {
    if (number.length !== 12) {
        throw new Error("Le numéro de base doit avoir exactement 12 chiffres");
    }

    const digits = number.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += i % 2 === 0 ? digits[i] : digits[i] * 3;
    }

    const remainder = sum % 10;
    const checkDigit = remainder === 0 ? 0 : 10 - remainder;
    return checkDigit.toString();
}

// Nouvelle fonction pour décoder un code-barres EAN-13
function decodeBarcode(barcode) {
    // Vérifier que le code-barres est une chaîne de 13 chiffres
    if (typeof barcode !== 'string' || barcode.length !== 13 || !/^\d{13}$/.test(barcode)) {
        throw new Error("Le code-barres doit être une chaîne de 13 chiffres");
    }

    // Extraire les parties du code-barres
    const prefix = barcode.slice(0, 3); // Les 3 premiers chiffres (préfixe)
    const idPart = barcode.slice(3, 12); // Les 9 chiffres suivants (ID)
    const providedCheckDigit = barcode.slice(12); // Dernier chiffre (clé de contrôle)

    // Recalculer la clé de contrôle pour vérifier la validité
    const baseNumber = barcode.slice(0, 12); // Les 12 premiers chiffres
    const calculatedCheckDigit = calculateEAN13CheckDigit(baseNumber);

    if (calculatedCheckDigit !== providedCheckDigit) {
        throw new Error("Clé de contrôle invalide : le code-barres n'est pas valide");
    }

    // Extraire l'ID (en supprimant les zéros à gauche)
    const id = parseInt(idPart, 10);

    // return id; // Retourner l'ID décodés

    return {
        prefix: prefix, // Préfixe utilisé
        id: id,        // ID original
        checkDigit: providedCheckDigit // Clé de contrôle
    };
}

module.exports = { generateBarcode, decodeBarcode };