const router = require('express').Router();
const { list, history } = require('../controllers/marketController');

router.get('/', list);
router.get('/:coinId/history', history);
module.exports = router;
