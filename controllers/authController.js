const jwt = require('jsonwebtoken');
const config = require('../config/config');

class AuthController {
    static async login(req, res) {
        try {
            const { id, password } = req.body;

            if (!id || !password) {
                return res.status(400).json({ 
                    message: 'Identifiant et mot de passe sont requis.' 
                });
            }

            // Vérification des identifiants (à remplacer par une vraie vérification en base de données)
            if (id === "adminbs" && password === "adminbs2025") {
                const payload = { 
                    userId: "trendybox",
                    role: "admin" // Vous pouvez ajouter plus d'informations
                };

                // Création du token JWT
                const token = jwt.sign(
                    payload, 
                    config.jwtSecret, 
                    { expiresIn: '1h' }
                );

                return res.status(200).json({ 
                    message: 'Authentification réussie.', 
                    token: token,
                    user: payload
                });
            }

            return res.status(401).json({ 
                message: 'Identifiant ou mot de passe incorrect.' 
            });
            
        } catch (error) {
            console.error("Erreur lors de l'authentification:", error);
            res.status(500).json({ 
                message: "Erreur serveur", 
                error: error.message 
            });
        }
    }
}

module.exports = AuthController;