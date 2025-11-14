const { fail } = require('../utils/apiResponse');

// Chỉ cho phép người dùng đã đăng nhập đi tiếp
exports.checkLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return next();
    }

    // Nếu là request từ fetch/XHR hoặc Accept JSON -> trả 401 để client xử lý redirect
    const isApi = req.xhr ||
                  (req.headers.accept && req.headers.accept.includes('application/json')) ||
                  req.path.startsWith('/mindmaps');

    if (isApi) {
        return fail(res, 401, 'UNAUTHORIZED', 'Bạn cần đăng nhập để truy cập API này.');
    }

    // Mặc định: chuyển hướng về trang login
    res.redirect('/login');
};
// Nếu người dùng đã đăng nhập rồi, chuyển họ về trang cá nhân
exports.bypassLogin = (req, res, next) => {
    if (!req.session.user) {
        next();
    } else {
        res.redirect('/dashboard');
    }
};