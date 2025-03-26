# Documentation du Backend M-Tech

## 📋 Table des matières
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Lancement](#-lancement)
- [Endpoints API](#-endpoints-api)
- [Variables d'environnement](#-variables-denvironnement)
- [Gestion des fichiers](#-gestion-des-fichiers)
- [Tests](#-tests)
- [Dépannage](#-dépannage)

## 🛠 Installation

1. **Cloner le dépôt** :
   ```bash
   git clone https://github.com/votre-repo/m-tech-backend.git
   cd m-tech-backend
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Configurer la base de données** :
   - Créer une base MySQL
   - Importer le schéma depuis `database/schema.sql`

## ⚙ Configuration

Copier le fichier `.env.example` vers `.env` et modifier les valeurs :

```ini
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=m-tech
JWT_SECRET=votre_clé_secrète
PORT=3000
UPLOAD_DIR=uploads
```

## 🚀 Lancement

**Mode développement** :
```bash
npm run dev
```

**Mode production** :
```bash
npm start
```

## 🌐 Endpoints API

### Produits (`/api/produits`)
- `GET /` - Lister tous les produits
- `GET /:id` - Obtenir un produit spécifique
- `POST /` - Créer un nouveau produit
- `PUT /:id` - Mettre à jour un produit
- `DELETE /:id` - Supprimer un produit

### Catégories (`/api/categories`)
- `GET /` - Lister toutes les catégories
- `POST /` - Créer une nouvelle catégorie
- `PUT /:id` - Mettre à jour une catégorie
- `DELETE /:id` - Supprimer une catégorie

### Authentification (`/api/auth`)
- `POST /login` - Connexion utilisateur

## 🔒 Variables d'environnement

| Variable       | Description                          | Valeur par défaut |
|----------------|--------------------------------------|-------------------|
| DB_HOST        | Hôte de la base de données           | localhost         |
| DB_USER        | Utilisateur MySQL                    | root              |
| DB_PASSWORD    | Mot de passe MySQL                   | (vide)            |
| DB_NAME        | Nom de la base de données            | m-tech            |
| JWT_SECRET     | Clé secrète pour JWT                 | (requis)          |
| PORT           | Port d'écoute du serveur             | 3000              |
| UPLOAD_DIR     | Dossier de stockage des uploads      | uploads           |

## 📁 Gestion des fichiers

- Les images sont stockées dans `./uploads/`
- Formats acceptés : JPG, PNG, JPEG
- Taille max : 5MB
- Endpoint d'accès : `/uploads/nom-du-fichier`

## 🧪 Tests

Lancer les tests avec :
```bash
npm test
```

## 🛠 Dépannage

**Problème de connexion à la base** :
- Vérifier les credentials dans `.env`
- S'assurer que MySQL est en cours d'exécution

**Erreurs de permissions** :
```bash
chmod -R 755 uploads
```

**Problèmes de dépendances** :
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

> ℹ️ Pour toute question ou problème, ouvrir une issue sur le dépôt GitHub.