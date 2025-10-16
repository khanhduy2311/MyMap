// File: routes/authRoutes.js
const express = require('express');
const router = express.Router();

// === IMPORT MIDDLEWARES & CONTROLLERS ===
const uploadAvatarMiddleware = require('../middlewares/avatarUpload.js');
const authController = require('../controllers/authController.js');
const authMiddleware = require('../middlewares/middlewares.js');
const userController = require('../controllers/authController.js');

// === ROUTE TRANG CHỦ ===
router.get('/', (req, res) => {
  res.render('home', { pageTitle: 'Trang Chủ' });
});

// === ROUTE ĐĂNG KÝ ===
router.get('/register', authMiddleware.bypassLogin, authController.getRegisterPage);
router.post('/register', authMiddleware.bypassLogin, authController.postRegister);

// === ROUTE ĐĂNG NHẬP ===
router.get('/login', authMiddleware.bypassLogin, authController.getLoginPage);
router.post('/login', authController.postLogin);

// === ROUTE ĐĂNG XUẤT ===
router.get('/logout', authMiddleware.checkLoggedIn, authController.logout);

// === ROUTE TRANG NGƯỜI DÙNG ===
router.get('/admin/dashboard', authMiddleware.checkLoggedIn, authController.getDashboardPage);
router.get('/userHome', authMiddleware.checkLoggedIn, authController.getUserHomePage);

// === ROUTE UPLOAD ẢNH ĐẠI DIỆN ===
router.post(
  '/upload/avatar',
  authMiddleware.checkLoggedIn,
  uploadAvatarMiddleware.single('avatar'),
  authController.postAvatarUpload
);

module.exports = router;
