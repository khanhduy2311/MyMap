// File: routes/document.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const authMiddleware = require('../middlewares/middlewares.js');
const documentController = require('../controllers/documentController.js');

// === BẮT ĐẦU SỬA ĐỔI: QUẢN LÝ API KEYS ===

// 1. Đọc danh sách API keys từ file .env
// Nó sẽ đọc biến GEMINI_API_KEYS, cắt chuỗi tại các dấu phẩy, và loại bỏ các key rỗng.
const apiKeys = (process.env.GEMINI_API_KEYS || '').split(',').filter(k => k.trim());

// Kiểm tra xem có key nào được cung cấp không
if (!apiKeys || apiKeys.length === 0) {
    console.error("❌ Lỗi: Biến môi trường GEMINI_API_KEYS chưa được thiết lập hoặc trống.");
    console.error("Vui lòng thêm vào file .env: GEMINI_API_KEYS=key1,key2,key3");
}

// 2. Tạo một trình quản lý key đơn giản
const keyManager = {
    keys: apiKeys,
    currentIndex: 0,
    
    /** Lấy key tiếp theo trong danh sách (xoay vòng) */
    getNextKey: function() {
        if (this.keys.length === 0) return null;
        
        // Lấy key tại vị trí hiện tại
        const key = this.keys[this.currentIndex];
        
        // Di chuyển con trỏ đến vị trí tiếp theo cho lần gọi sau
        // Nếu đến cuối danh sách, nó sẽ quay về đầu (index 0)
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        
        return key;
    },
};

/**
 * 3. Hàm mới: Tự động gọi API và thử lại với key khác nếu bị lỗi quota
 * @param {string} prompt - Câu lệnh prompt để gửi đến Gemini
 * @returns {Promise<any>} - Kết quả từ Gemini
 */
async function generateWithRetry(prompt) {
    if (keyManager.keys.length === 0) {
        throw new Error("Không có API key nào được cấu hình.");
    }

    // Thử tối đa bằng số lượng key bạn có
    for (let i = 0; i < keyManager.keys.length; i++) {
        const currentKey = keyManager.getNextKey();
        
        try {
            // Tạo một instance GenAI MỚI với key hiện tại
            const genAI = new GoogleGenerativeAI(currentKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: { responseMimeType: "application/json" },
            });

            const keyIndexForLog = (keyManager.currentIndex - 1 + keyManager.keys.length) % keyManager.keys.length;
            console.log(`Đang thử gọi API với key index ${keyIndexForLog}...`);
            
            // Gọi API
            const result = await model.generateContent(prompt);
            
            // Nếu thành công, trả về kết quả ngay lập tức
            return result; 

        } catch (error) {
            const keyIndexForLog = (keyManager.currentIndex - 1 + keyManager.keys.length) % keyManager.keys.length;
            console.warn(`Lỗi với API key index ${keyIndexForLog}: ${error.message.substring(0, 100)}...`);
            
            // Chỉ thử lại nếu lỗi là do QUOTA (429)
            const isQuotaError = error.message.includes('429') || 
                                 error.message.includes('Too Many Requests') || 
                                 error.message.includes('resource exhausted');

            if (isQuotaError) {
                // Nếu đây là lần thử cuối cùng mà vẫn lỗi
                if (i === keyManager.keys.length - 1) {
                    console.error("Đã thử hết tất cả API key. Tất cả đều bị giới hạn quota.");
                    throw new Error(`Đã thử hết ${keyManager.keys.length} API key, tất cả đều bị giới hạn quota.`);
                }
                // Nếu không phải lần cuối, tiếp tục vòng lặp để thử key tiếp theo
                console.log("Lỗi quota, đang xoay vòng sang key tiếp theo...");
            } else {
                // Nếu là lỗi khác (prompt sai, server Gemini lỗi), ném lỗi ra ngay để dừng lại
                throw error;
            }
        }
    }
}

// === KẾT THÚC SỬA ĐỔI ===

// --- Các phần khác giữ nguyên logic của bạn ---

const jobStorage = new Map();
const sseClients = new Map();

// Cấu hình Multer
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
});

// GET: Route hiển thị trang upload
router.get('/page', authMiddleware.checkLoggedIn, documentController.getUploadPage);

// POST: Route bắt đầu tóm tắt
router.post('/start-summarize',
    authMiddleware.checkLoggedIn,
    upload.single('documentFile'),
    async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'Vui lòng chọn file PDF, DOCX hoặc TXT.' });
        }
        const jobId = uuidv4();
        console.log(`Bắt đầu công việc ${jobId}`);
        jobStorage.set(jobId, {
            status: 'pending', progress: 0, total: 0, results: [], error: null,
            fileBuffer: req.file.buffer, mimeType: req.file.mimetype, extractedText: null
        });
        res.status(202).json({ jobId });
        setImmediate(() => {
            processDocumentInBackground(jobId);
        });
    }
);

