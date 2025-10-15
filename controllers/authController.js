const userModel = require('../models/userModel.js');
const { ObjectId } = require('mongodb'); 
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


//xử lý đăng ký
exports.postRegister = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const db = req.db; // bạn cần đảm bảo middleware gắn db vào req

    // ✅ Kiểm tra nếu email đã tồn tại
    const existingUser = await userModel.findUserByEmail(db, email);
    if (existingUser) {
      return res.render('register', { error: 'Email đã tồn tại!' });
    }

    // ✅ Tạo user mới
    await userModel.createUser(db, { name, email, password });

    // ✅ Tạo session
    req.session.user = { name, email };
    res.redirect('/userHome');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Lỗi khi đăng ký!' });
  }
};



// ✅ Xử lý đăng nhập
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  const db = req.db;

  try {
    const user = await userModel.findUserByEmail(db, email);
    if (!user) {
      return res.render('login', { error: 'Email không tồn tại' });
    }

    if (user.password !== password) {
      return res.render('login', { error: 'Sai mật khẩu' });
    }

    req.session.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
    username: user.username
    };

    res.redirect('/userHome');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Lỗi khi đăng nhập' });
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
  try {
    const db = req.app.locals.db;
    const userId = new ObjectId(req.session.user._id); // ✅ Phải có "new"

    if (!req.file || !req.file.path) {
      req.flash('error_msg', 'Vui lòng chọn ảnh hợp lệ!');
      return res.redirect('/userHome');
    }

    const avatarUrl = req.file.path;

    await userModel.updateUserAvatar(db, userId, avatarUrl);

    // Cập nhật lại session
    req.session.user.avatar = avatarUrl;
    req.flash('success_msg', 'Cập nhật ảnh đại diện thành công!');
    res.redirect('/userHome');

  } catch (err) {
    console.error('❌ Lỗi upload avatar:', err);
    req.flash('error_msg', 'Đã xảy ra lỗi khi tải ảnh lên.');
    res.redirect('/userHome');
  }
};