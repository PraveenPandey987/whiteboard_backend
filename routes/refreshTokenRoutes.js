const express = require('express')
const refreshTokenController  = require('../controllers/refreshTokenController');

const router = express.Router();

router.get('/',refreshTokenController);

module.exports = router;