// Middleware 1: Bảo vệ các trang riêng tư
// Chỉ cho phép người dùng đã đăng nhập đi tiếp
exports.checkLoggedIn = (req, res, next) => {
    if (req.session.user) {
        // Nếu đã đăng nhập, cho phép đi tiếp
        next();
    } else {
        // Nếu chưa đăng nhập, chuyển hướng về trang chủ
        res.redirect('/');
    }
};
// Nếu người dùng đã đăng nhập rồi, chuyển họ về trang cá nhân
exports.bypassLogin = (req, res, next) => {
    if (!req.session.user) {
        // Nếu chưa đăng nhập, cho phép đi tiếp
        next();
    } else {
        // Nếu đã đăng nhập, chuyển về trang cá nhân của họ
        res.redirect('/userHome');
    }
};