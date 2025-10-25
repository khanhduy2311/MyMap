const express = require('express');
const router = express.Router();
const mindmapController = require('../controllers/mindmapController.js');
const authMiddleware = require('../middlewares/middlewares.js');
const { ObjectId } = require('mongodb');

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
router.get('/:id', authMiddleware.checkLoggedIn, mindmapController.getMindmapPage);
module.exports = router;