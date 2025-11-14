const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Cấu hình lưu trữ file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // TODO: Có thể tách theo userId trong tương lai, ví dụ: `uploads/documents/<userId>`
      cb(null, 'uploads/'); // Thư mục lưu file upload
    },
    filename: function (req, file, cb) {
      // Đặt tên file ngẫu nhiên + giữ lại phần mở rộng để tránh đoán tên file
      const randomName = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname) || '';
      cb(null, `${Date.now()}-${randomName}${ext}`);
    }
});
const fileFilter = (req, file, cb) => {
  // Các loại file được chấp nhận
  const allowedMimeTypes = [
    'application/pdf', // Cho file .pdf
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // Cho file .docx
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    // Chấp nhận file
    cb(null, true);
  } else {
    // Từ chối file và trả về lỗi
    cb(new Error('File không đúng định dạng! Chỉ chấp nhận file PDF hoặc DOCX.'), false);
  }
};
const upload = multer({ 
  storage: storage, 
  fileFilter: fileFilter,
  // Giới hạn kích thước file để tránh upload quá lớn (ví dụ: 20MB)
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

module.exports = upload;
