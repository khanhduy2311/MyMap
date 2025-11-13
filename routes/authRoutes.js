// File: routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController.js');
const authMiddleware = require('../middlewares/middlewares.js');
const profileController = require('../controllers/profileController.js');
const { validate, validationRules } = require('../middlewares/validation.js');
const { loginLimiter, registerLimiter } = require('../middlewares/rateLimiter.js');
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
router.post('/register', 
  authMiddleware.bypassLogin, 
  registerLimiter,
  validationRules.register, 
  validate, 
  authController.postRegister
);

// === ROUTE ĐĂNG NHẬP ===
router.get('/login', authMiddleware.bypassLogin, authController.getLoginPage);
router.post('/login', 
  loginLimiter,
  validationRules.login, 
  validate, 
  authController.postLogin
);

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
router.get('/chat', authMiddleware.checkLoggedIn, async (req, res) => {
  try {
    const usersDb = req.app.locals.usersDb;
    const { ObjectId } = require('mongodb'); // Đảm bảo bạn đã require ObjectId

    // Lấy tất cả user khác trừ bản thân
    const users = await usersDb.collection('users').find({
      _id: { $ne: new ObjectId(req.session.user._id) }
    }).project({ username: 1, avatar: 1 }).toArray(); // Chỉ lấy thông tin cần thiết

    res.render('chat', { 
      pageTitle: 'Trò chuyện',
      allUsers: users,
      showSearch: false // Ẩn thanh tìm kiếm trên header
    });
  } catch (error) {
    console.error("Lỗi khi tải trang chat:", error);
    req.flash('error_msg', 'Không thể tải danh sách người dùng.');
    res.redirect('/dashboard');
  }
});
module.exports = router;