const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/middlewares.js');
const dashboardController = require('../controllers/dashboardController.js');
// Thêm dòng này để import middleware noCache
const noCache = require('../middlewares/noCache.js');

// Route chính sau khi đăng nhập
// Thêm noCache vào giữa authMiddleware và dashboardController
router.get('/', authMiddleware.checkLoggedIn, noCache, dashboardController.getDashboardPage);
router.get('/trash', authMiddleware.checkLoggedIn, noCache, dashboardController.getTrashPage);
router.patch('/trash/recover/:id', authMiddleware.checkLoggedIn, dashboardController.recoverMindmap);

module.exports = router;