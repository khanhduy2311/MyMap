// routes/document.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
const FormData = require('form-data');
const AdmZip = require('adm-zip');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const authMiddleware = require('../middlewares/middlewares.js');
const documentController = require('../controllers/documentController.js');

const OCRSPACE_API_KEY = process.env.OCRSPACE_API_KEY;
const GEMINI_KEYS = (process.env.GEMINI_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '8000', 10);

if (!OCRSPACE_API_KEY) console.warn("⚠️ OCRSPACE_API_KEY not set in .env — OCR.Space calls will fail.");
if (GEMINI_KEYS.length === 0) console.warn("⚠️ GEMINI_API_KEYS not set.");

const keyManager = {
  keys: GEMINI_KEYS,
  index: 0,
  next() {
    if (!this.keys || this.keys.length === 0) return null;
    const k = this.keys[this.index];
    this.index = (this.index + 1) % this.keys.length;
    return k;
  }
};

// ========== AI FUNCTION ==========
async function generateWithRetry(prompt, maxRetries = 2) {
  if (!keyManager.keys || keyManager.keys.length === 0) {
    throw new Error("No Gemini API keys configured.");
  }

  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const key = keyManager.next();
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-pro",
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192, // Tăng giới hạn output nếu cần cấu trúc JSON phức tạp
           responseMimeType: "application/json", // Yêu cầu Gemini trả về JSON trực tiếp
        }
      });

      console.log(`Attempt ${attempt + 1} with key ending in ${key.slice(-4)}...`);
      // console.log(`Prompt (start): ${prompt.substring(0, 300)}...`);
      // console.log(`Prompt (end): ...${prompt.substring(prompt.length - 300)}`);

      const result = await model.generateContent(prompt);
      console.log(`Attempt ${attempt + 1} successful.`);
      return result;

    } catch (error) {
      lastError = error;
       const errorDetails = error?.response?.data?.error || error?.response || error;
       const errorMessage = errorDetails?.message || error?.message || String(error);
       console.warn(`Attempt ${attempt + 1} with key ending in ${key.slice(-4)} failed:`, errorMessage);
       if (errorDetails) console.warn('Error Details:', JSON.stringify(errorDetails, null, 2));


      const statusCode = error?.response?.status || (errorMessage.includes('429') ? 429 : null);

      if (statusCode !== 429 && !errorMessage.toLowerCase().includes('quota') && !errorMessage.toLowerCase().includes('rate limit')) {
         console.error("Non-quota/rate limit error encountered, throwing immediately:", errorMessage);
        throw error;
      }

      if (attempt < maxRetries - 1) {
         console.log(`Quota/Rate limit likely hit. Waiting 2 seconds before retrying with next key...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error(`All ${maxRetries} Gemini API retries failed. Last error:`, lastError?.message || lastError);
  throw new Error(`Gemini API call failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown API error'}`);
}

// ========== TEXT EXTRACTION ==========
async function extractTextSmart(buffer, mimeType, sseRes) {
  console.log("🔍 Extracting text from:", mimeType);
  sendSSE(sseRes, 'progress', { message: `🔍 Bắt đầu trích xuất từ ${mimeType}...` });

  if (mimeType === 'application/pdf') {
    try {
      const data = await pdf(buffer, { max: -1 }); // Attempt to parse all pages
      const text = data.text?.trim() || '';
      if (!text) throw new Error("Extracted PDF text is empty or pdf-parse failed.");

      sendSSE(sseRes, 'progress', { message: `✓ Đã trích xuất ${text.length} ký tự từ PDF` });
      console.log(`✓ Successfully extracted ${text.length} characters from PDF.`);
      return text;

    } catch (error) {
      console.warn("PDF extraction failed:", error.message);
      sendSSE(sseRes, 'progress', { message: '🔄 Trích xuất PDF thất bại, thử sử dụng OCR...' });

      try {
        const ocrText = await runOcrSpaceFull(buffer, mimeType);
        if (!ocrText) throw new Error("OCR text for PDF is empty.");
        console.log(`✓ Successfully extracted ${ocrText.length} characters from PDF via OCR.`);
        sendSSE(sseRes, 'progress', { message: `✓ Đã trích xuất ${ocrText.length} ký tự từ PDF bằng OCR` });
        return ocrText;
      } catch (ocrError) {
        console.error("OCR for PDF also failed:", ocrError.message);
        sendSSE(sseRes, 'error', { message: `Lỗi OCR PDF: ${ocrError.message}` });
        throw new Error(`Không thể trích xuất văn bản từ PDF bằng cả hai phương pháp: ${ocrError.message}`);
      }
    }
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      const text = value?.trim() || '';
      if (!text) throw new Error("Extracted DOCX text is empty.");
      sendSSE(sseRes, 'progress', { message: `✓ Đã trích xuất ${text.length} ký tự từ DOCX` });
      console.log(`✓ Successfully extracted ${text.length} characters from DOCX.`);
      return text;
    } catch (error) {
      console.error("DOCX extraction failed:", error.message);
      sendSSE(sseRes, 'error', { message: `Lỗi trích xuất DOCX: ${error.message}` });
      throw new Error(`Không thể trích xuất văn bản từ DOCX: ${error.message}`);
    }
  }

  if (mimeType === 'text/plain') {
    try {
      const text = buffer.toString('utf8').trim();
      if (!text) throw new Error("Extracted TXT text is empty.");
      sendSSE(sseRes, 'progress', { message: `✓ Đã trích xuất ${text.length} ký tự từ TXT` });
      console.log(`✓ Successfully extracted ${text.length} characters from TXT.`);
      return text;
    } catch (error) {
      console.error("TXT extraction failed:", error.message);
      sendSSE(sseRes, 'error', { message: `Lỗi đọc file TXT: ${error.message}` });
      throw new Error(`Không thể đọc file TXT: ${error.message}`);
    }
  }

  if (mimeType.startsWith('image/')) {
    console.log(`Attempting OCR for image type: ${mimeType}`);
    sendSSE(sseRes, 'progress', { message: '🔄 Đang xử lý hình ảnh với OCR...' });
    try {
      const ocrText = await runOcrSpaceFull(buffer, mimeType);
      if (!ocrText) throw new Error("OCR text for image is empty.");
      console.log(`✓ Successfully extracted ${ocrText.length} characters from image via OCR.`);
      sendSSE(sseRes, 'progress', { message: `✓ Đã trích xuất ${ocrText.length} ký tự ảnh bằng OCR` });
      return ocrText;
    } catch (error) {
      console.error("Image OCR failed:", error.message);
      sendSSE(sseRes, 'error', { message: `Lỗi OCR ảnh: ${error.message}` });
      throw new Error(`Không thể trích xuất văn bản từ ảnh bằng OCR: ${error.message}`);
    }
  }

  console.error(`Unsupported or unknown file type: ${mimeType || 'unknown'}`);
  sendSSE(sseRes, 'error', { message: `Định dạng file không được hỗ trợ hoặc không xác định: ${mimeType || 'unknown'}` });
  throw new Error(`Định dạng file không được hỗ trợ hoặc không xác định: ${mimeType || 'unknown'}`);
}


// ========== CHUNK PROCESSING ==========
function splitChunksSimple(text, size = CHUNK_SIZE) {
  if (!text || text.length === 0) return [];

  const chunks = [];
  let currentPos = 0;
  while (currentPos < text.length) {
    let endPos = Math.min(currentPos + size, text.length);
    if (endPos < text.length) {
        let breakPos = text.lastIndexOf('\n', endPos);
        if (breakPos <= currentPos) breakPos = text.lastIndexOf('.', endPos);
        if (breakPos > currentPos + size / 2) {
            endPos = breakPos + 1;
        }
    }
    chunks.push(text.slice(currentPos, endPos));
    currentPos = endPos;
  }

  console.log(`Split text (${text.length} chars) into ${chunks.length} chunks of size ~${size}.`);
  return chunks;
}


async function analyzeChunkSimple(chunk, chunkIndex, totalChunks) {
   console.log(`Analyzing chunk ${chunkIndex + 1}/${totalChunks}...`);

   // =========================================================
   // === GIỮ NGUYÊN PROMPT GỐC CỦA BẠN ===
   // =========================================================
   const prompt = `Phân tích văn bản sau đây và trích xuất cấu trúc chi tiết để tạo sơ đồ tư duy (mindmap).
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
${chunk}
---`;
   // =========================================================

  try {
    const result = await generateWithRetry(prompt);
     const candidate = result?.response?.candidates?.[0];
     if (candidate?.content?.parts?.[0]?.text) {
         try {
             const parsedJson = JSON.parse(candidate.content.parts[0].text);
              if (parsedJson.mainTopic && typeof parsedJson.mainTopic === 'string' &&
                  Array.isArray(parsedJson.subTopics) &&
                  parsedJson.summary && typeof parsedJson.summary === 'string' &&
                  parsedJson.subTopics.every(sub =>
                      typeof sub.chapterTitle === 'string' &&
                      Array.isArray(sub.mainSections) &&
                      sub.mainSections.every(main =>
                          typeof main.title === 'string' &&
                          Array.isArray(main.subsections) &&
                          (main.subsections.length > 0 ?
                              main.subsections.every(subsec =>
                                  typeof subsec.subtitle === 'string' &&
                                  Array.isArray(subsec.points) &&
                                  subsec.points.length > 0 &&
                                  subsec.points.every(p => typeof p === 'string' && p.trim() !== '')
                              ) :
                              (Array.isArray(main.points) && main.points.length > 0 && main.points.every(p => typeof p === 'string' && p.trim() !== '')))
                      )
                  )
              ) {
                   console.log(`✓ Successfully analyzed and validated chunk ${chunkIndex + 1} JSON structure. Topic: ${parsedJson.mainTopic}`);
                   parsedJson.subTopics.forEach(sub => {
                       sub.mainSections.forEach(main => {
                           if (main.points) main.points = main.points.map(p => String(p).trim()).filter(Boolean);
                           main.subsections.forEach(subsec => {
                               subsec.points = subsec.points.map(p => String(p).trim()).filter(Boolean);
                           });
                       });
                   });
                  return parsedJson;
              } else {
                   console.warn(`⚠️ JSON structure validation failed for chunk ${chunkIndex + 1}. Parsed: ${JSON.stringify(parsedJson, null, 2)}`);
              }
         } catch (e) {
             console.warn(`JSON parse error (expected JSON response) for chunk ${chunkIndex + 1}: ${e.message}. Raw Response: "${candidate.content.parts[0].text.substring(0, 300)}..."`);
         }
     } else {
         console.warn(`No valid JSON text found in Gemini response for chunk ${chunkIndex + 1}. Response: ${JSON.stringify(result?.response)}`);
     }

    console.log(`Falling back for chunk ${chunkIndex + 1}.`);
    return {
       mainTopic: `Phần ${chunkIndex + 1} (Fallback)`,
       subTopics: [],
       summary: `Không thể phân tích chi tiết cấu trúc JSON cho phần này. Nội dung gốc: ${chunk.substring(0, 200)}...`,
       fallback: true
    };

  } catch (error) {
    console.error(`❌ Analysis API call failed for chunk ${chunkIndex + 1}:`, error.message);
    return {
      mainTopic: `Lỗi phân tích phần ${chunkIndex + 1}`,
       subTopics: [],
       summary: `Không thể phân tích nội dung do lỗi gọi API: ${error.message.substring(0, 100)}...`,
      error: true
    };
  }
}


// ========== MINDMAP STRUCTURE AGGREGATION & GENERATION ==========
function aggregateJsonResults(results, chunks) {
    console.log(`Aggregating results from ${results.length} JSON analyses (expected ${chunks.length}).`);
    const validResults = results.filter(r => !r.error && !r.fallback);

    if (validResults.length === 0) {
        console.warn("⚠️ No valid JSON analysis results to aggregate.");
        return {
            mainTopic: "Lỗi Phân Tích Tài Liệu",
            subTopics: [{
                chapterTitle: "Thông Báo Lỗi",
                mainSections: [{
                    title: "Không thể phân tích",
                    points: [
                        `Không có phần nào của tài liệu được phân tích thành công theo cấu trúc yêu cầu.`,
                        `Tổng số phần: ${chunks.length}`,
                        `Số phần lỗi/fallback: ${results.length}`
                    ],
                    subsections: []
                }]
            }],
            summary: "Quá trình phân tích tài liệu đã gặp lỗi nghiêm trọng.",
            error: true
        };
    }

    const finalMainTopic = validResults[0].mainTopic || "Tổng hợp tài liệu";
    const combinedSummary = validResults.map(r => r.summary || '').filter(Boolean).join('\n\n');
    const allSubTopics = validResults.flatMap(r => r.subTopics || []);
    const groupedSubTopics = [];
    const chapterMap = new Map();

    allSubTopics.forEach(subTopic => {
        const chapterKey = subTopic.chapterTitle || "Chương không xác định";
        if (!chapterMap.has(chapterKey)) {
            chapterMap.set(chapterKey, { chapterTitle: chapterKey, mainSections: [] });
            groupedSubTopics.push(chapterMap.get(chapterKey));
        }
        const currentChapter = chapterMap.get(chapterKey);
        (subTopic.mainSections || []).forEach(mainSection => {
            if (!currentChapter.mainSections.some(existing => existing.title === mainSection.title)) {
                currentChapter.mainSections.push(mainSection);
            } else {
                 console.warn(`Duplicate mainSection title found and skipped: "${mainSection.title}" in chapter "${chapterKey}"`);
            }
        });
    });

     console.log(`Aggregated into ${groupedSubTopics.length} chapters/subtopics.`);

    return {
        mainTopic: finalMainTopic,
        subTopics: groupedSubTopics,
        summary: combinedSummary || "Không có tóm tắt tổng hợp.",
        totalChunks: chunks.length,
        analyzedChunks: validResults.length
    };
}

function generateMarkdownFromJson(aggregatedJson) {
    console.log("Generating final Markdown from aggregated JSON structure...");
    if (aggregatedJson.error) {
        console.warn("⚠️ Aggregated JSON indicates error. Generating error Markdown.");
        let errorMd = `# ${aggregatedJson.mainTopic}\n\n`;
        (aggregatedJson.subTopics || []).forEach(sub => {
            errorMd += `## ${sub.chapterTitle}\n`;
            (sub.mainSections || []).forEach(main => {
                errorMd += `### ${main.title}\n`;
                (main.points || []).forEach(point => { errorMd += `- ${point}\n`; });
            });
            errorMd += '\n';
        });
        errorMd += `**Tóm tắt:** ${aggregatedJson.summary}\n`;
        return errorMd;
    }

    let markdown = `# ${aggregatedJson.mainTopic}\n\n`;

    (aggregatedJson.subTopics || []).forEach(subTopic => {
        if (subTopic.chapterTitle) { markdown += `## ${subTopic.chapterTitle}\n`; }
        (subTopic.mainSections || []).forEach(mainSection => {
            markdown += `### ${mainSection.title}\n`;
            if (mainSection.subsections && mainSection.subsections.length > 0) {
                mainSection.subsections.forEach(subsection => {
                    markdown += `#### ${subsection.subtitle}\n`;
                    (subsection.points || []).forEach(point => { markdown += `- ${point}\n`; });
                });
            } else if (mainSection.points && mainSection.points.length > 0) {
                mainSection.points.forEach(point => { markdown += `- ${point}\n`; });
            } else {
                 markdown += `- *(Không có điểm chi tiết)*\n`;
            }
            markdown += '\n';
        });
        markdown += '\n';
    });

    if (aggregatedJson.totalChunks > 1) {
        markdown += `\n---\n*Tổng hợp từ ${aggregatedJson.analyzedChunks}/${aggregatedJson.totalChunks} phần nội dung.*`;
    }

    console.log("✓ Successfully generated Markdown from JSON.");
    return markdown.trim();
}


// ========== OCR FUNCTIONS ==========
// (Giữ nguyên)
async function ocrSpaceParseBuffer(buffer, mimeType) { if (!OCRSPACE_API_KEY) throw new Error("OCRSPACE_API_KEY not configured."); const form = new FormData(); form.append('apikey', OCRSPACE_API_KEY); form.append('language', 'vie'); form.append('isOverlayRequired', 'false'); form.append('OCREngine', '2'); form.append('scale', 'true'); form.append('detectOrientation', 'true'); form.append('file', buffer, { filename: `upload.${mimeType ? mimeType.split('/')[1] || 'bin' : 'bin'}` }); console.log('Sending request to OCR.Space...'); try { const resp = await axios.post('https://api.ocr.space/parse/image', form, { headers: form.getHeaders(), timeout: 90000 }); console.log('Received response from OCR.Space.'); if (resp.data?.IsErroredOnProcessing) { console.error('OCR.Space Processing Error:', resp.data.ErrorMessage.join ? resp.data.ErrorMessage.join('; ') : resp.data.ErrorMessage); } if (resp.data?.OCRExitCode !== 1) { console.warn(`OCR.Space Exit Code: ${resp.data?.OCRExitCode}. Details might be in ErrorMessage.`); } return resp.data; } catch (error) { console.error("OCR.Space API request error:", error.message); if (error.response) { console.error("OCR.Space Response Status:", error.response.status); console.error("OCR.Space Response Data:", error.response.data); } throw new Error(`Lỗi gọi API OCR.Space: ${error.message}`); } }
async function runOcrSpaceFull(buffer, mimeType) { console.log("Running full OCR process..."); const data = await ocrSpaceParseBuffer(buffer, mimeType); if (data?.IsErroredOnProcessing || data?.OCRExitCode !== 1) { const errorMessages = data?.ErrorMessage?.join ? data.ErrorMessage.join('; ') : (data?.ErrorMessage || "Lỗi xử lý OCR không xác định"); console.error(`OCR processing failed with exit code ${data?.OCRExitCode}. Errors: ${errorMessages}`); throw new Error(errorMessages); } if (!data.ParsedResults || data.ParsedResults.length === 0) { console.warn("OCR processed successfully but returned no parsed results."); return ''; } const combinedText = data.ParsedResults.map(p => p.ParsedText || '').join('\n').trim(); console.log(`OCR successful, extracted ${combinedText.length} characters.`); return combinedText; }

// ========== MULTER & STORAGE ==========
// (Giữ nguyên)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png', 'image/gif']; if (allowedTypes.includes(file.mimetype)) { cb(null, true); } else { console.warn(`File rejected: Unsupported type ${file.mimetype}`); cb(new Error(`Chỉ chấp nhận file PDF, DOCX, TXT, JPG, PNG, GIF.`)); } } });
const jobs = new Map();
const sseClients = new Map();

// ========== SSE FUNCTIONS ==========
// (Giữ nguyên)
function sendSSE(res, event, data) { if (!res || res.writableEnded) { if (res && res.writableEnded) { console.warn(`Attempted to write to an already closed SSE stream for event: ${event}`); } return; } try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) { console.error(`❌ Failed to send SSE event '${event}':`, e.message); try { res.end(); } catch (closeErr) {} sseClients.delete(findJobIdByResponse(res)); } }
function findJobIdByResponse(res) { for (let [jobId, clientRes] of sseClients.entries()) { if (clientRes === res) { return jobId; } } return null; }

