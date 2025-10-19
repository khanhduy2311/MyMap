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
        const newMindmapDocument = {
            title: mindmapData.mainTopic,
            content: mindmapData,
            createdAt: new Date(),
            deleted: false 
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
    const db = req.app.locals.mindmapsDb;
  
    try {
        const mindmapId = req.params.id;
        const collectionName = req.session.user._id.toString();

        let mindmapObjectId;
        try {
            mindmapObjectId = new ObjectId(mindmapId);
        } catch (error) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

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
