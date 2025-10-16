// File: routes/document.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ===== Hiển thị trang upload =====
router.get('/', (req, res) => {
  res.render('upload', {
    pageTitle: 'Upload & Tóm tắt',
    summary: null,
    error: null
  });
});

// ===== Cấu hình Multer =====
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
      cb(new Error('Chỉ chấp nhận file PDF, DOCX hoặc TXT!'));
    }
  }
});

// ===== Cấu hình Gemini AI =====
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ===== Route upload và tóm tắt =====
router.post('/document', upload.single('documentFile'), async (req, res) => {
  try {
    // Không có file
    if (!req.file) {
      return res.render('upload', {
        pageTitle: 'Upload & Tóm tắt',
        summary: null,
        error: '❌ Vui lòng chọn một file để tải lên.'
      });
    }

    const buffer = req.file.buffer;
    const mimetype = req.file.mimetype;
    let extractedText = '';

    // === Đọc file tùy loại ===
    if (mimetype === 'text/plain') {
      extractedText = buffer.toString('utf8');
    } else if (mimetype === 'application/pdf') {
      const data = await pdf(buffer);
      extractedText = data.text;
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.render('upload', {
        pageTitle: 'Upload & Tóm tắt',
        summary: null,
        error: '⚠️ Không thể đọc nội dung từ file này.'
      });
    }

    // === Gọi Gemini AI để tóm tắt ===
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // model nhanh và mới nhất

    const prompt = `
      Hãy tóm tắt nội dung dưới đây thành 1 đoạn văn ngắn gọn, dễ hiểu bằng tiếng Việt:
      "${extractedText.substring(0, 8000)}"
    `;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    // === Render lại trang upload với kết quả ===
    res.render('upload', {
      pageTitle: 'Upload & Tóm tắt',
      summary,
      error: null
    });

  } catch (error) {
    console.error('❌ Lỗi khi xử lý tài liệu:', error);

    // Render lại với lỗi
    res.render('upload', {
      pageTitle: 'Lỗi Tóm tắt',
      summary: null,
      error: 'Đã xảy ra lỗi khi tóm tắt file: ' + error.message
    });
  }
});

module.exports = router;
