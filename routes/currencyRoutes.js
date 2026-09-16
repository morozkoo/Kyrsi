const express = require('express');
const controller = require('../controllers/currencyController');

const router = express.Router();

router.get('/', controller.getCurrencies);
router.post('/refresh', controller.refreshRates);
router.get('/:id', controller.getCurrency);
router.post('/', controller.createCurrency);
router.put('/:id', controller.updateCurrency);
router.delete('/:id', controller.deleteCurrency);

module.exports = router;