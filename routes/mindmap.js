const express = require('express');
const router = express.Router();
const mindmapController = require('../controllers/mindmapController.js');
const authMiddleware = require('../middlewares/middlewares.js');

router.patch('/:id', authMiddleware.checkLoggedIn, mindmapController.updateMindmapTitleAPI);

// API endpoint: POST /mindmaps/create
router.post('/create', authMiddleware.checkLoggedIn, mindmapController.createMindmap);
router.get('/:id', authMiddleware.checkLoggedIn, mindmapController.getMindmapPage);
router.delete('/:id', authMiddleware.checkLoggedIn, mindmapController.deleteMindmap);
router.get('/view', authMiddleware.checkLoggedIn, (req, res) => {
    // Chỉ cần render ra file view EJS, không cần truyền data ở đây
    // Vì data sẽ được lấy từ localStorage phía client
    res.render('mindmapView', { 
        title: 'Sơ đồ tư duy của bạn',
        user: req.session.user // Truyền thông tin user nếu cần cho layout
    });
});
module.exports = router;

