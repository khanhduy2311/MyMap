const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Cấu hình Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. Hiển thị trang upload (Không thay đổi)
exports.getUploadPage = (req, res) => {
    res.render('upload', {
        pageTitle: 'Tải lên & Tóm tắt',
        summary: null // Giữ nguyên
    });
};

// Hàm xử lý upload và phân tích
exports.handleUploadAndSummarize = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Vui lòng chọn một file để tải lên.' });
        }

        const buffer = req.file.buffer;
        const mimetype = req.file.mimetype;
        let extractedText = '';

        // Đọc nội dung file (Giữ nguyên logic này)
        if (mimetype === 'application/pdf') {
            const data = await pdf(buffer);
            extractedText = data.text;
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
        } else if (mimetype === 'text/plain') {
            extractedText = buffer.toString('utf8');
        }

        if (!extractedText || extractedText.trim().length === 0) {
            return res.status(400).json({ error: 'Không thể đọc nội dung từ file này.' });
        }
        
        // Sửa lại tên model cho chính xác
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 
        const documentContent = extractedText.substring(0, 300000);

        const prompt = `
            Phân tích văn bản sau đây và trích xuất cấu trúc để tạo một sơ đồ tư duy (mindmap).
            Xác định chủ đề chính, các chủ đề phụ và các điểm chính trong mỗi chủ đề phụ.
            Chỉ trả lời bằng một đối tượng JSON hợp lệ duy nhất, không thêm bất kỳ văn bản giải thích hay markdown nào.
            JSON phải có cấu trúc như sau:
            {
              "mainTopic": "Chủ đề chính của văn bản",
              "subTopics": [
                {
                  "title": "Tiêu đề của chủ đề phụ 1",
                  "points": ["Điểm chính 1.1", "Điểm chính 1.2"]
                },
                {
                  "title": "Tiêu đề của chủ đề phụ 2",
                  "points": ["Điểm chính 2.1", "Điểm chính 2.2"]
                }
              ],
              "summary": "Một câu tóm tắt ngắn gọn về toàn bộ nội dung."
            }
            
            Văn bản cần phân tích:
            ---
            ${documentContent}
            ---
        `;

        const result = await model.generateContent(prompt);
        const rawText = result.response.text();

        // ✅ SỬA LỖI TẠI ĐÂY: Dọn dẹp chuỗi JSON trước khi parse
        // Loại bỏ các ký tự markdown ```json và ``` mà AI trả về
        const cleanedJsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        // Parse chuỗi JSON đã được làm sạch
        const analysisResult = JSON.parse(cleanedJsonText);

        // Trả về kết quả dưới dạng JSON
        res.status(200).json(analysisResult);

    } catch (error) {
        console.error('❌ Lỗi khi xử lý tài liệu:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi phân tích tài liệu: ' + error.message });
    }
};