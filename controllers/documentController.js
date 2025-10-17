// File: controllers/documentController.js
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Cấu hình Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. Hiển thị trang upload
exports.getUploadPage = (req, res) => {
    res.render('upload', {
        pageTitle: 'Tải lên & Tóm tắt',
        summary: null
    });
};

// 2. Xử lý file, gọi AI và trả về kết quả
exports.handleUploadAndSummarize = async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error_msg', 'Vui lòng chọn một file để tải lên.');
            return res.redirect('/upload/page');
        }

        const buffer = req.file.buffer;
        const mimetype = req.file.mimetype;
        let extractedText = '';

        // Đọc nội dung file
        if (mimetype === 'application/pdf') {
            const data = await pdf(buffer);
            extractedText = data.text;
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
        }

        if (!extractedText || extractedText.trim().length === 0) {
            req.flash('error_msg', 'Không thể đọc nội dung từ file này.');
            return res.redirect('/upload/page');
        }

        // Gọi Gemini AI để tóm tắt
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // ✅ THAY ĐỔI 1: Tăng giới hạn ký tự lên rất nhiều
        // Giờ đây chúng ta sẽ gửi đi 300,000 ký tự đầu tiên
        const documentContent = extractedText.substring(0, 300000);

        // ✅ THAY ĐỔI 2: Cải thiện câu lệnh (prompt) để phù hợp với việc làm Mindmap
        const prompt = `
        Bạn là một trợ lý chuyên nghiệp, hãy phân tích và tóm tắt tài liệu sau đây để chuẩn bị tạo một sơ đồ tư duy (mindmap).
        Vui lòng trích xuất và trình bày các ý chính theo cấu trúc sau:
        
        1.  **Chủ đề chính:** Nêu rõ chủ đề bao quát của toàn bộ tài liệu.
        2.  **Các chương/phần chính:** Liệt kê các chương hoặc các phần quan trọng nhất dưới dạng gạch đầu dòng.
        3.  **Các khái niệm cốt lõi:** Với mỗi chương/phần chính, rút ra vài khái niệm hoặc định nghĩa quan trọng nhất.
        
        Nội dung tài liệu:
        ---
        "${documentContent}"
        ---
        `;

        const result = await model.generateContent(prompt);
        const summary = result.response.text();

        // Render lại trang upload với kết quả tóm tắt
        res.render('upload', {
            pageTitle: 'Kết quả Tóm tắt',
            summary: summary
        });

    } catch (error) {
        console.error('❌ Lỗi khi xử lý tài liệu:', error);
        req.flash('error_msg', 'Đã xảy ra lỗi: ' + error.message);
        res.redirect('/upload/page');
    }
};