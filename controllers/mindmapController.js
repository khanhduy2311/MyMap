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
            createdAt: new Date(),
            deleted: false // 
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
    try {
        const db = req.app.locals.mindmapsDb;
        const mindmapId = new ObjectId(req.params.id);
        const collectionName = req.session.user._id.toString();

        // THAY ĐỔI: Thêm trường `deletedAt` với ngày giờ hiện tại
        const result = await db.collection(collectionName).updateOne(
            { _id: mindmapId },
            { $set: { deleted: true, deletedAt: new Date() } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap.' });
        }
        res.json({ success: true, message: 'Đã chuyển vào thùng rác' });
    } catch (error) {
        console.error('Lỗi khi xóa mindmap:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};


//- code từm lưm--------------------------------------------------


// === THÊM HÀM MỚI ĐỂ XỬ LÝ API UPDATE ===
exports.updateMindmapTitleAPI = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        const mindmapId = new ObjectId(req.params.id);
        const collectionName = req.session.user._id.toString();
        const { title } = req.body; // Lấy tên mới từ request

        if (!title || title.trim() === '') {
            return res.status(400).json({ success: false, message: 'Tên không được để trống.' });
        }

        const result = await db.collection(collectionName).updateOne(
            { _id: mindmapId },
            { $set: { title: title } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap hoặc tên không có gì thay đổi.' });
        }

        // Trả về kết quả thành công dưới dạng JSON
        res.json({ success: true, message: 'Cập nhật thành công!', newTitle: title });

    } catch (error) {
        console.error("Lỗi khi cập nhật tên mindmap qua API:", error);
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};