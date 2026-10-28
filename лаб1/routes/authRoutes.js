const express = require('express');
const controller = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/profile', authenticateToken, controller.profile);

module.exports = router;