// middlewares/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { default: RedisStore } = require('rate-limit-redis');
const { redis } = require('../utils/redisClient');

// Helper function để tạo Redis store với prefix riêng (hoặc fallback to memory)
const createRedisStore = (prefix) => {
  try {
    // Chỉ dùng Redis nếu đã connected
    if (redis.status === 'ready') {
      console.log(`✅ Using Redis store for rate limiter: ${prefix}`);
      return new RedisStore({
        // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
        sendCommand: (...args) => redis.call(...args),
        prefix: `rl:${prefix}:`,
      });
    } else {
      console.log(`⚠️ Redis not ready, using memory store for rate limiter: ${prefix}`);
      return undefined; // express-rate-limit sẽ dùng memory store mặc định
    }
  } catch (err) {
    console.error(`⚠️ Error creating Redis store for ${prefix}, using memory store:`, err.message);
    return undefined; // Fallback to memory store
  }
};

// Rate limiter cho login (chống brute force)
const loginLimiter = rateLimit({
  store: createRedisStore('login'),
  windowMs: 15 * 60 * 1000, // 15 phút
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // Dev: 100, Production: 5
  message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development', // Bỏ qua trong dev
  handler: (req, res) => {
    req.flash('error_msg', 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.');
    res.redirect('/login');
  }
});

// Rate limiter cho đăng ký
const registerLimiter = rateLimit({
  store: createRedisStore('register'),
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: process.env.NODE_ENV === 'production' ? 3 : 100, // Dev: 100, Production: 3
  message: 'Quá nhiều tài khoản được tạo từ IP này. Vui lòng thử lại sau.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development', // Bỏ qua trong dev
  handler: (req, res) => {
    req.flash('error_msg', 'Quá nhiều tài khoản được tạo. Vui lòng thử lại sau 1 giờ.');
    res.redirect('/register');
  }
});

// Rate limiter cho upload file
const uploadLimiter = rateLimit({
  store: createRedisStore('upload'),
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 20, // 20 uploads / giờ
  message: 'Quá nhiều file được tải lên. Vui lòng thử lại sau.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ 
      success: false,
      error: 'Quá nhiều file được tải lên. Vui lòng thử lại sau 1 giờ.' 
    });
  }
});

// Rate limiter chung cho API
const apiLimiter = rateLimit({
  store: createRedisStore('api'),
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // 100 requests / 15 phút
  message: 'Quá nhiều request. Vui lòng thử lại sau.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  registerLimiter,
  uploadLimiter,
  apiLimiter
};
