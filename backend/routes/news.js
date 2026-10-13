const router = require('express').Router();
const { list } = require('../controllers/newsController');

router.get('/', list);
module.exports = router;
