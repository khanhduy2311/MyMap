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
        // === THAY ĐỔI: Lấy 2 db từ app.locals ===
        const usersDb = req.app.locals.usersDb;
        const mindmapsDb = req.app.locals.mindmapsDb;
        // =======================================

        if (!email || !password || !username) {
            req.flash('error_msg', 'Vui lòng điền đầy đủ thông tin!');
            return res.redirect('/register');
        }

        // Tìm user trong usersDb
        const existingUser = await userModel.findUserByEmailOrUsername(usersDb, email, username);
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

        // Tạo user trong usersDb
        const result = await userModel.createUser(usersDb, newUser);
        const newUserIdString = result.insertedId.toString();
        
        // === LOGIC MỚI: Tạo collection mindmap cho user ===
        try {
            // Dùng _id của user làm tên collection mới
            await mindmapsDb.createCollection(newUserIdString);
            console.log(`✅ Đã tạo collection mindmap mới: ${newUserIdString}`);
        } catch (dbError) {
            console.error(`❌ Lỗi khi tạo collection mindmap cho user ${newUserIdString}:`, dbError);
            // Cần xử lý lỗi này, ví dụ: xóa user vừa tạo để đồng bộ
        }
        // ================================================

        req.session.user = {
            _id: result.insertedId,
            name: newUser.username,
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
        // === THAY ĐỔI: Chỉ dùng usersDb ===
        const usersDb = req.app.locals.usersDb;
        // =================================

        if (!email || !password) {
            req.flash('error_msg', 'Vui lòng điền đầy đủ email và mật khẩu!');
            return res.redirect('/login');
        }

        // Tìm user trong usersDb
        const user = await userModel.findUserByEmail(usersDb, email);
        if (!user || user.password !== password) {
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