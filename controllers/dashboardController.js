const { ObjectId } = require('mongodb');
const userModel = require('../models/userModel.js');

// HÀM HIỆN TẠI CỦA BẠN (ĐÃ ĐƯỢC CẬP NHẬT)
exports.getDashboardPage = async (req, res) => {
    try {
        const usersDb = req.app.locals.usersDb;
        const mindmapsDb = req.app.locals.mindmapsDb;
        // =========================

        const userId = new ObjectId(req.session.user._id);

        // Lấy thông tin người dùng từ usersDb
        const user = await userModel.findUserById(usersDb, userId);

        // === LOGIC LẤY MINDMAP ===
        const mindmapCollectionName = req.session.user._id.toString();

        // Truy vấn vào collection của riêng user đó
        const mindmaps = await mindmapsDb.collection(mindmapCollectionName)
                                 // THÊM BỘ LỌC: Chỉ lấy các mindmap chưa bị xóa
                                 .find({ deleted: { $ne: true } }) 
                                 .sort({ createdAt: -1 })
                                 .toArray();
        // ===================================

        if (!user) {
            req.flash('error_msg', 'Không tìm thấy người dùng.');
            return res.redirect('/login');
        }

        res.render('dashboard', {
            pageTitle: 'Bảng điều khiển',
            user: user, // user lấy từ db, không phải từ session, để có thông tin mới nhất
            mindmaps: mindmaps,
        });

    } catch (err) {
        console.error('❌ Lỗi khi tải trang dashboard:', err);
        req.flash('error_msg', 'Lỗi khi tải trang của bạn.');
        res.redirect('/login');
    }
};

// ================================================
// === HÀM CÒN THIẾU ĐÃ ĐƯỢC BỔ SUNG VÀO ĐÂY ===
// ================================================
exports.getTrashPage = async (req, res) => {
    try {
        const mindmapsDb = req.app.locals.mindmapsDb;
        const collectionName = req.session.user._id.toString();

        const deletedMindmaps = await mindmapsDb.collection(collectionName)
                                 .find({ deleted: true })
                                 .sort({ createdAt: -1 })
                                 .toArray();
        
        // === THÊM LOGIC TÍNH TOÁN NGÀY CÒN LẠI ===
        const mindmapsWithRemainingDays = deletedMindmaps.map(mindmap => {
            const retentionDays = 30; // Thời gian lưu trữ là 30 ngày
            const deletionDate = new Date(mindmap.deletedAt);
            const expirationDate = new Date(deletionDate.setDate(deletionDate.getDate() + retentionDays));
            const today = new Date();
            
            const diffTime = expirationDate - today;
            const remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

            // Trả về object mindmap mới có thêm thuộc tính remainingDays
            return { ...mindmap, remainingDays };
        });
        // ===========================================
        
        res.render('dashboard-trash', {
            pageTitle: 'Thùng rác',
            user: req.session.user,
            mindmaps: mindmapsWithRemainingDays, // Truyền danh sách đã được tính toán
        });
    } catch (err) {
        console.error('❌ Lỗi khi tải trang thùng rác:', err);
        req.flash('error_msg', 'Lỗi khi tải trang thùng rác.');
        res.redirect('/dashboard');
    }
};

exports.recoverMindmap = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        const mindmapId = new ObjectId(req.params.id);
        const collectionName = req.session.user._id.toString();

        // Cập nhật lại trường 'deleted' thành false
        const result = await db.collection(collectionName).updateOne(
            { _id: mindmapId },
            { $set: { deleted: false } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap để khôi phục.' });
        }

        // Trả về tín hiệu thành công
        res.json({ success: true, message: 'Khôi phục thành công!' });

    } catch (error) {
        console.error("Lỗi khi khôi phục mindmap:", error);
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};