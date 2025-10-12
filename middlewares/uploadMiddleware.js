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

const upload = multer({ storage: storage });

module.exports = upload;
