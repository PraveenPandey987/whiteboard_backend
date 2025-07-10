const express = require('express')
const {shareCanvas,getUserCanvases,loadCanvas,createCanvas,updateCanvas,deleteCanvas} = require('../controllers/canvasController')
const authenticateUser = require('../middlewares/protectRoute');
const router = express.Router();

router.get('/list',authenticateUser,getUserCanvases);
router.get('/load/:id',authenticateUser, loadCanvas);
router.post('/create', authenticateUser, createCanvas);
router.patch("/update", authenticateUser, updateCanvas); 
router.delete("/:canvasId", authenticateUser, deleteCanvas);
router.patch("/share/:id", authenticateUser, shareCanvas);

module.exports = router;