// File: routes/authRoutes.js
const express = require('express');
const router = express.Router();

// Nạp tất cả các công cụ cần thiết
const authController = require('../controllers/authController.js');
const authMiddleware = require('../middlewares/middlewares.js');
const uploadMiddleware = require('../middlewares/uploadMiddleware.js');

// === ROUTE TRANG CHỦ ===
router.get('/', (req, res) => {
    res.render('home', { pageTitle: 'Trang Chủ' });
});

// === ROUTE ĐĂNG KÝ ===
// Hiển thị trang đăng ký (chỉ cho người chưa đăng nhập)
router.get('/register', authMiddleware.bypassLogin, authController.getRegisterPage);
// Xử lý form đăng ký
router.post('/register', authMiddleware.bypassLogin, authController.postRegister);

// === ROUTE ĐĂNG NHẬP ===
// Hiển thị trang đăng nhập (chỉ cho người chưa đăng nhập)
router.get('/login', authMiddleware.bypassLogin, authController.getLoginPage);
// Xử lý form đăng nhập
router.post('/login', authController.postLogin);

// === ROUTE ĐĂNG XUẤT ===
// Bắt buộc phải đăng nhập mới đăng xuất được
router.get('/logout', authMiddleware.checkLoggedIn, authController.logout);

// === ROUTE UPLOAD FILE ===
// Bắt buộc phải đăng nhập mới được upload
router.post(
    '/upload', 
    authMiddleware.checkLoggedIn, // 1. Kiểm tra đăng nhập
    uploadMiddleware.single('avatar'), // 2. Xử lý file upload
    authController.postUploadFile // 3. Trả kết quả về
);
router.get('/admin/dashboard', authMiddleware.checkLoggedIn, authController.getDashboardPage);
module.exports = router;