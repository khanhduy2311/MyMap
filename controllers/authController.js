const bcrypt = require('bcrypt');
// Hiển thị trang upload file
exports.getUploadPage = (req, res) => {
    res.render('upload', { error: null, success: null });
};

// Xử lý upload file
exports.postUploadFile = (req, res) => {
    if (!req.file) {
        return res.render('upload', { error: 'Vui lòng chọn file để upload.', success: null });
    }
    res.render('upload', { error: null, success: 'Upload thành công! File: ' + req.file.filename });
};
const userModel = require('../models/userModel');
// Register
exports.postRegister = async (req, res) => {
    const { email, username, password } = req.body;
    try {
        const existingUser = await userModel.findUserByEmailOrUsername(req.db, email, username);
        if (existingUser) {
            return res.render('register', { error: 'Email or username already exists.' });
        }
        
        // 2. Mã hóa mật khẩu
        const saltRounds = 10; // Độ phức tạp của mã hóa
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 3. Lưu mật khẩu đã mã hóa vào database
        const newUser = { email, username, password: hashedPassword, name: username };
        const result = await userModel.createUser(req.db, newUser);

        req.session.user = { id: result.insertedId, username: username, name: username };
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.render('register', { error: 'An error occurred.' });
    }
};
// Hiển thị trang đăng nhập
exports.getLoginPage = (req, res) => {
    res.render('login', { error: null });
};

// Xử lý đăng nhập
// ...

exports.postLogin = async (req, res) => {
    try {
        const user = await userModel.findUserByEmail(req.db, req.body.email);
        if (user && (await bcrypt.compare(req.body.password, user.password))) {
            // Mật khẩu khớp
            req.session.user = { id: user._id, username: user.username, name: user.name };
            res.redirect('/');
        } else {
            // Mật khẩu sai hoặc không tìm thấy user
            res.render('login', { error: 'Wrong email or password' });
        }
    } catch (error) {
        console.error(error);
        res.render('register', { error: 'An error occurred.' });
    }
};

// Hiển thị trang đăng ký
exports.getRegisterPage = (req, res) => {
    res.render('register', { error: null });
};

// Xử lý đăng ký
exports.postRegister = async (req, res) => {
    const { email, username, password } = req.body;
    try {
        const existingUser = await userModel.findUserByEmailOrUsername(req.db, email, username);
        if (existingUser) {
            return res.render('register', { error: 'Email or username already exists.' });
        }
        
        const newUser = { email, username, password, name: username };
        const result = await userModel.createUser(req.db, newUser);

        req.session.user = { id: result.insertedId, username: username, name: username };
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.render('register', { error: 'An error occurred.' });
    }
};

// Đăng xuất
exports.logout = (req, res) => {
    req.session.destroy();
    res.clearCookie('connect.sid');
    res.redirect('/');
};
// Upload file
exports.postUploadFile = (req, res) => {
    if (!req.file) {
        // Nếu không có file, tạo một thông báo lỗi
        req.flash('error_msg', 'Vui lòng chọn một file để upload.');
        return res.redirect('/'); // Quay về trang chủ
    }
    // Nếu có file, tạo một thông báo thành công
    req.flash('success_msg', `Upload thành công! File đã được lưu với tên: ${req.file.filename}`);
    res.redirect('/'); // Quay về trang chủ
};