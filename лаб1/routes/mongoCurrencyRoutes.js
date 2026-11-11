const express = require('express');
const controller = require('../controllers/mongoCurrencyController');
const { requireMongo } = require('../config/mongo');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireMongo);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', authenticateToken, requireAdmin, controller.create);
router.put('/:id', authenticateToken, requireAdmin, controller.update);
router.delete('/:id', authenticateToken, requireAdmin, controller.remove);
router.post('/:id/history', authenticateToken, requireAdmin, controller.addRate);
router.patch('/:id/history/:entryId', authenticateToken, requireAdmin, controller.updateRateNote);
router.use(controller.handleError);

module.exports = router;
