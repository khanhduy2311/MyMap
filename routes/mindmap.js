const express = require('express');
const router = express.Router();
const mindmapController = require('../controllers/mindmapController.js');
const authMiddleware = require('../middlewares/middlewares.js');

// API endpoint: POST /mindmaps/create
router.post('/create', authMiddleware.checkLoggedIn, mindmapController.createMindmap);
router.get('/:id', authMiddleware.checkLoggedIn, mindmapController.getMindmapPage);
module.exports = router;