const express = require('express');
const controller = require('../controllers/currencyController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', controller.getCurrencies);
router.post('/refresh', authenticateToken, requireAdmin, controller.refreshRates);
router.get('/:id', controller.getCurrency);
router.post('/', authenticateToken, requireAdmin, controller.createCurrency);
router.put('/:id', authenticateToken, requireAdmin, controller.updateCurrency);
router.delete('/:id', authenticateToken, requireAdmin, controller.deleteCurrency);

module.exports = router;