// ========== ROUTES ==========
// (Giữ nguyên)
router.get('/page', authMiddleware.checkLoggedIn, documentController.getUploadPage);
router.post('/start-summarize', authMiddleware.checkLoggedIn, upload.single('documentFile'), (req, res, next) => { if (!req.file) { console.log("Upload failed: No file received."); return res.status(400).json({ error: 'Không có file nào được tải lên.' }); } console.log(`Received file: ${req.file.originalname}, Type: ${req.file.mimetype}, Size: ${req.file.size}`); const jobId = uuidv4(); jobs.set(jobId, { id: jobId, status: 'pending', buffer: req.file.buffer, mimeType: req.file.mimetype, filename: req.file.originalname, results: [], startTime: Date.now() }); console.log(`Job created: ${jobId} for file ${req.file.originalname}`); res.status(202).json({ jobId }); }, (err, req, res, next) => { console.error("Multer Upload Error:", err.message); if (err instanceof multer.MulterError) { if (err.code === 'LIMIT_FILE_SIZE') { return res.status(400).json({ error: `File quá lớn, tối đa 50MB.` }); } return res.status(400).json({ error: `Lỗi tải file: ${err.message}` }); } else if (err) { if (err.message.includes('Chỉ chấp nhận file')) { return res.status(400).json({ error: err.message }); } return res.status(500).json({ error: `Lỗi server không xác định khi tải file: ${err.message}` }); } next(); });
router.get('/summarize-stream', authMiddleware.checkLoggedIn, (req, res) => { const { jobId } = req.query; const job = jobs.get(jobId); if (!jobId || !job) { console.log(`SSE connection failed: Job ${jobId} not found.`); return res.status(404).send('Job not found or expired.'); } console.log(`SSE client connected for job: ${jobId}`); res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*', }); sseClients.set(jobId, res); req.on('close', () => { console.log(`SSE client disconnected for job: ${jobId}`); sseClients.delete(jobId); const currentJob = jobs.get(jobId); if (currentJob && (currentJob.status === 'processing' || currentJob.status === 'pending')) { console.log(`Job ${jobId} still processing after client disconnect.`); } if (!res.writableEnded) { res.end(); } }); if (job.status === 'pending') { console.log(`Starting processing for pending job: ${jobId}`); processDocument(jobId).catch(error => { console.error(`❌ CRITICAL: Uncaught error starting processDocument for ${jobId}:`, error); sendSSE(sseClients.get(jobId), 'error', { message: `Lỗi nghiêm trọng khi bắt đầu xử lý: ${error.message}` }); if (sseClients.has(jobId)) { try { sseClients.get(jobId).end(); } catch (e) {} sseClients.delete(jobId); } if (jobs.has(jobId)) { jobs.get(jobId).status = 'error'; jobs.get(jobId).error = `Lỗi nghiêm trọng: ${error.message}`; jobs.get(jobId).buffer = null; } }); } else { console.log(`Job ${jobId} status is already '${job.status}'. Sending final status.`); if (job.status === 'done') { sendSSE(res, 'complete', { markdown: job.result, visualizationUrl: `/upload/mindmap-visualization/${jobId}`, stats: job.stats || {} }); res.end(); } else if (job.status === 'error') { sendSSE(res, 'error', { message: `Lỗi xử lý trước đó: ${job.error || 'Lỗi không xác định'}` }); res.end(); } } });


// ========== MINDMAP VISUALIZATION HTML GENERATOR ==========
function generateMindmapHTML(markdownContent, title = "Mindmap Visualization") {
  // Đảm bảo markdownContent không rỗng và có định dạng cơ bản
  if (!markdownContent || markdownContent.trim() === '') {
    markdownContent = "# Lỗi\nNội dung Markdown trống hoặc không hợp lệ.";
  }

  // Chuẩn hóa Markdown - đảm bảo có ít nhất một tiêu đề cấp 1
  if (!markdownContent.includes('# ')) {
    markdownContent = `# ${title}\n\n${markdownContent}`;
  }

  const escapedMarkdown = markdownContent
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/d3@6.7.0"></script>
    <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.2.7"></script>
    <script src="https://cdn.jsdelivr.net/npm/markmap-lib@0.11.6"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7f6; min-height: 100vh; padding: 15px; }
        .container { max-width: 95%; margin: 15px auto; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: hidden; display: flex; flex-direction: column; }
        .header { background: #4a69bd; color: white; padding: 20px 30px; text-align: center; border-bottom: 5px solid #3c5aa0; }
        .header h1 { font-size: 2em; margin-bottom: 5px; font-weight: 600; }
        .header p { font-size: 1em; opacity: 0.9; }
        .content { display: flex; flex: 1; min-height: 650px; }
        .markdown-panel { flex: 1; padding: 20px; background: #ffffff; border-right: 1px solid #e0e0e0; overflow-y: auto; max-height: 700px; display: flex; flex-direction: column; }
        .visualization-panel { flex: 2; padding: 20px; background: #fafafa; display: flex; flex-direction: column; }
        .panel-header { font-size: 1.1em; font-weight: 600; margin-bottom: 15px; color: #333; border-bottom: 2px solid #4a69bd; padding-bottom: 5px; }
        #mindmap { width: 100%; height: 100%; flex: 1; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; min-height: 500px; }
        .markdown-content { flex: 1; background: #f8f9fa; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 0.9em; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; overflow-y: auto; }
        .controls { padding: 15px 20px; background: #e9ecef; border-top: 1px solid #d6dbe0; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .btn { padding: 10px 20px; border: none; border-radius: 6px; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
        .btn-primary { background-color: #007bff; color: white; }
        .btn-primary:hover { background-color: #0056b3; }
        .btn-secondary { background-color: #6c757d; color: white; }
        .btn-secondary:hover { background-color: #5a6268; }
        .loading-error { display: flex; justify-content: center; align-items: center; height: 100%; font-size: 16px; color: #6c757d; padding: 20px; text-align: center; }
         .loading-error strong { color: #dc3545; }
        svg text { font-size: 14px; }
        @media (max-width: 992px) { .content { flex-direction: column; min-height: auto; } .markdown-panel { border-right: none; border-bottom: 1px solid #e0e0e0; max-height: 400px; } #mindmap { min-height: 450px; } .container { max-width: 100%; margin: 10px; } .header { padding: 15px 20px; } .header h1 { font-size: 1.8em; } }
        @media (max-width: 768px) { .controls { flex-direction: column; align-items: stretch; } .btn { width: 100%; justify-content: center; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗺️ Sơ đồ tư duy</h1>
            <p>Trực quan hóa cấu trúc tài liệu của bạn</p>
        </div>
        <div class="content">
            <div class="markdown-panel">
                <h3 class="panel-header">Nội dung Markdown:</h3>
                <div class="markdown-content"><pre><code>${escapedMarkdown}</code></pre></div>
            </div>
            <div class="visualization-panel">
                <h3 class="panel-header">Sơ đồ tương tác:</h3>
                <svg id="mindmap">
                    <foreignObject width="100%" height="100%">
                        <body xmlns="http://www.w3.org/1999/xhtml">
                            <div class="loading-error" id="loading-placeholder">Đang tải sơ đồ...</div>
                        </body>
                    </foreignObject>
                </svg>
            </div>
        </div>
        <div class="controls">
            <button class="btn btn-primary" onclick="downloadMindmap()">📥 Tải về (PNG)</button>
            <button class="btn btn-secondary" onclick="window.print()">🖨️ In Sơ đồ</button>
            <a href="/upload/page" class="btn btn-secondary">↩️ Quay lại Tải lên</a>
        </div>
    </div>
    <script>
        const markdownContent = \`${escapedMarkdown}\`;

        // Debug: log markdown content để kiểm tra
        console.log('Markdown content length:', markdownContent.length);
        console.log('First 500 chars:', markdownContent.substring(0, 500));
        console.log('Last 500 chars:', markdownContent.substring(markdownContent.length - 500));

        function initializeMarkmap() {
            const svgElement = document.getElementById('mindmap');
            const loadingPlaceholder = svgElement ? svgElement.querySelector('#loading-placeholder') : null;
            
            // Kiểm tra thư viện đã load chưa
            if (typeof window.markmap === 'undefined' || typeof window.markmap.Markmap === 'undefined' || typeof window.markmap.Transformer === 'undefined' || typeof window.d3 === 'undefined') {
                console.warn('Markmap/D3 libraries not fully loaded yet, retrying...');
                if (loadingPlaceholder) loadingPlaceholder.textContent = 'Đang chờ thư viện D3/Markmap...';
                setTimeout(initializeMarkmap, 150);
                return;
            }
            
            if (!svgElement) {
                console.error('SVG element #mindmap not found!');
                if (loadingPlaceholder) loadingPlaceholder.innerHTML = '<strong>Lỗi: Không tìm thấy khu vực vẽ sơ đồ.</strong>';
                return;
            }

            svgElement.innerHTML = ''; // Clear loading message
            console.log('Markmap libraries loaded, attempting to render.');
            
            const { Transformer, Markmap, panZoom } = window.markmap;
            
            try {
                const transformer = new Transformer();
                console.log('Transforming markdown...');
                
                const { root, features } = transformer.transform(markdownContent);
                console.log('Transformation result:', { root, features });
                
                if (!root) {
                    console.error('Invalid root:', root);
                    throw new Error('Nội dung Markdown không hợp lệ hoặc không thể phân tích thành cấu trúc sơ đồ.');
                }
                
                const options = { 
                    autoFit: true,
                    duration: 500,
                    nodeMinHeight: 16,
                    spacingVertical: 5,
                    spacingHorizontal: 80,
                    paddingX: 8
                };
                
                const mm = Markmap.create(svgElement, options, root);
                console.log('Markmap instance created successfully.');
                
                // Fit to view
                setTimeout(() => {
                    if (mm.fit) mm.fit();
                }, 100);
                
                if (panZoom && svgElement.querySelector('g')) {
                    try {
                        const pz = panZoom(svgElement.querySelector('g'));
                        console.log('Pan and zoom enabled.');
                    } catch (panZoomError) {
                        console.warn('PanZoom failed:', panZoomError);
                    }
                } else {
                    console.warn('PanZoom function not available or no SVG group found.');
                }
                
            } catch (error) {
                console.error('❌ Error rendering mindmap:', error);
                console.error('Error stack:', error.stack);
                
                // Hiển thị lỗi chi tiết hơn
                let errorMessage = error.message || 'Lỗi không xác định.';
                if (error.message.includes('Markdown')) {
                    errorMessage += ' Cấu trúc Markdown có vấn đề.';
                }
                
                svgElement.innerHTML = \`
                    <foreignObject width="100%" height="100%">
                         <body xmlns="http://www.w3.org/1999/xhtml">
                             <div class="loading-error">
                                 <strong>Lỗi khi vẽ sơ đồ:</strong><br/>
                                 \${errorMessage}<br/>
                                 <small style="margin-top: 10px; display: block;">
                                     <strong>Debug info:</strong><br/>
                                     Content length: \${markdownContent.length}<br/>
                                     Check console for details.
                                 </small>
                             </div>
                         </body>
                     </foreignObject>
                \`;
            }
        }

        function downloadMindmap() {
            try { 
                const svg = document.getElementById('mindmap'); 
                if (!svg) throw new Error('SVG element not found.'); 
                const g = svg.querySelector('g'); 
                if (!g) throw new Error('Mindmap group element not found.'); 
                const svgData = new XMLSerializer().serializeToString(svg); 
                const bbox = g.getBBox ? g.getBBox() : { x: 0, y: 0, width: svg.clientWidth || 800, height: svg.clientHeight || 600 }; 
                const padding = 20; 
                const canvas = document.createElement('canvas'); 
                canvas.width = Math.max(bbox.width + padding * 2, svg.clientWidth || 800); 
                canvas.height = Math.max(bbox.height + padding * 2, svg.clientHeight || 600); 
                const ctx = canvas.getContext('2d'); 
                if (!ctx) throw new Error('Could not get canvas context.'); 
                ctx.fillStyle = '#FFFFFF'; 
                ctx.fillRect(0, 0, canvas.width, canvas.height); 
                const img = new Image(); 
                img.onload = function() { 
                    const scale = Math.min( 
                        (canvas.width - padding * 2) / bbox.width, 
                        (canvas.height - padding * 2) / bbox.height 
                    ); 
                    const drawWidth = bbox.width * scale; 
                    const drawHeight = bbox.height * scale; 
                    const drawX = (canvas.width - drawWidth) / 2 - bbox.x * scale; 
                    const drawY = (canvas.height - drawHeight) / 2 - bbox.y * scale; 
                    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight); 
                    try { 
                        const pngFile = canvas.toDataURL('image/png'); 
                        const downloadLink = document.createElement('a'); 
                        downloadLink.download = 'mindmap.png'; 
                        downloadLink.href = pngFile; 
                        document.body.appendChild(downloadLink); 
                        downloadLink.click(); 
                        document.body.removeChild(downloadLink); 
                    } catch (e) { 
                        console.error("Error generating or downloading PNG:", e); 
                        alert("Lỗi khi tạo file PNG để tải về."); 
                    } 
                }; 
                img.onerror = function(e) { 
                    console.error("Error loading SVG into Image:", e); 
                    alert("Lỗi khi tải dữ liệu sơ đồ để chuyển đổi sang ảnh."); 
                } 
                const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData))); 
                img.src = svgBase64; 
            } catch (error) { 
                console.error('Error in downloadMindmap:', error); 
                alert('Không thể tải sơ đồ dưới dạng ảnh: ' + error.message); 
            }
        }

        // Khởi tạo khi trang load
        if (document.readyState === 'loading') { 
            document.addEventListener('DOMContentLoaded', initializeMarkmap); 
        } else { 
            initializeMarkmap(); 
        }
        
        // Xử lý resize
        let resizeTimer; 
        window.addEventListener('resize', () => { 
            clearTimeout(resizeTimer); 
            resizeTimer = setTimeout(() => { 
                console.log('Window resized, re-rendering mindmap.'); 
                initializeMarkmap(); 
            }, 250); 
        });
    </script>
</body>
</html>`;
}

// ========== MAIN PROCESSING FUNCTION ==========
// (Giữ nguyên - đã cập nhật logic aggregate/generate)
async function processDocument(jobId) {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'pending') {
     console.warn(`Attempted to process job ${jobId} but its status is ${job?.status || 'not found'}.`);
    return;
  }

  console.log(`Processing document for job: ${jobId}`);
  job.status = 'processing';
  const sse = sseClients.get(jobId);

  try {
    sendSSE(sse, 'progress', { message: '🔄 Bắt đầu xử lý tài liệu...' });

    // Step 1: Extract text
    sendSSE(sse, 'progress', { message: '📄 Đang trích xuất văn bản...' });
    console.time(`extractText-${jobId}`);
    const extractedText = await extractTextSmart(job.buffer, job.mimeType, sse);
    console.timeEnd(`extractText-${jobId}`);

    if (!extractedText || typeof extractedText !== 'string' || extractedText.trim().length < 50) {
        const errorMsg = 'Không thể trích xuất đủ nội dung từ tài liệu. File có thể trống, bị lỗi hoặc định dạng không được hỗ trợ đầy đủ.';
        console.error(`Error for job ${jobId}: ${errorMsg}. Text length: ${extractedText?.length}`);
      throw new Error(errorMsg);
    }

    sendSSE(sse, 'progress', { message: `✅ Đã trích xuất ${extractedText.length} ký tự`, textLength: extractedText.length });
    console.log(`Job ${jobId}: Extracted ${extractedText.length} chars.`);
    job.buffer = null;
    console.log(`Job ${jobId}: Cleared file buffer from memory.`);

    // Step 2: Split into chunks
    const chunks = splitChunksSimple(extractedText, CHUNK_SIZE);
     if (chunks.length === 0) {
          throw new Error('Nội dung trích xuất không thể chia thành các phần để phân tích.');
      }
    sendSSE(sse, 'progress', { message: `📦 Đã chia thành ${chunks.length} phần để phân tích`, totalChunks: chunks.length });
    console.log(`Job ${jobId}: Split into ${chunks.length} chunks.`);

    // Step 3: Process each chunk
    const analyses = [];
    console.time(`analyzeChunks-${jobId}`);
    for (let i = 0; i < chunks.length; i++) {
        const progressData = {
            message: `🤖 Đang phân tích phần ${i + 1}/${chunks.length}...`,
            chunkCurrent: i + 1,
            totalChunks: chunks.length
        };
      sendSSE(sse, 'progress', progressData);
      console.log(`Job ${jobId}: ${progressData.message}`);

      const analysis = await analyzeChunkSimple(chunks[i], i, chunks.length);
      analyses.push(analysis);

       const chunkDoneData = {
            message: analysis.error ? `⚠️ Lỗi phân tích phần ${i + 1}` : `✅ Đã phân tích phần ${i + 1}/${chunks.length}`,
            chunkCurrent: i + 1,
            totalChunks: chunks.length,
        };
       sendSSE(sse, 'progress', chunkDoneData);
       if(analysis.error) console.warn(`Job ${jobId}: ${chunkDoneData.message}`);

      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay
      }
    }
     console.timeEnd(`analyzeChunks-${jobId}`);

    // Step 4: Aggregate results
    sendSSE(sse, 'progress', { message: '📊 Đang tổng hợp kết quả JSON...' });
     console.log(`Job ${jobId}: Aggregating ${analyses.length} JSON analysis results.`);
     console.time(`aggregateJson-${jobId}`);
    const aggregatedJsonResult = aggregateJsonResults(analyses, chunks);
     console.timeEnd(`aggregateJson-${jobId}`);

     if (aggregatedJsonResult.error) {
         throw new Error(aggregatedJsonResult.summary || "Lỗi tổng hợp kết quả phân tích JSON.");
     }

    sendSSE(sse, 'progress', { message: `📊 Tổng hợp JSON xong. Chủ đề chính: ${aggregatedJsonResult.mainTopic}` });
    console.log(`Job ${jobId}: JSON Aggregation complete. Main topic: ${aggregatedJsonResult.mainTopic}`);

    // Step 5: Generate final mindmap markdown
    sendSSE(sse, 'progress', { message: '🗺️ Đang tạo sơ đồ tư duy từ JSON...' });
     console.log(`Job ${jobId}: Generating final mindmap markdown from JSON...`);
     console.time(`generateMarkdown-${jobId}`);
    const mindmapMarkdown = generateMarkdownFromJson(aggregatedJsonResult);
     console.timeEnd(`generateMarkdown-${jobId}`);

    // Step 6: Finalize job state
    job.status = 'done';
    job.result = mindmapMarkdown;
    job.processingTime = Date.now() - job.startTime;
     job.stats = {
        totalChunks: chunks.length,
        processedChunks: aggregatedJsonResult.analyzedChunks,
        processingTime: job.processingTime,
        textLength: extractedText.length,
        mainTopic: aggregatedJsonResult.mainTopic
      };

    sendSSE(sse, 'complete', {
      markdown: mindmapMarkdown,
      visualizationUrl: `/upload/mindmap-visualization/${jobId}`,
      stats: job.stats
    });

    console.log(`✅ Job ${jobId} completed successfully in ${job.processingTime}ms.`);

  } catch (error) {
    console.error(`❌ Processing failed for job ${jobId}:`, error);
    job.status = 'error';
    job.error = error.message || 'Lỗi không xác định';
    sendSSE(sse, 'error', { message: `Lỗi xử lý tài liệu: ${job.error}` });
  } finally {
    console.log(`Job ${jobId}: Finalizing processing.`);
    try { if (sse && !sse.writableEnded) { console.log(`Job ${jobId}: Closing SSE stream.`); sse.end(); } }
    catch (e) { console.warn(`Job ${jobId}: Error closing SSE stream:`, e.message); }
    sseClients.delete(jobId);
    if (job && job.buffer) { job.buffer = null; console.log(`Job ${jobId}: Cleared buffer in finally block.`); }
    setTimeout(() => { if (jobs.has(jobId)) { console.log(`Job ${jobId}: Deleting job data from memory.`); jobs.delete(jobId); } }, 10 * 60 * 1000);
  }
}

// Default route for /upload
router.get('/', (req, res) => { res.redirect('/upload/page'); });
router.get('/mindmap-visualization/:jobId', authMiddleware.checkLoggedIn, (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId); // Lấy job từ bộ nhớ tạm

  // Kiểm tra xem job có tồn tại không
  if (!job) {
    console.warn(`[Visualization] Job not found in memory: ${jobId}`);
    return res.status(404).send(`
        <h1 style="font-family: sans-serif; color: #d9534f;">404 - Không tìm thấy Job</h1>
        <p style="font-family: sans-serif;">Job ID này không tồn tại. 
        Sơ đồ trực quan chỉ được lưu tạm thời, có thể nó đã hết hạn hoặc chưa từng tồn tại.</p>
        <a href="/upload/page">Quay lại trang tải lên</a>
    `);
  }

  // Kiểm tra xem job đã xử lý xong và có kết quả markdown chưa
  if (job.status !== 'done' || !job.result) {
    console.warn(`[Visualization] Job not complete: ${jobId}, status: ${job.status}`);
    return res.status(400).send(`
        <h1 style="font-family: sans-serif; color: #f0ad4e;">400 - Job chưa hoàn thành</h1>
        <p style="font-family: sans-serif;">Job này đang được xử lý hoặc đã gặp lỗi trong quá trình phân tích. 
        Vui lòng thử lại từ trang tải lên.</p>
        <a href="/upload/page">Quay lại trang tải lên</a>
    `);
  }

  // Nếu mọi thứ OK, lấy markdown và tiêu đề
  const markdownContent = job.result;
  const pageTitle = job.stats?.mainTopic || job.filename || "Sơ đồ tư duy";

  try {
    // Sử dụng hàm generateMindmapHTML bạn đã có sẵn!
    const html = generateMindmapHTML(markdownContent, pageTitle);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error(`[Visualization] Error generating HTML for job ${jobId}:`, error);
    res.status(500).send(`
        <h1 style="font-family: sans-serif; color: #d9534f;">500 - Lỗi Server</h1>
        <p style="font-family: sans-serif;">Đã xảy ra lỗi khi tạo trang HTML cho sơ đồ tư duy.</p>
        <pre>${error.message}</pre>
    `);
  }
});
module.exports = router;