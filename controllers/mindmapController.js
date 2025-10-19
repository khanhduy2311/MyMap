// File: controllers/mindmapController.js
const { ObjectId } = require('mongodb');

// Tạo Mindmap
exports.createMindmap = async (req, res) => {
    try {
        // === THAY ĐỔI: Dùng mindmapsDb ===
        const db = req.app.locals.mindmapsDb;
        // ===============================

        const mindmapData = req.body;
        
        // Lấy tên collection của user từ session
        const collectionName = req.session.user._id.toString();

        // Tài liệu mới KHÔNG CẦN userId nữa
        const newMindmapDocument = {
            title: mindmapData.mainTopic,
            content: mindmapData,
            // userId: userId, // <-- Bỏ dòng này
            createdAt: new Date()
        };

        // Chèn vào collection của user
        await db.collection(collectionName).insertOne(newMindmapDocument);
        
        res.status(201).json({ message: 'Tạo mindmap thành công!' });

    } catch (error) {
        console.error("Lỗi khi lưu mindmap:", error);
        res.status(500).json({ error: 'Không thể lưu mindmap.' });
    }
};

// Xem chi tiết Mindmap
exports.getMindmapPage = async (req, res) => {
    try {
        // === THAY ĐỔI: Dùng mindmapsDb ===
        const db = req.app.locals.mindmapsDb;
        // ===============================
        
        const mindmapId = new ObjectId(req.params.id);
        
        // Lấy tên collection của user từ session
        const collectionName = req.session.user._id.toString();

        // Tìm mindmap trong collection của user
        const mindmap = await db.collection(collectionName).findOne({ _id: mindmapId });

        if (!mindmap) {
            return res.status(404).render('404', { pageTitle: 'Không tìm thấy Mindmap' });
        }

        res.render('mindmap-detail', {
            pageTitle: mindmap.title,
            mindmap: mindmap
        });

    } catch (error) {
        console.error("Lỗi khi xem chi tiết mindmap:", error);
        res.status(500).send("Lỗi server");
    }
};

// Xóa Mindmap
exports.deleteMindmap = async (req, res) => {
    // === THAY ĐỔI: Dùng mindmapsDb ===
    const db = req.app.locals.mindmapsDb;
    // ===============================
  
    try {
        const mindmapId = req.params.id;
        
        // Lấy tên collection của user từ session
        const collectionName = req.session.user._id.toString();

        let mindmapObjectId;
        try {
            mindmapObjectId = new ObjectId(mindmapId);
        } catch (error) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        // Xóa mindmap khỏi collection của user
        // Logic `userId` không cần thiết nữa vì đã được bảo mật ở cấp collection
        const result = await db.collection(collectionName).deleteOne({
            _id: mindmapObjectId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy mindmap.' 
            });
        }

        res.json({ success: true, message: 'Đã xóa thành công' });

    } catch (error) {
        console.error('Lỗi khi xóa mindmap:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};