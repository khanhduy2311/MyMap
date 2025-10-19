// File: controllers/mindmapController.js
const { ObjectId } = require('mongodb');

/**
 * Tạo một Mindmap mới.
 * Nhận { title, content } từ client, trong đó content là một chuỗi Markdown.
 */
exports.createMindmap = async (req, res) => {
    try {
        // Sử dụng database 'mindmapsDb' đã được truyền qua request
        const db = req.app.locals.mindmapsDb;
        
        // Lấy title và content từ body của request
        const { title, content } = req.body;
        
        // Lấy tên collection của user (chính là _id của họ) từ session
        const collectionName = req.session.user._id.toString();

        // Kiểm tra dữ liệu đầu vào
        if (!title || !content) {
            return res.status(400).json({ error: 'Thiếu title hoặc content.' });
        }

        // Chuẩn bị document mới để lưu vào collection của user
        // Document này không cần 'userId' nữa vì đã được phân tách ở cấp collection
        const newMindmapDocument = {
            title: title,       // Title đã được client trích xuất
            content: content,   // Toàn bộ chuỗi Markdown từ client
            createdAt: new Date()
        };

        // Chèn document vào collection dành riêng cho user này
        await db.collection(collectionName).insertOne(newMindmapDocument);
        
        // Phản hồi thành công
        res.status(201).json({ message: 'Tạo mindmap thành công!' });

    } catch (error) {
        console.error("Lỗi khi lưu mindmap:", error);
        res.status(500).json({ error: 'Không thể lưu mindmap.' });
    }
};

/**
 * Lấy trang chi tiết của một Mindmap.
 */
exports.getMindmapPage = async (req, res) => {
    try {
        // Sử dụng database 'mindmapsDb'
        const db = req.app.locals.mindmapsDb;
        const mindmapId = new ObjectId(req.params.id);
        
        // Lấy tên collection của user từ session
        const collectionName = req.session.user._id.toString();

        // Tìm mindmap theo _id trong collection của user
        const mindmap = await db.collection(collectionName).findOne({ _id: mindmapId });

        if (!mindmap) {
            // Nếu không tìm thấy, render trang 404
            return res.status(404).render('404', { pageTitle: 'Không tìm thấy Mindmap' });
        }

        // Render trang 'mindmap-detail' và truyền dữ liệu (chứa content là Markdown)
        res.render('mindmap-detail', {
            pageTitle: mindmap.title,
            mindmap: mindmap
        });

    } catch (error) {
        console.error("Lỗi khi xem chi tiết mindmap:", error);
        res.status(500).send("Lỗi server");
    }
};

/**
 * Xóa một Mindmap.
 */
exports.deleteMindmap = async (req, res) => {
    try {
        // Sử dụng database 'mindmapsDb'
        const db = req.app.locals.mindmapsDb;
        const mindmapId = new ObjectId(req.params.id);
        
        // Lấy tên collection của user từ session
        const collectionName = req.session.user._id.toString();
        
        // Xóa document khỏi collection của user
        // Logic bảo mật đã được đảm bảo vì chúng ta chỉ thao tác trong collection của user đó
        const result = await db.collection(collectionName).deleteOne({ _id: mindmapId });

        if (result.deletedCount === 0) {
            // Không tìm thấy document để xóa
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap.' });
        }

        // Phản hồi thành công
        res.json({ success: true, message: 'Đã xóa thành công' });

    } catch (error) {
        console.error('Lỗi khi xóa mindmap:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