// GET: Route stream tiến trình
router.get('/summarize-stream', authMiddleware.checkLoggedIn, (req, res) => {
    const { jobId } = req.query;
    if (!jobId || !jobStorage.has(jobId)) {
        return res.status(404).send('Không tìm thấy công việc (Job)');
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    sseClients.set(jobId, res);
    const job = jobStorage.get(jobId);
    if (job.status === 'processing') {
        sendSSE(res, 'progress', { type: 'start', totalChunks: job.total });
        sendSSE(res, 'progress', { type: 'chunk_complete', currentChunk: job.progress, totalChunks: job.total });
    } else if (job.status === 'complete') {
        const finalMindmap = aggregateResults(job.results);
        sendSSE(res, 'complete', finalMindmap);
        res.end();
        sseClients.delete(jobId);
        jobStorage.delete(jobId);
        return;
    } else if (job.status === 'error') {
        sendSSE(res, 'error_event', { message: job.error || 'Lỗi xử lý không xác định.' });
        res.end();
        sseClients.delete(jobId);
        jobStorage.delete(jobId);
        return;
    }
    req.on('close', () => {
        console.log(`Client đã ngắt kết nối cho job ${jobId}`);
        sseClients.delete(jobId);
        res.end();
    });
});

// Hàm hỗ trợ gửi sự kiện SSE
function sendSSE(res, eventName, data) {
    if (res && !res.writableEnded) {
        const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
        res.write(message);
    } else {
        console.warn("Đã cố gắng ghi vào kết nối SSE đã đóng.");
    }
}

// Hàm xử lý chính trong nền
async function processDocumentInBackground(jobId) {
    const job = jobStorage.get(jobId);
    if (!job || job.status !== 'pending') return;
    job.status = 'processing';
    console.log(`Đang xử lý công việc ${jobId}`);
    
    try {
        let sseRes = sseClients.get(jobId); 
        if (sseRes) sendSSE(sseRes, 'progress', { message: 'Đang đọc file...' });
        
        try {
            if (job.mimeType === 'application/pdf') {
                const data = await pdf(job.fileBuffer);
                job.extractedText = data.text;
            } else if (job.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                const result = await mammoth.extractRawText({ buffer: job.fileBuffer });
                job.extractedText = result.value;
            } else if (job.mimeType === 'text/plain') {
                job.extractedText = job.fileBuffer.toString('utf8');
            }
        } catch (readError) {
             throw new Error(`Lỗi khi đọc file: ${readError.message}`);
        }
        
        job.fileBuffer = null;
        if (!job.extractedText || job.extractedText.trim().length === 0) {
            throw new Error('Không thể đọc nội dung từ file này.');
        }
        
        const textChunks = splitTextIntoChunks(job.extractedText, 20000);
        job.total = textChunks.length;
        console.log(`Job ${jobId}: Chia thành ${job.total} phần.`);

        sseRes = sseClients.get(jobId); 
        if (sseRes) sendSSE(sseRes, 'progress', { type: 'start', totalChunks: job.total });
        
        const promptTemplate = `
Phân tích văn bản sau đây và trích xuất cấu trúc chi tiết để tạo sơ đồ tư duy (mindmap).
Xác định chủ đề chính, các chủ đề phụ và các điểm chính trong mỗi chủ đề phụ.

⚠️ YÊU CẦU QUAN TRỌNG:
- Giữ nguyên hệ thống đánh số, ký hiệu đề mục (Chương, I, 1, a, ...) trong văn bản gốc và đưa vào các trường 'chapterTitle', 'title', 'subtitle' tương ứng.
- Nếu trong văn bản gốc có thứ tự đánh số, phải giữ lại y nguyên trong phần 'chapterTitle', 'title', 'subtitle'.
- Chỉ tóm tắt ngắn gọn phần nội dung (points), KHÔNG được lược bỏ hoặc thay đổi cấu trúc đề mục gốc.
- Đối với MỖI 'subtitle' (hoặc 'title' nếu không có 'subtitle'), BẮT BUỘC phải trích xuất và tóm tắt 1-3 ý chính, định nghĩa, hoặc luận điểm quan trọng nhất từ nội dung văn bản nằm dưới đề mục đó vào mảng "points".
- Mảng "points" PHẢI chứa nội dung tóm tắt thực tế, KHÔNG được để trống hoặc chỉ ghi mô tả chung chung (ví dụ: KHÔNG ghi "Trình bày về khái niệm" mà phải ghi "Khái niệm X là...") nếu có nội dung trong văn bản gốc.
- Cấu trúc đầu ra PHẢI là một đối tượng JSON hợp lệ duy nhất. Phản hồi CHỈ được chứa đối tượng JSON, tuyệt đối KHÔNG có bất kỳ ký tự nào trước dấu '{' mở đầu hoặc sau dấu '}' kết thúc.

Cấu trúc JSON mẫu (phải theo đúng định dạng này):
{
  "mainTopic": "Tên Tài Liệu Hoặc Chủ Đề Chính (của toàn bộ tài liệu)",
  "subTopics": [
    {
      "chapterTitle": "Chương I: Giới thiệu tổng quan",
      "mainSections": [
        {
          "title": "1. Khái niệm cơ bản",
          "subsections": [
            { "subtitle": "1.1. Định nghĩa A", "points": ["Định nghĩa A là một khái niệm quan trọng...", "Nó bao gồm các yếu tố..."] }
          ]
        },
        {
          "title": "2. Mục không có subsection",
          "points": ["Vai trò chính của mục 2 là...", "Cần lưu ý điểm..."],
          "subsections": []
        }
      ]
    }
  ],
  "summary": "Tóm tắt chung về nội dung chính trong PHẦN VĂN BẢN này."
}

Văn bản cần phân tích:
---
\${documentContent}
---
`;
        
        for (let i = 0; i < textChunks.length; i++) {
            const chunk = textChunks[i];
            if (chunk.trim().length < 50) {
                 job.progress = i + 1;
                 sseRes = sseClients.get(jobId);
                 if (sseRes) sendSSE(sseRes, 'progress', { type: 'chunk_complete', currentChunk: job.progress, totalChunks: job.total });
                 continue;
            }
            
            console.log(`Job ${jobId}: Đang xử lý phần ${i + 1}/${job.total}...`);
            const prompt = promptTemplate.replace('${documentContent}', chunk);
            
            try {
                // SỬA ĐỔI Ở ĐÂY: Gọi hàm mới thay vì gọi trực tiếp
                const result = await generateWithRetry(prompt);
                
                const rawText = result.response.text();
                const analysisResult = JSON.parse(rawText);
                job.results.push(analysisResult);
                job.progress = i + 1;

                sseRes = sseClients.get(jobId); 
                if (sseRes) sendSSE(sseRes, 'progress', { type: 'chunk_complete', currentChunk: job.progress, totalChunks: job.total });
            
            } catch (chunkError) {
                console.warn(`Job ${jobId}: Lỗi xử lý phần ${i + 1}: ${chunkError.message}`);
                 job.progress = i + 1;
                 
                 sseRes = sseClients.get(jobId); 
                 if (sseRes) {
                      sendSSE(sseRes, 'error_event', {
                          message: `Lỗi khi xử lý phần ${i + 1}. Chi tiết: ${chunkError.message.substring(0, 100)}...`
                      });
                      sendSSE(sseRes, 'progress', { type: 'chunk_complete', currentChunk: job.progress, totalChunks: job.total });
                 }
            }
        }
        
        if (job.results.length === 0) {
            throw new Error('Không thể phân tích bất kỳ phần nào của tài liệu.');
        }
        
        const finalMindmap = aggregateResults(job.results);
        job.status = 'complete';
        console.log(`Job ${jobId}: Xử lý hoàn tất.`);
        
        sseRes = sseClients.get(jobId); 
        if (sseRes) {
            sendSSE(sseRes, 'complete', finalMindmap);
            sseRes.end();
        }
        sseClients.delete(jobId);
    
    } catch (error) {
        console.error(`Job ${jobId}: Lỗi nghiêm trọng: ${error.message}`);
        job.status = 'error';
        job.error = error.message || 'Lỗi không xác định';
        
        const sseRes = sseClients.get(jobId); 
        if (sseRes) {
            sendSSE(sseRes, 'error_event', { message: job.error });
            sseRes.end();
        }
        sseClients.delete(jobId);
    
    } finally {
         if (job.status !== 'complete' && job.status !== 'error') {
               console.log(`Job ${jobId} xử lý xong nhưng client đã ngắt kết nối.`);
               sseClients.delete(jobId);
         } else if (job.status === 'complete' || job.status === 'error') {
              setTimeout(() => {
                  if (jobStorage.has(jobId)) {
                      console.log(`Dọn dẹp job ${jobId} khỏi bộ nhớ.`);
                      jobStorage.delete(jobId);
                  }
              }, 5 * 60 * 1000);
         }
    }
}

// Hàm chia nhỏ văn bản
function splitTextIntoChunks(text, maxSize = 20000) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        let chunk = text.substring(i, i + maxSize);
        const lastNewline = chunk.lastIndexOf('\n');
        if (lastNewline > maxSize / 2 && text.length > i + maxSize) {
            chunk = chunk.substring(0, lastNewline);
            i += lastNewline + 1;
        } else {
            i += maxSize;
        }
        chunks.push(chunk);
    }
    return chunks;
}

// Hàm tổng hợp kết quả
function aggregateResults(results) {
    if (!results || results.length === 0) return { mainTopic: "Lỗi", subTopics: [], summary: "Không có kết quả." };
    const finalMindmap = {
        mainTopic: results.find(r => r.mainTopic)?.mainTopic || "Tổng hợp tài liệu",
        subTopics: [],
        summary: results.map(r => r.summary).filter(s => s && s.trim()).join('\n\n---\n\n') || "Không có tóm tắt."
    };
    for (const result of results) {
        if (result.subTopics && Array.isArray(result.subTopics)) {
            finalMindmap.subTopics.push(...result.subTopics);
        }
    }
    return finalMindmap;
}

module.exports = router;
