const express = require('express');
const router = express.Router();
const upload = require('../middlewares/documentUpload'); // Middleware multer
const { OpenAI } = require('openai');
const mammoth = require('mammoth');
const { default: pdfParse } = require('pdf-parse');
require('dotenv').config();

// Khởi tạo OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// lỗi
// === Route để HIỂN THỊ form upload ===
// Khi người dùng truy cập GET /upload
router.get('/', (req, res) => {
  res.render('upload', { pageTitle: 'Tải tài liệu', summary: null });
});


// === Route để XỬ LÝ file upload ===
// Khi form gửi dữ liệu tới POST /upload/document
router.post('/document', upload.single('documentFile'), async (req, res) => {
  try {
    // 1. Kiểm tra file có tồn tại không
    if (!req.file) {
      return res.status(400).send('Không có file nào được tải lên');
    }

    let text = '';
    // 2. Đọc nội dung file dựa vào loại file
    if (req.file.mimetype === 'application/pdf') {
      const data = await pdfParse(req.file.buffer);
      text = data.text;
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { // Check for .docx
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    } else {
      return res.status(400).send('Loại file không được hỗ trợ. Vui lòng tải lên file PDF hoặc DOCX.');
    }

    // 3. Gửi nội dung đã đọc tới OpenAI để tóm tắt
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Bạn là một trợ lý chuyên nghiệp chuyên tóm tắt văn bản một cách ngắn gọn và chính xác.' },
        { role: 'user', content: `Hãy tóm tắt nội dung sau đây thành những ý chính quan trọng nhất: ${text}` },
      ],
    });

    const summary = completion.choices[0].message.content;

    // 4. Render lại trang và hiển thị kết quả tóm tắt
    res.render('upload', { pageTitle: 'Tóm tắt tài liệu', summary: summary });

  } catch (err) {
    console.error(err); // Ghi lại lỗi chi tiết ở server
    res.status(500).send('Đã có lỗi xảy ra trong quá trình xử lý tài liệu.');
  }
});


module.exports = router;