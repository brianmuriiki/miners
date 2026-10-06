const router = require('express').Router();
const auth = require('../middleware/auth');
const { info, blocks, mine } = require('../controllers/blockchainController');
router.get('/', info);
router.get('/blocks', blocks);
router.post('/mine', auth, mine);
module.exports = router;
