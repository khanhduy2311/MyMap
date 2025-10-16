const userModel = require('../models/userModel.js');
const { ObjectId } = require('mongodb'); 

// Hiển thị trang upload file
exports.getUploadPage = (req, res) => {
    res.render('upload', { 
        error: null, 
        success: null,
        error_msg: req.flash('error_msg'),
        success_msg: req.flash('success_msg')
    });
};

// Hiển thị trang đăng ký
exports.getRegisterPage = (req, res) => {
    res.render('register', { 
        error: null,
        error_msg: req.flash('error_msg'),
        success_msg: req.flash('success_msg')
    });
};

// Hiển thị trang đăng nhập
exports.getLoginPage = (req, res) => {
    res.render('login', { 
        error: null,
        error_msg: req.flash('error_msg'),
        success_msg: req.flash('success_msg')
    });
};

// Xử lý đăng ký
exports.postRegister = async (req, res) => {
  try {
    console.log("1. Bắt đầu xử lý đăng ký..."); // LOG 1
    const { name, email, password, username } = req.body;
    console.log("2. Dữ liệu nhận được:", req.body); // LOG 2
    const db = req.app.locals.db; 

    // Kiểm tra các trường bắt buộc
    if (!name || !email || !password || !username) {
      req.flash('error_msg', 'Vui lòng điền đầy đủ thông tin!');
      return res.redirect('/register');
    }

    // Kiểm tra nếu email hoặc username đã tồn tại
    const existingUser = await userModel.findUserByEmailOrUsername(db, email, username);
    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        req.flash('error_msg', 'Email đã tồn tại!');
      } else {
        req.flash('error_msg', 'Username đã tồn tại!');
      }
      return res.redirect('/register');
    }

    // Tạo user mới
    const newUser = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      username: username.toLowerCase().trim(),
      password: password, // Trong thực tế nên hash password
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await userModel.createUser(db, newUser);
    console.log("5. Tạo người dùng thành công, kết quả:", result); // LOG 5

    req.session.user = {
      _id: result.insertedId,
      name: newUser.name,
      // ...
    };

    console.log("6. Đăng ký thành công! Chuẩn bị chuyển hướng..."); // LOG 6
    req.flash('success_msg', 'Đăng ký thành công!');
    res.redirect('/userHome');

  } catch (err) {
    console.error('❌ Lỗi đăng ký:', err); // Dòng này sẽ bắt lỗi
    req.flash('error_msg', 'Đã xảy ra lỗi khi đăng ký!');
    res.redirect('/register');
  }
};
// Xử lý đăng nhập
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const db = req.app.locals.db; // Sửa thành req.app.locals.db

    // Kiểm tra các trường bắt buộc
    if (!email || !password) {
      req.flash('error_msg', 'Vui lòng điền đầy đủ email và mật khẩu!');
      return res.redirect('/login');
    }

    const user = await userModel.findUserByEmail(db, email);
    if (!user) {
      req.flash('error_msg', 'Email không tồn tại!');
      return res.redirect('/login');
    }

    // So sánh mật khẩu (trong thực tế nên dùng bcrypt)
    if (user.password !== password) {
      req.flash('error_msg', 'Sai mật khẩu!');
      return res.redirect('/login');
    }

    // Tạo session
    req.session.user = {
      _id: user._id,
      email: user.email,
      username: user.username,
      avatar: user.avatar || null
    };

    req.flash('success_msg', `Chào mừng ${user.name} trở lại!`);
    res.redirect('/userHome');

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

// Trang cá nhân người dùng
exports.getUserHomePage = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = new ObjectId(req.session.user._id);
        const user = await userModel.findUserById(db, userId);

        res.render('userHome', { 
            pageTitle: 'Trang cá nhân',
            user: user,
            error_msg: req.flash('error_msg'),
            success_msg: req.flash('success_msg')
        });
    } catch (err) {
        console.error('❌ Lỗi load user home:', err);
        req.flash('error_msg', 'Lỗi khi tải trang cá nhân');
        res.redirect('/login');
    }
};

// Trang dashboard (admin)
exports.getDashboardPage = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const users = await db.collection('users').find().toArray();

        res.render('dashboard', { 
            pageTitle: 'Bảng điều khiển',
            users: users,
            currentUser: req.session.user,
            error_msg: req.flash('error_msg'),
            success_msg: req.flash('success_msg')
        });
    } catch (err) {
        console.error('❌ Lỗi load dashboard:', err);
        req.flash('error_msg', 'Lỗi khi tải trang quản trị');
        res.redirect('/userHome');
    }
};

// Xử lý upload AVATAR
exports.postAvatarUpload = async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Kiểm tra session
    if (!req.session.user || !req.session.user._id) {
      req.flash('error_msg', 'Vui lòng đăng nhập để thực hiện thao tác này!');
      return res.redirect('/login');
    }

    const userId = new ObjectId(req.session.user._id);

    // Kiểm tra file upload
    if (!req.file || !req.file.path) {
      req.flash('error_msg', 'Vui lòng chọn ảnh hợp lệ!');
      return res.redirect('/userHome');
    }

    const avatarUrl = req.file.path; // Cloudinary URL

    // Cập nhật avatar trong database
    const result = await userModel.updateUserAvatar(db, userId, avatarUrl);
    
    if (result.modifiedCount === 0) {
      req.flash('error_msg', 'Không thể cập nhật ảnh đại diện!');
      return res.redirect('/userHome');
    }

    // Cập nhật lại session
    req.session.user.avatar = avatarUrl;
    req.flash('success_msg', 'Cập nhật ảnh đại diện thành công!');
    res.redirect('/userHome');

  } catch (err) {
    console.error('❌ Lỗi upload avatar:', err);
    
    // Phân loại lỗi
    if (err.message.includes('ObjectId')) {
      req.flash('error_msg', 'ID người dùng không hợp lệ!');
    } else if (err.message.includes('Cloudinary')) {
      req.flash('error_msg', 'Lỗi kết nối với dịch vụ lưu trữ ảnh!');
    } else {
      req.flash('error_msg', 'Đã xảy ra lỗi khi tải ảnh lên.');
    }
    
    res.redirect('/userHome');
  }
};