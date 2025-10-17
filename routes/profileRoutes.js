// File: routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/middlewares.js');
const profileController = require('../controllers/profileController.js');
const uploadAvatarMiddleware = require('../middlewares/avatarUpload.js');

// GET: Trang xem profile
router.get('/', authMiddleware.checkLoggedIn, profileController.getProfilePage);

// GET: Trang sửa profile
router.get('/edit', authMiddleware.checkLoggedIn, profileController.getProfileEditPage);

// POST: Cập nhật thông tin user (name, username)
router.post('/update', authMiddleware.checkLoggedIn, profileController.updateUserProfile);

// POST: Cập nhật avatar
router.post(
  '/avatar',
  authMiddleware.checkLoggedIn,
  uploadAvatarMiddleware.single('avatar'),
  profileController.postAvatarUpload
);

module.exports = router;