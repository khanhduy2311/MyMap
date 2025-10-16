// Chỉ cho phép người dùng đã đăng nhập đi tiếp
exports.checkLoggedIn = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/');
    }
};
// Nếu người dùng đã đăng nhập rồi, chuyển họ về trang cá nhân
exports.bypassLogin = (req, res, next) => {
    if (!req.session.user) {
        next();
    } else {
        res.redirect('/userHome');
    }
};