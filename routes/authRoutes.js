// File: routes/authRoutes.js
const express = require('express');
const router = express.Router();

// === IMPORT MIDDLEWARES & CONTROLLERS ===
// Đổi tên biến để rõ ràng hơn
const middlewares = require('../middlewares/middlewares.js');
const authController = require('../controllers/authController.js');
// Import middleware xử lý upload
const uploadMiddleware = require('../middlewares/avatarUpload.js');

// === ROUTE TRANG CHỦ DUY NHẤT ===
// Route này sẽ render file 'home.pug' và tự xử lý logic if/else bên trong view
router.get('/', (req, res) => {
  res.render('home', { pageTitle: 'Trang Chủ' });
});

// === CÁC ROUTE XÁC THỰC ===
// Hiển thị trang đăng ký
router.get('/register', middlewares.bypassLogin, authController.getRegisterPage);
// Xử lý form đăng ký
router.post('/register', authController.postRegister);

// Hiển thị trang đăng nhập
router.get('/login', middlewares.bypassLogin, authController.getLoginPage);
// Xử lý form đăng nhập
router.post('/login', authController.postLogin);

// Đăng xuất
router.get('/logout', middlewares.checkLoggedIn, authController.logout);

// === ROUTE UPLOAD ẢNH ĐẠI DIỆN ===
// Đổi lại tên route cho nhất quán, ví dụ: /upload
router.post(
  '/upload',
  middlewares.checkLoggedIn,
  uploadMiddleware.single('avatar'), // 'avatar' phải khớp với name của input
  authController.postAvatarUpload
);

// Bỏ các route không cần thiết /userHome và /admin/dashboard

module.exports = router;