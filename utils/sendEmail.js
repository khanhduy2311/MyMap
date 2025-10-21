// File: utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Tạo transporter (dịch vụ gửi mail)
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // 2. Định nghĩa các tùy chọn email
  const mailOptions = {
    from: `MindTree <${process.env.EMAIL_FROM}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  // 3. Gửi email
  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email đã được gửi đi.');
  } catch (error) {
    console.error('❌ Lỗi khi gửi email:', error);
  }
};

module.exports = sendEmail;