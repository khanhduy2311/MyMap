const { ObjectId } = require('mongodb');
const userModel = require('../models/userModel.js');

exports.getDashboardPage = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = new ObjectId(req.session.user._id);

        // Lấy thông tin người dùng hiện tại
        const user = await userModel.findUserById(db, userId);

        // ✅ THAY ĐỔI TẠI ĐÂY:
        // Bỏ dòng giả lập và thực hiện truy vấn database thật
        const mindmaps = await db.collection('mindmaps')
                                 .find({ userId: userId })
                                 .sort({ createdAt: -1 }) // Sắp xếp để cái mới nhất lên đầu
                                 .toArray();
        // const mindmaps = []; // Xóa dòng này đi

        if (!user) {
            req.flash('error_msg', 'Không tìm thấy người dùng.');
            return res.redirect('/login');
        }

        res.render('dashboard', {
            pageTitle: 'Bảng điều khiển',
            user: user,
            mindmaps: mindmaps, // Truyền danh sách mindmap thật sang view
        });

    } catch (err) {
        console.error('❌ Lỗi khi tải trang dashboard:', err);
        req.flash('error_msg', 'Lỗi khi tải trang của bạn.');
        res.redirect('/login');
    }
};