// File: routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController.js');
const authMiddleware = require('../middlewares/middlewares.js');
const profileController = require('../controllers/profileController.js');
// === ROUTE TRANG CHỦ ===
router.get('/', (req, res) => {
  // Nếu đã đăng nhập thì vào dashboard, nếu chưa thì vào trang home
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('home', { pageTitle: 'Trang Chủ' });
});

// === ROUTE ĐĂNG KÝ ===
router.get('/register', authMiddleware.bypassLogin, authController.getRegisterPage);
router.post('/register', authMiddleware.bypassLogin, authController.postRegister);

// === ROUTE ĐĂNG NHẬP ===
router.get('/login', authMiddleware.bypassLogin, authController.getLoginPage);
router.post('/login', authController.postLogin);

// === ROUTE QUÊN MẬT KHẨU ===
router.get('/forgot-password', authMiddleware.bypassLogin, authController.getForgotPasswordPage);
router.post('/forgot-password', authMiddleware.bypassLogin, authController.postForgotPassword);
router.get('/reset-password/:token', authMiddleware.bypassLogin, authController.getResetPasswordPage);
router.post('/reset-password/:token', authMiddleware.bypassLogin, authController.postResetPassword);

// === ROUTE ĐĂNG XUẤT ===
router.get('/logout', authMiddleware.checkLoggedIn, authController.logout);
// Thêm route cho trang about
router.get('/about', (req, res) => {
    res.render('about', {
        pageTitle: 'Về Chúng Tôi',
        user: req.user
    });
});
module.exports = router;