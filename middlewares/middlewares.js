exports.checkLoggedIn = (req, res, next) => {
    if (req.session.user) {
        // Nếu đã đăng nhập, cho phép đi tiếp
        next();
    } else {
        // Nếu chưa, chuyển về trang chủ 
        res.redirect('/home');
    }
};

exports.bypassLogin = (req,res,next) => {
    if(!req.session.user){
        next();
    } else {
        // Nếu đã đăng nhập, chuyển về trang cá nhân của họ
        res.redirect('/userHome');
    }
};