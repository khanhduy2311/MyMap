// File: routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/middlewares.js');
const dashboardController = require('../controllers/dashboardController.js');

// Route chính sau khi đăng nhập
router.get('/', authMiddleware.checkLoggedIn, dashboardController.getDashboardPage);

module.exports = router;