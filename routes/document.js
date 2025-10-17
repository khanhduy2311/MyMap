// File: routes/document.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middlewares/middlewares.js');
const documentController = require('../controllers/documentController.js');

// Cấu hình Multer để nhận file
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // Tối đa 10MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận file PDF hoặc DOCX!'));
        }
    }
});

// GET: Route để hiển thị trang upload
router.get('/page', authMiddleware.checkLoggedIn, documentController.getUploadPage);

// POST: Route để xử lý việc upload và tóm tắt
router.post('/summarize',
    authMiddleware.checkLoggedIn,
    upload.single('documentFile'), // Middleware của Multer
    documentController.handleUploadAndSummarize
);

module.exports = router;