const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

// POST /api/auth/login - Authentification
router.post('/login', AuthController.login);

module.exports = router;