const multer = require('multer');

// Bộ nhớ tạm thời trong RAM (vì ta sẽ đẩy trực tiếp lên MongoDB)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Giới hạn 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Chỉ chấp nhận file PDF hoặc DOCX'));
    }
    cb(null, true);
  }
});

module.exports = upload;
