// File: controllers/profileController.js
const { ObjectId } = require('mongodb');
const userModel = require('../models/userModel.js');
const { sanitizeUser } = require('../utils/sanitizeUser');
const { ok, fail } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// Hiển thị trang profile chính
exports.getProfilePage = async (req, res) => {
    try {
        // Lấy kết nối đến cả 2 database
        const usersDb = req.app.locals.usersDb;
        const mindmapsDb = req.app.locals.mindmapsDb; // <-- Lấy kết nối mindmapsDb

        // Lấy thông tin user (giữ nguyên)
        const user = await userModel.findUserById(usersDb, req.session.user._id);

        if (!user) {
            req.flash('error_msg', 'Không tìm thấy người dùng.');
            return res.redirect('/dashboard');
        }

        const collectionName = req.session.user._id.toString();
        const mindmapCount = await mindmapsDb.collection(collectionName).countDocuments({});

        // Gán số lượng đếm được vào đối tượng user
        user.projectCount = mindmapCount;


        res.render('profile', {
            pageTitle: 'Hồ sơ của bạn',
            user: user // Đối tượng user bây giờ đã chứa thuộc tính projectCount
        });

    } catch (err) {
        logger.error('Lỗi tải trang profile', { error: err, userId: req.session.user._id });
        req.flash('error_msg', 'Không thể tải trang hồ sơ.');
        res.redirect('/dashboard');
    }
};

// Hiển thị trang chỉnh sửa profile
exports.getProfileEditPage = async (req, res) => {
    try {
        // === THAY ĐỔI: Dùng usersDb ===
        const db = req.app.locals.usersDb;
        // =============================
        const user = await userModel.findUserById(db, req.session.user._id);
        res.render('profile-edit', {
            pageTitle: 'Chỉnh sửa hồ sơ',
            user: user
        });
    } catch (err) {
        logger.error('Lỗi tải trang chỉnh sửa profile', { error: err, userId: req.session.user._id });
        req.flash('error_msg', 'Không thể tải trang chỉnh sửa.');
        res.redirect('/profile');
    }
};

// Xử lý cập nhật thông tin (tên, username)
exports.updateUserProfile = async (req, res) => {
    const {
        userId,
        name,
        username
    } = req.body;
    // === THAY ĐỔI: Dùng usersDb ===
    const db = req.app.locals.usersDb;
    // =============================

    if (!userId || !req.session.user || userId !== req.session.user._id.toString()) {
        return fail(res, 403, 'FORBIDDEN', 'Không được phép.');
    }

    try {
        // Tác vụ này vẫn ở collection 'users' trong 'usersDb'
        await db.collection('users').updateOne({
            _id: new ObjectId(userId)
        }, {
            $set: {
                name,
                username,
                updatedAt: new Date()
            }
        });

        // Cập nhật session
        req.session.user.name = name;
        req.session.user.username = username;

        req.flash('success_msg', 'Cập nhật thông tin thành công!');
        req.session.save(() => {
            return ok(res);
        });

    } catch (err) {
        logger.error('Lỗi khi cập nhật thông tin', { error: err, userId });
        return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi máy chủ khi cập nhật.');
    }
};

// Xử lý upload AVATAR
exports.postAvatarUpload = async (req, res) => {
    try {
        // === THAY ĐỔI: Dùng usersDb ===
        const db = req.app.locals.usersDb;
        // =============================
        const userId = new ObjectId(req.session.user._id);

        if (!req.file || !req.file.path) {
            req.flash('error_msg', 'Vui lòng chọn ảnh hợp lệ!');
            return res.redirect('/profile');
        }
        const avatarUrl = req.file.path;

        // Tác vụ này ở 'usersDb'
        const result = await userModel.updateUserAvatar(db, userId, avatarUrl);

        if (result.modifiedCount === 0) {
            req.flash('error_msg', 'Không thể cập nhật ảnh đại diện!');
            return res.redirect('/profile');
        }
        req.session.user.avatar = avatarUrl;
        req.flash('success_msg', 'Cập nhật ảnh đại diện thành công!');
        res.redirect('/profile');
    } catch (err) {
        logger.error('Lỗi upload avatar', { error: err, userId: req.session.user._id });
        req.flash('error_msg', 'Đã xảy ra lỗi khi tải ảnh lên.');
        res.redirect('/profile');
    }
};

exports.changePassword = async (req, res) => {
    const { password, confirmPassword } = req.body;
    const usersDb = req.app.locals.usersDb;
    const userId = new ObjectId(req.session.user._id);
    try {
        if (!password || !confirmPassword) {
            logger.warn('Change password: missing fields', { userId: req.session.user._id });
            req.flash('error_msg', 'Vui lòng nhập đầy đủ mật khẩu mới và xác nhận.');
            return res.redirect('/profile/edit');
        }
        
        if (password !== confirmPassword) {
            logger.warn('Change password: passwords do not match', { userId: req.session.user._id });
            req.flash('error_msg', 'Mật khẩu xác nhận không khớp.');
            return res.redirect('/profile/edit');
        }
        const result = await usersDb.collection('users').updateOne(
            { _id: userId },
            {
                $set: {
                    password: password, // TODO: Cần hash password bằng bcrypt
                    updatedAt: new Date()
                }
            }
        );

        if (result.modifiedCount === 1) {
            logger.info('Password updated successfully', { userId: req.session.user._id });
            req.flash('success_msg', 'Cập nhật mật khẩu thành công!');
            res.redirect('/profile');
        } else {
            logger.warn('Password update: no record modified', { userId: req.session.user._id });
            req.flash('error_msg', 'Không thể cập nhật mật khẩu!');
            res.redirect('/profile/edit');
        }

    } catch (err) {
        logger.error('Lỗi đổi mật khẩu', { error: err, userId: req.session.user._id });
        req.flash('error_msg', 'Đã xảy ra lỗi khi đổi mật khẩu.');
        res.redirect('/profile/edit');
    }
};