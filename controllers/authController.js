// File: controllers/authController.js
const userModel = require('../models/userModel.js');
const { ObjectId } = require('mongodb');

// Hiển thị trang đăng ký
exports.getRegisterPage = (req, res) => {
    res.render('register', { pageTitle: 'Đăng ký' });
};

// Hiển thị trang đăng nhập
exports.getLoginPage = (req, res) => {
    res.render('login', { pageTitle: 'Đăng nhập' });
};

// Xử lý đăng ký
exports.postRegister = async (req, res) => {
    try {
        const { email, password, username } = req.body;
        const db = req.app.locals.db;

        if (!email || !password || !username) {
            req.flash('error_msg', 'Vui lòng điền đầy đủ thông tin!');
            return res.redirect('/register');
        }

        const existingUser = await userModel.findUserByEmailOrUsername(db, email, username);
        if (existingUser) {
            req.flash('error_msg', 'Email hoặc Username đã tồn tại!');
            return res.redirect('/register');
        }

        const newUser = {
            email: email.toLowerCase().trim(),
            username: username.toLowerCase().trim(),
            password: password, // Nên hash password
            avatar: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await userModel.createUser(db, newUser);
        
        req.session.user = {
            _id: result.insertedId,
            name: newUser.username, // Mặc định name là username
            username: newUser.username,
            email: newUser.email,
            avatar: null
        };

        req.flash('success_msg', 'Đăng ký thành công!');
        res.redirect('/dashboard');

    } catch (err) {
        console.error('❌ Lỗi đăng ký:', err);
        req.flash('error_msg', 'Đã xảy ra lỗi khi đăng ký!');
        res.redirect('/register');
    }
};

// Xử lý đăng nhập
exports.postLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const db = req.app.locals.db;

        if (!email || !password) {
            req.flash('error_msg', 'Vui lòng điền đầy đủ email và mật khẩu!');
            return res.redirect('/login');
        }

        const user = await userModel.findUserByEmail(db, email);
        if (!user || user.password !== password) { // So sánh mật khẩu
            req.flash('error_msg', 'Email hoặc mật khẩu không chính xác!');
            return res.redirect('/login');
        }
        
        req.session.user = {
            _id: user._id,
            email: user.email,
            username: user.username,
            name: user.name || user.username,
            avatar: user.avatar || null
        };

        res.redirect('/dashboard');

    } catch (err) {
        console.error('❌ Lỗi đăng nhập:', err);
        req.flash('error_msg', 'Đã xảy ra lỗi khi đăng nhập!');
        res.redirect('/login');
    }
};

// Đăng xuất
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Lỗi khi đăng xuất:', err);
        }
        res.redirect('/');
    });
};