const router = require('express').Router();
const auth = require('../middleware/auth');
const { send, list, getOne } = require('../controllers/transactionController');
router.post('/send', auth, send);
router.get('/', auth, list);
router.get('/:id', auth, getOne);
module.exports = router;
