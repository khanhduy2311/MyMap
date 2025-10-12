const userModel = require('../models/userModel');

// Hiển thị trang đăng nhập
exports.getLoginPage = (req, res) => {
    res.render('login', { error: null });
};

// Xử lý đăng nhập
exports.postLogin = async (req, res) => {
    try {
        const user = await userModel.findUserByEmail(req.db, req.body.email);

        if (user && user.password === req.body.password) {
            req.session.user = { id: user._id, username: user.username, name: user.name };
            res.redirect('/');
        } else {
            res.render('login', { error: 'Wrong email or password' });
        }
    } catch (error) {
        console.error(error);
        res.render('login', { error: 'An error occurred.' });
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
    res.redirect('/home');
};