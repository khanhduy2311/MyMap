const { redis } = require('../utils/redisClient');

const MAX_ATTEMPTS = 5;
const BLOCK_TIME_SECONDS = 15 * 60;

function getKey(email) {
  return `login_attempts:${email.toLowerCase()}`;
}

async function isBlocked(email) {
  const blockedKey = getKey(email) + ':blocked';
  const ttl = await redis.ttl(blockedKey);
  if (ttl && ttl > 0) {
    return ttl;
  }
  return 0;
}

async function incrementFail(email) {
  const key = getKey(email);
  const blockedKey = key + ':blocked';

  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, BLOCK_TIME_SECONDS);
  }
  if (attempts >= MAX_ATTEMPTS) {
    await redis.set(blockedKey, '1', 'EX', BLOCK_TIME_SECONDS);
  }
  return attempts;
}

async function resetAttempts(email) {
  const key = getKey(email);
  const blockedKey = key + ':blocked';
  await redis.del(key);
  await redis.del(blockedKey);
}

async function loginBruteForceGuard(req, res, next) {
  const { email } = req.body || {};
  if (!email) return next();

  try {
    const ttl = await isBlocked(email);
    if (ttl > 0) {
      const minutes = Math.ceil(ttl / 60);
      req.flash(
        'error_msg',
        `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau khoảng ${minutes} phút.`
      );
      return res.redirect('/login');
    }
    next();
  } catch (err) {
    console.error('❌ Lỗi loginBruteForceGuard:', err);
    next();
  }
}

module.exports = {
  loginBruteForceGuard,
  incrementFail,
  resetAttempts,
};
