const express = require('express')
const { register, getUser ,login} = require('../controllers/userController');
const validateUser = require('../middlewares/validation');
const protectRoute = require('../middlewares/protectRoute');

const router = express.Router();
router.post('/',validateUser, register); 
router.get('/', protectRoute, getUser); 
router.post('/login', login );

module.exports = router;