const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const {
    GoogleGenerativeAI
} = require("@google/generative-ai");

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
            return res.status(400).json({
                error: 'Vui lòng chọn một file để tải lên.'
            });
        }

        const buffer = req.file.buffer;
        const mimetype = req.file.mimetype;
        let extractedText = '';

        // Đọc nội dung file (Giữ nguyên logic này)
        if (mimetype === 'application/pdf') {
            const data = await pdf(buffer);
            extractedText = data.text;
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({
                buffer
            });
            extractedText = result.value;
        } else if (mimetype === 'text/plain') {
            extractedText = buffer.toString('utf8');
        }

        if (!extractedText || extractedText.trim().length === 0) {
            return res.status(400).json({
                error: 'Không thể đọc nội dung từ file này.'
            });
        }

        // Sửa lại tên model cho chính xác
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash"
        });
        const documentContent = extractedText.substring(0, 300000);

        const prompt = `
         Phân tích văn bản sau đây và trích xuất cấu trúc để tạo một sơ đồ tư duy (mindmap).
Xác định chủ đề chính, các chủ đề phụ và các điểm chính trong mỗi chủ đề phụ.
Chỉ trả lời bằng một đối tượng JSON hợp lệ duy nhất, không thêm bất kỳ văn bản giải thích hay markdown nào.
Json cần có cấu trúc như sau:
{
  "mainTopic": "Tên Môn Học Của Giáo Trình",
  "subTopics": [
    {
      "chapterTitle": "Chương I: Giới thiệu tổng quan",
      "mainSections": [
        {
          "title": "1. Khái niệm cơ bản",
          "subsections": [
            {
              "subtitle": "a. Định nghĩa A",
              "points": [
                "Nội dung ý chính đầu tiên của định nghĩa A.",
                "Nội dung ý chính thứ hai của định nghĩa A."
              ]
            },
            {
              "subtitle": "b. Lịch sử hình thành B",
              "points": [
                "Ý chính về lịch sử B."
              ]
            }
          ]
        },
        {
          "title": "2. Vai trò và tầm quan trọng",
          "subsections": [
            {
              "subtitle": "a. Đối với ngành",
              "points": [
                "Phân tích vai trò 1.",
                "Phân tích vai trò 2."
              ]
            }
          ]
        }
      ]
    },
    {
      "chapterTitle": "Chương II: Phân tích chuyên sâu",
      "mainSections": [
        {
          "title": "1. Mô hình XYZ",
          "subsections": []
        }
      ]
    }
  ],
  "summary": "Tóm tắt chung về toàn bộ giáo trình."
}
Đoạn trên là ví dụ về một đoạn mã Json, hãy bám theo đó đi theo các cấu trúc được đề ra (mainTopic -> subTopics -> chapterTitle -> titile -> subtitle -> points) lưu ý là các phân cấp nhỏ hơn ở bên trong một phân cấp lơn hơn đôi khi sẽ không tồn tại.
Có thể dựa vào phần mục lục để lấy ra các subTopics, chapterTitle từ đó đi vào đọc cụ thể trong văn bản để phân tích ra các title, subtitle (nếu có) 
Bản Json output cần đảm bảo đủ nội dung văn bản đề ra, chỉ tóm tắt các points lại thành các đoạn ngắn gọn, ngoài ra các phân cấp cao hơn nếu có không thể thiếu 
            
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
        res.status(500).json({
            error: 'Đã xảy ra lỗi khi phân tích tài liệu: ' + error.message
        });
    }
};