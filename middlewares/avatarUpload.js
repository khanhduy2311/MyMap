require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cấu hình lưu trữ multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mindmap_avatars',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif']
  },
});

const uploadAvatar = multer({ storage });

module.exports = uploadAvatar;
