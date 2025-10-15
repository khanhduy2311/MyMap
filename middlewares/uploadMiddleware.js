const multer = require('multer');
const path = require('path');

// Cấu hình lưu trữ file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Thư mục lưu file upload
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
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
    fileFilter: fileFilter
});

module.exports = upload;
