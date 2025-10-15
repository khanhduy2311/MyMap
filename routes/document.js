// File: routes/document.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Cấu hình multer đơn giản
const upload = multer({
  dest: 'public/uploads/documents/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExt)) {
      return cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file PDF và DOCX!'));
    }
  }
});

// Upload document route
router.post('/document', upload.single('documentFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn file tài liệu!'
            });
        }

        // Mock AI response
        const mockSummary = `
        📄 **TÓM TẮT TÀI LIỆU**
        
        Tài liệu "${req.file.originalname}" đã được upload thành công! 
        
        📊 **Thông tin file:**
        - Tên: ${req.file.originalname}
        - Kích thước: ${(req.file.size / 1024 / 1024).toFixed(2)} MB
        - Thời gian: ${new Date().toLocaleTimeString('vi-VN')}
        
        🎯 **Tính năng AI tóm tắt** hiện đang được nâng cấp.
        `;

        res.json({
            success: true,
            summary: mockSummary,
            message: "Document uploaded successfully"
        });

    } catch (error) {
        console.error('❌ Lỗi khi xử lý tài liệu:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xử lý tài liệu: ' + error.message
        });
    }
});

module.exports = router;