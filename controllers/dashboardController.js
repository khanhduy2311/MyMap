// File: controllers/dashboardController.js
const { ObjectId } = require('mongodb');
const userModel = require('../models/userModel.js');

exports.getDashboardPage = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = new ObjectId(req.session.user._id);

        // Lấy thông tin người dùng hiện tại
        const user = await userModel.findUserById(db, userId);

        // (Tương lai) Lấy danh sách mindmap của người dùng từ database
        // const mindmaps = await db.collection('mindmaps').find({ userId: userId }).toArray();
        const mindmaps = []; // Giả sử chưa có mindmap

        if (!user) {
            req.flash('error_msg', 'Không tìm thấy người dùng.');
            return res.redirect('/login');
        }

        res.render('dashboard', {
            pageTitle: 'Bảng điều khiển',
            user: user,
            mindmaps: mindmaps, // Truyền danh sách mindmap sang view
        });

    } catch (err) {
        console.error('❌ Lỗi khi tải trang dashboard:', err);
        req.flash('error_msg', 'Lỗi khi tải trang của bạn.');
        res.redirect('/login');
    }
};