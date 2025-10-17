const { ObjectId } = require('mongodb');

exports.createMindmap = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const mindmapData = req.body;
        const userId = new ObjectId(req.session.user._id);

        const newMindmapDocument = {
            title: mindmapData.mainTopic,
            content: mindmapData,
            userId: userId,
            createdAt: new Date()
        };

        await db.collection('mindmaps').insertOne(newMindmapDocument);
        res.status(201).json({ message: 'Tạo mindmap thành công!' });

    } catch (error) {
        console.error("Lỗi khi lưu mindmap:", error);
        res.status(500).json({ error: 'Không thể lưu mindmap.' });
    }
};

exports.getMindmapPage = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const mindmapId = new ObjectId(req.params.id); // Lấy ID từ URL

        // Tìm mindmap trong database bằng ID
        const mindmap = await db.collection('mindmaps').findOne({ _id: mindmapId });

        if (!mindmap) {
            // Nếu không tìm thấy, hiển thị trang 404
            return res.status(404).render('404', { pageTitle: 'Không tìm thấy Mindmap' });
        }

        // Render ra một trang view mới tên là 'mindmap-detail' và gửi dữ liệu qua
        res.render('mindmap-detail', {
            pageTitle: mindmap.title,
            mindmap: mindmap // Gửi toàn bộ đối tượng mindmap qua
        });

    } catch (error) {
        console.error("Lỗi khi xem chi tiết mindmap:", error);
        res.status(500).send("Lỗi server");
    }
};