const router = require('express').Router();
const { history } = require('../controllers/forexController');

router.get('/', history);
module.exports = router;
