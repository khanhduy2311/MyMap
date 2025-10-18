// File: controllers/profileController.js
const { ObjectId } = require('mongodb');
const userModel = require('../models/userModel.js');

// Hiển thị trang profile chính
exports.getProfilePage = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const user = await userModel.findUserById(db, req.session.user._id);
        res.render('profile', {
            pageTitle: 'Hồ sơ của bạn',
            user: user
        });
    } catch (err) {
        console.error('❌ Lỗi tải trang profile:', err);
        req.flash('error_msg', 'Không thể tải trang hồ sơ.');
        res.redirect('/dashboard');
    }
};

// Hiển thị trang chỉnh sửa profile
exports.getProfileEditPage = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const user = await userModel.findUserById(db, req.session.user._id);
        res.render('profile-edit', {
            pageTitle: 'Chỉnh sửa hồ sơ',
            user: user
        });
    } catch (err) {
        console.error('❌ Lỗi tải trang chỉnh sửa profile:', err);
        req.flash('error_msg', 'Không thể tải trang chỉnh sửa.');
        res.redirect('/profile');
    }
};

// Xử lý cập nhật thông tin (tên, username)
exports.updateUserProfile = async (req, res) => {
    const { userId, name, username } = req.body;
    const db = req.app.locals.db;

    if (!userId || !req.session.user || userId !== req.session.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Không được phép.' });
    }

    try {
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { name, username, updatedAt: new Date() } }
        );

        // Cập nhật session
        req.session.user.name = name;
        req.session.user.username = username;
        
        // === THAY ĐỔI Ở ĐÂY ===
        // 1. Gán một flash message vào session
        req.flash('success_msg', 'Cập nhật thông tin thành công!');

        // 2. Lưu session và gửi về tín hiệu success (không cần gửi message nữa)
        req.session.save(() => {
            res.json({ success: true });
        });

    } catch (err) {
        console.error('❌ Lỗi khi cập nhật thông tin:', err);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật.' });
    }
};

// Xử lý upload AVATAR
exports.postAvatarUpload = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = new ObjectId(req.session.user._id);

        if (!req.file || !req.file.path) {
            req.flash('error_msg', 'Vui lòng chọn ảnh hợp lệ!');
            return res.redirect('/profile');
        }
        const avatarUrl = req.file.path;
        const result = await userModel.updateUserAvatar(db, userId, avatarUrl);

        if (result.modifiedCount === 0) {
            req.flash('error_msg', 'Không thể cập nhật ảnh đại diện!');
            return res.redirect('/profile');
        }
        req.session.user.avatar = avatarUrl;
        req.flash('success_msg', 'Cập nhật ảnh đại diện thành công!');
        res.redirect('/profile');
    } catch (err) {
        console.error('❌ Lỗi upload avatar:', err);
        req.flash('error_msg', 'Đã xảy ra lỗi khi tải ảnh lên.');
        res.redirect('/profile');
    }
};