// File: routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController.js');
const authMiddleware = require('../middlewares/middlewares.js');

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

// === ROUTE ĐĂNG XUẤT ===
router.get('/logout', authMiddleware.checkLoggedIn, authController.logout);

module.exports = router;