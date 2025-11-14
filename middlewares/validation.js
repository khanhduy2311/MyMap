// middlewares/validation.js
const { body, validationResult } = require('express-validator');

// Middleware để check validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg).join(', ');
    
    // Nếu là API request, trả JSON
    if (req.originalUrl.startsWith('/api') || req.xhr) {
      return res.status(400).json({ 
        success: false,
        error: errorMessages,
        errors: errors.array() 
      });
    }
    
    // Nếu là page request, dùng flash và redirect về original URL
    req.flash('error_msg', errorMessages);
    
    // Xác định redirect path dựa trên route hiện tại
    let redirectPath = '/';
    if (req.path.includes('register')) {
      redirectPath = '/register';
    } else if (req.path.includes('login')) {
      redirectPath = '/login';
    } else if (req.path.includes('forgot')) {
      redirectPath = '/forgot-password';
    } else if (req.headers.referer) {
      // Fallback: dùng referer nếu có
      redirectPath = req.headers.referer;
    }
    
    return res.redirect(redirectPath);
  }
  next();
};

// Validation rules
const validationRules = {
  register: [
    body('email')
      .isEmail()
      .withMessage('Email không hợp lệ')
      .normalizeEmail()
      .trim(),
    body('username')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username phải từ 3-30 ký tự')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username chỉ được chứa chữ, số và dấu gạch dưới')
      .trim(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  ],

  login: [
    body('email')
      .isEmail()
      .withMessage('Email không hợp lệ')
      .normalizeEmail()
      .trim(),
    body('password')
      .notEmpty()
      .withMessage('Mật khẩu không được để trống'),
  ],

  mindmapTitle: [
    body('title')
      .isLength({ min: 1, max: 200 })
      .withMessage('Tiêu đề phải từ 1-200 ký tự')
      .trim()
      .escape(),
  ],

  mindmapContent: [
    body('content')
      .notEmpty()
      .withMessage('Nội dung không được để trống')
      .isLength({ max: 1000000 }) // 1MB text
      .withMessage('Nội dung quá lớn (tối đa 1MB)'),
  ],
};

module.exports = { validate, validationRules };
