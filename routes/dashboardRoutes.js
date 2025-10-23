const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/middlewares.js');
const dashboardController = require('../controllers/dashboardController.js');
// Thêm dòng này để import middleware noCache
const noCache = require('../middlewares/noCache.js');

// Route chính sau khi đăng nhập
// Thêm noCache vào giữa authMiddleware và dashboardController
router.get('/', authMiddleware.checkLoggedIn, noCache, dashboardController.getDashboardPage);
router.get('/trash', authMiddleware.checkLoggedIn, noCache, dashboardController.getTrashPage);
router.patch('/trash/recover/:id', authMiddleware.checkLoggedIn, dashboardController.recoverMindmap);
// [DELETE] Xóa vĩnh viễn 1 mục (THÊM MỚI)
router.delete('/trash/delete/:id', authMiddleware.checkLoggedIn, dashboardController.deleteMindmapPermanently);

// [DELETE] Xóa vĩnh viễn tất cả (THÊM MỚI)
router.delete('/trash/empty', authMiddleware.checkLoggedIn, dashboardController.emptyTrash);

// === THÊM MỚI: [GET] Trang danh sách thư mục ===
router.get('/folder', authMiddleware.checkLoggedIn, noCache, dashboardController.getFoldersPage);

// [POST] Tạo một thư mục mới
router.post('/folders', authMiddleware.checkLoggedIn, dashboardController.createFolder);

router.delete('/folders/:id', authMiddleware.checkLoggedIn, dashboardController.deleteFolder);

// === THÊM MỚI: [PATCH] Đổi tên một thư mục ===
router.patch('/folders/:id/rename', authMiddleware.checkLoggedIn, dashboardController.renameFolder);


// [GET] Xem nội dung một thư mục (hỗ trợ cả tìm kiếm/phân trang)
router.get('/folders/:id', authMiddleware.checkLoggedIn, noCache, dashboardController.getFolderPage);

// [PATCH] Di chuyển một mindmap vào thư mục
router.patch('/mindmaps/:id/move', authMiddleware.checkLoggedIn, dashboardController.moveMindmap);




// === THÊM MỚI: API GỢI Ý TÌM KIẾM TRASH ===
router.get('/trash/api/search-suggestions', authMiddleware.checkLoggedIn, dashboardController.getTrashSearchSuggestions);

// === API GỢI Ý TÌM KIẾM (CHUNG) ===
router.get('/api/search-suggestions', authMiddleware.checkLoggedIn, dashboardController.getSearchSuggestions);

module.exports = router;