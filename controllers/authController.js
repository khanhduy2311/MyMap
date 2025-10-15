const userModel = require('../models/userModel.js');

// Hiển thị trang upload file
exports.getUploadPage = (req, res) => {
    res.render('upload', { error: null, success: null });
};

// Hiển thị trang đăng ký
exports.getRegisterPage = (req, res) => {
    res.render('register', { error: null });
};

// Hiển thị trang đăng nhập
exports.getLoginPage = (req, res) => {
    res.render('login', { error: null });
};

// Xử lý đăng ký
exports.postRegister = async (req, res) => {
    const { email, username, password } = req.body;
    try {
        const existingUser = await userModel.findUserByEmailOrUsername(req.db, email, username);
        if (existingUser) {
            return res.render('register', { error: 'Email hoặc tên đăng nhập đã tồn tại.' });
        }

        const newUser = { email, username, password, name: username };
        const result = await userModel.createUser(req.db, newUser);

        req.session.user = { id: result.insertedId, username, name: username };
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.render('register', { error: 'Đã xảy ra lỗi khi đăng ký.' });
    }
};

// ✅ Xử lý đăng nhập
exports.postLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await userModel.findUserByEmail(req.db, email);
        if (!user) {
            return res.render('login', { error: 'Email không tồn tại.' });
        }

        // Nếu bạn có mã hóa mật khẩu, so sánh bằng bcrypt
        if (user.password !== password) {
            return res.render('login', { error: 'Sai mật khẩu.' });
        }

        // Lưu thông tin người dùng vào session
        req.session.user = {
            id: user._id,
            username: user.username,
            name: user.name,
            avatar: user.avatar || null
        };

        res.redirect('/userHome');
    } catch (error) {
        console.error(error);
        res.render('login', { error: 'Đã xảy ra lỗi khi đăng nhập.' });
    }
};

// Đăng xuất
exports.logout = (req, res) => {
    req.session.destroy();
    res.clearCookie('connect.sid');
    res.redirect('/');
};

// Trang cá nhân người dùng
exports.getUserHomePage = (req, res) => {
    res.render('userHome', { pageTitle: 'Trang cá nhân' });
};

// Trang dashboard (admin)
exports.getDashboardPage = (req, res) => {
    res.render('dashboard', { pageTitle: 'Bảng điều khiển' });
};

// Xử lý upload AVATAR
exports.postAvatarUpload = async (req, res) => {
    if (!req.file) {
        req.flash('error_msg', 'Vui lòng chọn một file ảnh.');
        return res.redirect('/userHome');
    }
    try {
        const avatarUrl = req.file.path;
        const userId = req.session.user.id;
        await userModel.updateUserAvatar(req.db, userId, avatarUrl);
        req.session.user.avatar = avatarUrl;
        req.flash('success_msg', 'Cập nhật ảnh đại diện thành công!');
        res.redirect('/userHome');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật ảnh đại diện.');
        res.redirect('/userHome');
    }
};
