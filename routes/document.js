// File: routes/document.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ===== Cấu hình Multer =====
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // tối đa 10MB
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

// ===== Route xử lý upload và tóm tắt tài liệu =====
router.post('/document', upload.single('documentFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, error: '❌ Vui lòng chọn một file để tải lên.' });
    }

    const buffer = req.file.buffer;
    const mimetype = req.file.mimetype;
    let extractedText = '';

    // === Đọc nội dung file ===
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
      return res.json({ success: false, error: '⚠️ Không thể đọc nội dung từ file này.' });
    }

    // === Gọi Gemini AI để tóm tắt ===
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Hãy tóm tắt nội dung dưới đây thành 1 đoạn văn ngắn gọn, dễ hiểu bằng tiếng Việt:
      "${extractedText.substring(0, 8000)}"
    `;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    // ✅ Trả kết quả JSON về cho frontend (fetch)
    return res.json({ success: true, summary });

  } catch (error) {
    console.error('❌ Lỗi khi xử lý tài liệu:', error);
    return res.json({ success: false, error: 'Đã xảy ra lỗi khi tóm tắt file: ' + error.message });
  }
});

module.exports = router;
