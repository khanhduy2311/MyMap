const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { checkLoggedIn, bypassLogin } = require('../middlewares/middlewares');

// Các route công khai
router.get('/home', (req, res) => res.render('home'));
router.get('/login', bypassLogin, authController.getLoginPage);
router.post('/login', authController.postLogin);
router.get('/register', bypassLogin, authController.getRegisterPage);
router.post('/register', authController.postRegister);
router.get('/logout', authController.logout);

// Route cá nhân (yêu cầu đăng nhập)
router.get('/', checkLoggedIn, (req, res) => res.render('userHome'));

module.exports = router;