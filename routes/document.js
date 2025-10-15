const express = require('express');
const router = express.Router();
const upload = require('../middlewares/documentUpload'); // Middleware multer
const { OpenAI } = require('openai');
const mammoth = require('mammoth');
const { default: pdfParse } = require('pdf-parse');
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Khởi tạo Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 🧠 Test thử API khi khởi động server
(async () => {
  try {
    const testResult = await model.generateContent("Viết một câu chào ngắn gọn bằng tiếng Việt.");
    console.log("✅ Gemini API hoạt động:", testResult.response.text());
  } catch (err) {
    console.error("❌ Lỗi kiểm tra Gemini API:", err.message);
  }
})();

// Route GET: Trang tải tài liệu
router.get('/', (req, res) => {
  res.render('upload', { pageTitle: 'Tải tài liệu', summary: null });
});

// Route POST: Xử lý file upload
router.post('/document', upload.single('documentFile'), async (req, res) => {
  try {
    // 1. Kiểm tra file có tồn tại không
    if (!req.file) {
      return res.status(400).send('Không có file nào được tải lên');
    }

    let text = '';
    // 🧾 Đọc nội dung file PDF hoặc DOCX
    if (req.file.mimetype === 'application/pdf') {
      const data = await pdfParse(req.file.buffer);
      text = data.text;
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { // Check for .docx
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    } else {
      return res.status(400).send('Loại file không được hỗ trợ. Vui lòng tải lên file PDF hoặc DOCX.');
    }

    // 🧠 Gọi API Gemini để tóm tắt
    const prompt = `
    Bạn là một trợ lý AI chuyên nghiệp. 
    Hãy tóm tắt ngắn gọn, rõ ràng, nêu ý chính của đoạn văn sau:
    ${text}
    `;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    // ✅ Trả kết quả ra view
    res.render('upload', { pageTitle: 'Tóm tắt tài liệu', summary });
  } catch (err) {
    console.error(err); // Ghi lại lỗi chi tiết ở server
    res.status(500).send('Đã có lỗi xảy ra trong quá trình xử lý tài liệu.');
  }
});


module.exports = router;

