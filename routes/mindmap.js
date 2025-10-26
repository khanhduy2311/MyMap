const express = require('express');
const router = express.Router();
const mindmapController = require('../controllers/mindmapController.js');
const authMiddleware = require('../middlewares/middlewares.js');
const { ObjectId } = require('mongodb');

router.post('/create-blank', authMiddleware.checkLoggedIn, mindmapController.createBlankMindmap);
router.patch('/:id', authMiddleware.checkLoggedIn, mindmapController.updateMindmapTitleAPI);
router.post('/create', authMiddleware.checkLoggedIn, mindmapController.createMindmap);
router.delete('/:id', authMiddleware.checkLoggedIn, mindmapController.deleteMindmap);


router.get('/view', authMiddleware.checkLoggedIn, (req, res) => {
    res.render('mindmapView', { 
        title: 'Sơ đồ tư duy của bạn',
        user: req.session.user
    });
});

router.get('/:id/json', authMiddleware.checkLoggedIn, async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        const mindmapId = req.params.id;
        
        // Validate ObjectId
        if (!ObjectId.isValid(mindmapId)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }
        
        const objectId = new ObjectId(mindmapId);
        const collectionName = req.session.user._id.toString();
        
        const mindmap = await db.collection(collectionName).findOne({ 
            _id: objectId, 
            deleted: { $ne: true } 
        });

        if (!mindmap) {
            return res.status(404).json({ error: 'Mindmap không tồn tại' });
        }

        res.json({
            success: true,
            data: {
                id: mindmap._id,
                title: mindmap.title,
                content: mindmap.content,
                createdAt: mindmap.createdAt,
                nodes: mindmap.nodes || [],
                edges: mindmap.edges || []
            }
        });

    } catch (error) {
        console.error('Error fetching mindmap JSON:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.patch(
  '/:id/save', // Route mới: /mindmaps/:id/save
  authMiddleware.checkLoggedIn, // Đảm bảo người dùng đã đăng nhập
  mindmapController.updateMindmapData // Hàm controller mới sẽ xử lý
);

router.get('/:id/json', authMiddleware.checkLoggedIn, async (req, res) => {
    // ... (logic hiện tại để lấy dữ liệu mindmap, có thể cần cập nhật để trả về nodes/edges nếu có) ...
    // --- CẬP NHẬT TRONG HÀM NÀY ---
    try {
        const db = req.app.locals.mindmapsDb;
        const mindmapId = req.params.id;

        if (!ObjectId.isValid(mindmapId)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const objectId = new ObjectId(mindmapId);
        const collectionName = req.session.user._id.toString();

        const mindmap = await db.collection(collectionName).findOne({
            _id: objectId,
            deleted: { $ne: true }
        });

        if (!mindmap) {
            return res.status(404).json({ success: false, error: 'Mindmap không tồn tại' });
        }

        // Trả về cả content (markdown) và dữ liệu nodes/edges nếu có
        res.json({
            success: true,
            data: {
                id: mindmap._id,
                title: mindmap.title,
                content: mindmap.content, // Giữ lại content markdown
                createdAt: mindmap.createdAt,
                // Trả về nodes/edges nếu chúng tồn tại trong DB, nếu không trả về mảng rỗng
                nodes: mindmap.nodes || [],
                edges: mindmap.edges || []
            }
        });

    } catch (error) {
        console.error('Error fetching mindmap JSON:', error);
        res.status(500).json({ success: false, error: 'Lỗi server' });
    }
    // --- KẾT THÚC CẬP NHẬT ---
});


router.get('/:id', authMiddleware.checkLoggedIn, mindmapController.getMindmapPage);
module.exports = router;