// File: routes/document.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// THÊM ĐOẠN NÀY VÀO: Route để hiển thị trang upload
router.get('/', (req, res) => {
    res.render('upload', {
        pageTitle: 'Upload & Tóm tắt',
        summary: null // Ban đầu chưa có kết quả tóm tắt
    });
});

// Cấu hình Multer để nhận file
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file PDF, DOCX, hoặc TXT!'));
    }
  }
});

// Cấu hình Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Route để upload và tóm tắt
// Thay thế toàn bộ hàm này trong file routes/document.js

router.post('/document', upload.single('documentFile'), async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error_msg', 'Vui lòng chọn một file để tải lên.');
      return res.redirect('/upload');
    }

    let extractedText = '';
    const buffer = req.file.buffer;
    const mimetype = req.file.mimetype;

    if (mimetype === 'text/plain') {
      extractedText = buffer.toString('utf8');
    } else if (mimetype === 'application/pdf') {
      const data = await pdf(buffer);
      extractedText = data.text;
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: buffer });
      extractedText = result.value;
    }

    if (!extractedText) {
        req.flash('error_msg', 'Không thể đọc nội dung từ file này.');
        return res.redirect('/upload');
    }

    // === SỬA Ở ĐÂY ===
    // Sử dụng tên model mới, nhanh và hiệu quả hơn
    const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
    
    const prompt = `Tóm tắt nội dung sau đây thành một đoạn văn ngắn gọn, dễ hiểu: "${extractedText.substring(0, 8000)}"`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    res.render('upload', {
        pageTitle: 'Upload & Tóm tắt',
        summary: summary
    });

 // Thay thế khối catch (error) { ... } trong file routes/document.js

} catch (error) {
    console.error('❌ Lỗi khi xử lý tài liệu:', error.message);
    
    // THAY VÌ CHUYỂN HƯỚNG, RENDER LẠI TRANG UPLOAD VỚI THÔNG BÁO LỖI
    res.render('upload', {
        pageTitle: 'Lỗi Tóm tắt',
        summary: null, // Không có tóm tắt khi bị lỗi
        // Truyền biến lỗi để hiển thị ra cho người dùng
        error: 'Đã xảy ra lỗi khi tóm tắt file: ' + error.message
    });
}
});

module.exports = router;