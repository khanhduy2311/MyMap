const { ObjectId } = require('mongodb');
const userModel = require('../models/userModel.js');

exports.getDashboardPage = async (req, res) => {
    try {
        const usersDb = req.app.locals.usersDb;
        const mindmapsDb = req.app.locals.mindmapsDb;
        // =========================

        const userId = new ObjectId(req.session.user._id);

        // Lấy thông tin người dùng từ usersDb
        const user = await userModel.findUserById(usersDb, userId);

        // === THAY ĐỔI LOGIC LẤY MINDMAP ===
        // 1. Lấy tên collection của user (chính là _id của họ)
        const mindmapCollectionName = req.session.user._id.toString();

        // 2. Truy vấn vào collection CỦA RIÊNG USER ĐÓ
        const mindmaps = await mindmapsDb.collection(mindmapCollectionName)
                                 .find({}) // Không cần lọc theo userId nữa
                                 .sort({ createdAt: -1 })
                                 .toArray();
        // ===================================

        if (!user) {
            req.flash('error_msg', 'Không tìm thấy người dùng.');
            return res.redirect('/login');
        }

        res.render('dashboard', {
            pageTitle: 'Bảng điều khiển',
            user: user,
            mindmaps: mindmaps, // Truyền danh sách mindmap
        });

    } catch (err) {
        console.error('❌ Lỗi khi tải trang dashboard:', err);
        req.flash('error_msg', 'Lỗi khi tải trang của bạn.');
        res.redirect('/login');
    }
};