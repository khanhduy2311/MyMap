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
const { HfInference } = require('@huggingface/inference');
const authMiddleware = require('../middlewares/middlewares.js');
const documentController = require('../controllers/documentController.js');

const OCRSPACE_API_KEY = process.env.OCRSPACE_API_KEY;
const GEMINI_KEYS = (process.env.GEMINI_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '8000', 10);
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OCRSPACE_API_KEY) console.warn("⚠️ OCRSPACE_API_KEY not set in .env — OCR.Space calls will fail.");
if (GEMINI_KEYS.length === 0) console.warn("⚠️ GEMINI_API_KEYS not set.");
if (!HUGGINGFACE_TOKEN) console.warn("⚠️ HUGGINGFACE_TOKEN not set in .env — Hugging Face calls will fail.");
if (!OPENROUTER_API_KEY) console.warn("⚠️ OPENROUTER_API_KEY not set in .env — OpenRouter calls will fail.");
// Khởi tạo Hugging Face client
const hf = HUGGINGFACE_TOKEN ? new HfInference(HUGGINGFACE_TOKEN) : null;

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
// ========== OPENROUTER FREE MODELS - OPTIMIZED ==========
async function generateWithOpenRouter(prompt) {
    if (!OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY not configured");
    }

    // DANH SÁCH MODEL FREE TỐT NHẤT
    const models = [
        "google/gemini-2.0-flash-lite-preview-02-05:free", // Gemini free
        "anthropic/claude-3-haiku:free", // Claude free - rất ổn định
        "meta-llama/llama-3-8b-instruct:free", // Llama free
        "microsoft/wizardlm-2-8x22b:free", // WizardLM free
        "qwen/qwen-2.5-72b-instruct:free" // Qwen mạnh
    ];

    for (const model of models) {
        try {
            console.log(`🌐 Trying OpenRouter: ${model}`);
            
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: model,
                messages: [
                    {
                        role: "system", 
                        content: `TRẢ VỀ DUY NHẤT JSON. KHÔNG text, KHÔNG markdown, KHÔNG giải thích.
YÊU CẦU: Luôn trả về JSON hợp lệ, bắt đầu bằng { và kết thúc bằng }`
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 4000,
                temperature: 0.1,
                response_format: { type: "json_object" } // QUAN TRỌNG: ép trả về JSON
            }, {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000', // Required for OpenRouter
                    'X-Title': 'Mindmap Generator' // Required for OpenRouter
                },
                timeout: 45000
            });

            const content = response.data.choices[0].message.content;
            console.log(`✓ OpenRouter success with ${model}`);
            
            return { 
                response: {
                    candidates: [{
                        content: {
                            parts: [{ text: content }]
                        }
                    }]
                }
            };

        } catch (error) {
            console.warn(`❌ OpenRouter ${model} failed:`, error.response?.data?.error?.message || error.message);
            continue;
        }
    }
    
    throw new Error("All OpenRouter models failed");
}
// ========== HUGGING FACE FUNCTION - VJP HƠN VỚI INSTRUCTION MODELS ==========
// SỬA ĐỔI: Sử dụng các model instruction-tuned thay vì model conversational.
// ========== IMPROVED HUGGING FACE FUNCTION ==========
// ========== IMPROVED HUGGING FACE FUNCTION ==========
async function generateWithHuggingFace(prompt, maxRetries = 2) {
    if (!HUGGINGFACE_TOKEN) {
        throw new Error("HUGGINGFACE_TOKEN not configured.");
    }

    // MODEL TỐT NHẤT CHO JSON GENERATION
    const models = [
        "mistralai/Mistral-7B-Instruct-v0.2", // Tốt nhất
        "HuggingFaceH4/zephyr-7b-beta", // Instruction tuned tốt
        "google/gemma-2b-it", // Nhẹ, nhanh
        "microsoft/DialoGPT-large" // Fallback cuối
    ];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const model = models[attempt] || models[0];
        
        try {
            console.log(`🤗 Hugging Face Attempt ${attempt + 1} with: ${model}`);
            
            // PROMPT ENGINEERING QUAN TRỌNG
            const enhancedPrompt = `BẠN PHẢI TRẢ VỀ DUY NHẤT JSON. KHÔNG CÓ BẤT KỲ TEXT NÀO KHÁC.

${prompt}

NHẮC LẠI: CHỈ TRẢ VỀ JSON, KHÔNG GIẢI THÍCH, KHÔNG MARKDOWN.`;
            
            const response = await axios.post(
                `https://api-inference.huggingface.co/models/${model}`,
                {
                    inputs: enhancedPrompt,
                    parameters: {
                        max_new_tokens: 2048,
                        temperature: 0.1,
                        do_sample: false,
                        return_full_text: false
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${HUGGINGFACE_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 60000
                }
            );

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            console.log(`✓ Hugging Face success with ${model}`);
            return { generated_text: response.data[0]?.generated_text || "" };

        } catch (error) {
            console.warn(`❌ Hugging Face ${model} failed:`, error.message);
            
            if (attempt < maxRetries - 1) {
                console.log(`🔄 Trying next Hugging Face model...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                throw new Error(`All Hugging Face models failed: ${error.message}`);
            }
        }
    }
}
// ========== ULTIMATE MULTI-PROVIDER AI FUNCTION (NO TOGETHER) ==========
async function generateWithRetry(prompt, maxRetries = 3) {
    let lastError = null;

    // 1. Ưu tiên Gemini trước (nếu có key)
    if (keyManager.keys && keyManager.keys.length > 0) {
        const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"];
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const key = keyManager.next();
            const selectedModel = models[attempt % models.length];

            try {
                const genAI = new GoogleGenerativeAI(key);
                const model = genAI.getGenerativeModel({
                    model: selectedModel,
                    generationConfig: {
                        temperature: 0.1,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 8192,
                        responseMimeType: "application/json",
                    }
                });

                console.log(`🤖 Gemini Attempt ${attempt + 1} with ${selectedModel}`);
                const result = await model.generateContent(prompt);
                console.log(`✓ Gemini ${selectedModel} success`);
                return result;

            } catch (error) {
                lastError = error;
                console.warn(`❌ Gemini ${selectedModel} failed:`, error.message);
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }
        }
    }

    // 2. Thử OpenRouter (free) - RẤT QUAN TRỌNG
    try {
        console.log("🔄 Falling back to OpenRouter free models...");
        return await generateWithOpenRouter(prompt);
    } catch (error) {
        lastError = error;
        console.warn("OpenRouter fallback failed:", error.message);
    }

    // 3. Cuối cùng dùng Hugging Face (luôn available)
    try {
        console.log("🔄 Falling back to Hugging Face...");
        const hfResult = await generateWithHuggingFace(prompt);
        return { 
            response: {
                candidates: [{
                    content: {
                        parts: [{ text: hfResult.generated_text }]
                    }
                }]
            }
        };
    } catch (error) {
        lastError = error;
        console.warn("Hugging Face fallback failed:", error.message);
    }

    throw new Error(`All AI services failed: ${lastError?.message || 'Unknown error'}`);
}
// ========== TEXT EXTRACTION ==========
async function extractTextSmart(buffer, mimeType, sseRes) {
  console.log("🔍 Extracting text from:", mimeType);
  sendSSE(sseRes, 'progress', { message: `🔍 Bắt đầu trích xuất từ ${mimeType}...` });

  if (mimeType === 'application/pdf') {
    try {
      const data = await pdf(buffer, { max: -1 });
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

// ========== JSON EXTRACTION FUNCTION (MỚI) ==========
/**
 * Trích xuất một chuỗi JSON từ văn bản trả về của AI, 
 * ngay cả khi có văn bản rác (markdown, giải thích) bao quanh.
 * @param {string} text - Văn bản thô từ AI.
 * @returns {object|null} - Đối tượng JSON đã parse hoặc null nếu thất bại.
 */
// ========== IMPROVED JSON EXTRACTION ==========
function extractJson(text) {
  if (!text || typeof text !== 'string') return null;

  // Tìm JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('[extractJson] No JSON object found in text');
    return null;
  }

  const jsonString = jsonMatch[0];
  
  try {
    const parsed = JSON.parse(jsonString);
    
    // Basic validation
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
    return null;
  } catch (e) {
    console.warn('[extractJson] JSON parse error:', e.message);
    return null;
  }
}

// ========== JSON VALIDATION FUNCTION ==========
// VALIDATION ĐÃ SỬA - ĐƠN GIẢN VÀ RÕ RÀNG:
function validateJsonStructure(parsedJson) {
  if (!parsedJson || typeof parsedJson !== 'object') {
    return false;
  }

  // Kiểm tra các trường bắt buộc
  if (typeof parsedJson.mainTopic !== 'string' || !parsedJson.mainTopic.trim()) {
    return false;
  }

  if (!Array.isArray(parsedJson.subTopics)) {
    return false;
  }

  // Kiểm tra từng subTopic
  for (const subTopic of parsedJson.subTopics) {
    if (!subTopic || typeof subTopic.chapterTitle !== 'string') {
      return false;
    }

    if (!Array.isArray(subTopic.mainSections)) {
      return false;
    }

    // Kiểm tra từng mainSection
    for (const mainSection of subTopic.mainSections) {
      if (!mainSection || typeof mainSection.title !== 'string') {
        return false;
      }

      if (!Array.isArray(mainSection.subsections)) {
        return false;
      }

      // Kiểm tra từng subsection
      for (const subsection of mainSection.subsections) {
        if (!subsection || typeof subsection.subtitle !== 'string') {
          return false;
        }

        if (!Array.isArray(subsection.points) || subsection.points.length === 0) {
          return false;
        }

        // Kiểm tra từng point
        for (const point of subsection.points) {
          if (typeof point !== 'string' || !point.trim()) {
            return false;
          }
        }
      }
    }
  }

  if (typeof parsedJson.summary !== 'string') {
    return false;
  }

  return true;
}
// FALLBACK ĐÃ CẢI THIỆN:
function createSimpleFallback(chunk, chunkIndex) {
  // Trích xuất các dòng có số/chữ cái làm đề mục
  const lines = chunk.split('\n').filter(line => line.trim());
  const mainTopic = lines[0]?.replace(/^#+\s*/, '') || `Phần ${chunkIndex + 1}`;
  
  const subTopics = [];
  let currentChapter = null;
  
  lines.forEach(line => {
    const trimmed = line.trim();
    
    // Phát hiện chương/mục chính (có số La Mã, số, chữ cái)
    if (trimmed.match(/^(Chương|Phần|CHƯƠNG|PHẦN)\s+[0-9IVXLC]/i) || 
        trimmed.match(/^[IVXLC]+\./) ||
        trimmed.match(/^[0-9]+\./)) {
      
      if (currentChapter) {
        subTopics.push(currentChapter);
      }
      
      currentChapter = {
        chapterTitle: trimmed,
        mainSections: []
      };
    }
    // Phát hiện mục con
    else if (trimmed.match(/^[0-9]+\.[0-9]+/) || trimmed.match(/^[a-z]\)/i)) {
      if (currentChapter) {
        currentChapter.mainSections.push({
          title: trimmed,
          subsections: [{
            subtitle: "Nội dung chi tiết",
            points: [trimmed + " - chi tiết đang được phân tích..."]
          }]
        });
      }
    }
  });
  
  if (currentChapter) {
    subTopics.push(currentChapter);
  }
  
  // Nếu không tìm thấy cấu trúc, tạo fallback đơn giản
  if (subTopics.length === 0) {
    subTopics.push({
      chapterTitle: "Nội dung chính",
      mainSections: [{
        title: "Thông tin tổng hợp",
        subsections: [{
          subtitle: "Chi tiết",
          points: [chunk.substring(0, 300) + "..."]
        }]
      }]
    });
  }
  
  return {
    mainTopic: mainTopic,
    subTopics: subTopics,
    summary: `Tóm tắt phần ${chunkIndex + 1}: ${chunk.substring(0, 150)}...`
  };
}
// SỬA ĐỔI: Dùng hàm `extractJson`
// ========== IMPROVED CHUNK ANALYSIS WITH BETTER PROMPT ==========
async function analyzeChunkSimple(chunk, chunkIndex, totalChunks) {
  console.log(`Analyzing chunk ${chunkIndex + 1}/${totalChunks}...`);

  // PROMPT ĐƠN GIẢN VÀ RÕ RÀNG HƠN
  const prompt = `PHÂN TÍCH VĂN BẢN VÀ TRẢ VỀ JSON THEO ĐÚNG CẤU TRÚC SAU:

{
  "mainTopic": "chủ đề chính",
  "subTopics": [
    {
      "chapterTitle": "tên chương",
      "mainSections": [
        {
          "title": "tiêu đề mục",
          "subsections": [
            {
              "subtitle": "tiêu đề mục con", 
              "points": ["nội dung 1", "nội dung 2"]
            }
          ]
        }
      ]
    }
  ],
  "summary": "tóm tắt ngắn"
}

VĂN BẢN:
${chunk}

QUY TẮC:
- GIỮ NGUYÊN số và ký hiệu đề mục (Chương 1, 1.1, a, ...)
- Mỗi subsection phải có ít nhất 1 point
- CHỈ TRẢ VỀ JSON, KHÔNG TEXT NÀO KHÁC`;

  // Retry logic
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      console.log(`Attempt ${attempt + 1} for chunk ${chunkIndex + 1}`);
      
      const result = await generateWithRetry(prompt);
      const rawText = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (!rawText) {
        throw new Error('Empty response from AI');
      }

      console.log(`Raw AI response for chunk ${chunkIndex + 1}:`, rawText.substring(0, 200) + '...');

      // Sử dụng hàm extractJson
      const parsedJson = extractJson(rawText);
      
      if (parsedJson && validateJsonStructure(parsedJson)) {
        console.log(`✓ Chunk ${chunkIndex + 1} - Attempt ${attempt + 1} SUCCESS`);
        
        // Clean up và validate data
        return cleanAndValidateJson(parsedJson);
      } else {
        console.warn(`⚠️ Chunk ${chunkIndex + 1} - Attempt ${attempt + 1} JSON validation failed`);
        console.log('Parsed JSON:', parsedJson);
        
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    } catch (error) {
      console.error(`❌ Chunk ${chunkIndex + 1} - Attempt ${attempt + 1} error:`, error.message);
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
    }
  }

  // Fallback thông minh
  console.log(`🔄 Using intelligent fallback for chunk ${chunkIndex + 1}`);
  return createSimpleFallback(chunk, chunkIndex);
}

// Hàm làm sạch và validate JSON
function cleanAndValidateJson(parsedJson) {
  // Đảm bảo mainTopic có giá trị
  if (!parsedJson.mainTopic || parsedJson.mainTopic.trim() === '') {
    parsedJson.mainTopic = "Chủ đề chính";
  }

  // Đảm bảo subTopics là array
  if (!Array.isArray(parsedJson.subTopics)) {
    parsedJson.subTopics = [];
  }

  // Làm sạch từng subTopic
  parsedJson.subTopics = parsedJson.subTopics.map(subTopic => {
    if (!subTopic || typeof subTopic !== 'object') {
      return {
        chapterTitle: "Chương không xác định",
        mainSections: []
      };
    }

    // Đảm bảo chapterTitle có giá trị
    if (!subTopic.chapterTitle || subTopic.chapterTitle.trim() === '') {
      subTopic.chapterTitle = "Chương không có tiêu đề";
    }

    // Đảm bảo mainSections là array
    if (!Array.isArray(subTopic.mainSections)) {
      subTopic.mainSections = [];
    }

    // Làm sạch từng mainSection
    subTopic.mainSections = subTopic.mainSections.map(mainSection => {
      if (!mainSection || typeof mainSection !== 'object') {
        return {
          title: "Mục không xác định",
          subsections: []
        };
      }

      // Đảm bảo title có giá trị
      if (!mainSection.title || mainSection.title.trim() === '') {
        mainSection.title = "Mục không có tiêu đề";
      }

      // Đảm bảo subsections là array
      if (!Array.isArray(mainSection.subsections)) {
        mainSection.subsections = [];
      }

      // Làm sạch từng subsection
      mainSection.subsections = mainSection.subsections.map(subsection => {
        if (!subsection || typeof subsection !== 'object') {
          return {
            subtitle: "Mục con không xác định",
            points: ["Nội dung không xác định"]
          };
        }

        // Đảm bảo subtitle có giá trị
        if (!subsection.subtitle || subsection.subtitle.trim() === '') {
          subsection.subtitle = "Mục con không có tiêu đề";
        }

        // Đảm bảo points là array và có ít nhất 1 point
        if (!Array.isArray(subsection.points) || subsection.points.length === 0) {
          subsection.points = ["Nội dung đang được cập nhật"];
        }

        // Làm sạch từng point
        subsection.points = subsection.points
          .map(point => String(point).trim())
          .filter(point => point !== '');

        // Nếu sau khi filter không còn point nào, thêm point mặc định
        if (subsection.points.length === 0) {
          subsection.points = ["Thông tin chi tiết"];
        }

        return subsection;
      });

      return mainSection;
    });

    return subTopic;
  });

  // Đảm bảo summary có giá trị
  if (!parsedJson.summary || parsedJson.summary.trim() === '') {
    parsedJson.summary = "Tóm tắt nội dung";
  }

  return parsedJson;
}

// Hàm fallback thông minh
function createSimpleFallback(chunk, chunkIndex) {
  const lines = chunk.split('\n').filter(line => line.trim());
  
  // Tìm main topic từ dòng đầu tiên có # hoặc dòng đầu tiên
  let mainTopic = "Nội dung chính";
  for (const line of lines) {
    if (line.trim().startsWith('# ')) {
      mainTopic = line.replace(/^#+\s*/, '').trim();
      break;
    }
    if (line.trim().length > 10) {
      mainTopic = line.trim().substring(0, 50) + '...';
      break;
    }
  }

  const subTopics = [];
  let currentChapter = null;
  
  // Phân tích cấu trúc văn bản
  lines.forEach(line => {
    const trimmed = line.trim();
    
    // Phát hiện chương (có số, chữ số La Mã, etc.)
    if (trimmed.match(/^(Chương|Phần|Chapter|Part)\s*[0-9IVXLC]/i) || 
        trimmed.match(/^[IVXLC]+\./) ||
        trimmed.match(/^[0-9]+\.\s/)) {
      
      if (currentChapter) {
        subTopics.push(currentChapter);
      }
      
      currentChapter = {
        chapterTitle: trimmed,
        mainSections: []
      };
    }
    // Phát hiện mục chính (1.1, 2.3, etc.)
    else if (trimmed.match(/^[0-9]+\.[0-9]+/)) {
      if (currentChapter) {
        currentChapter.mainSections.push({
          title: trimmed,
          subsections: [{
            subtitle: "Chi tiết",
            points: [trimmed + " - nội dung đang được phân tích"]
          }]
        });
      }
    }
    // Phát hiện mục con (a, b, c hoặc - *)
    else if (trimmed.match(/^[a-z]\)/i) || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      if (currentChapter && currentChapter.mainSections.length > 0) {
        const lastSection = currentChapter.mainSections[currentChapter.mainSections.length - 1];
        lastSection.subsections.push({
          subtitle: "Mục con",
          points: [trimmed.replace(/^[-*]\s*/, '')]
        });
      }
    }
  });
  
  // Thêm chapter cuối cùng
  if (currentChapter) {
    subTopics.push(currentChapter);
  }
  
  // Nếu không tìm thấy cấu trúc, tạo fallback cơ bản
  if (subTopics.length === 0) {
    const points = lines
      .slice(0, 5)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.length > 5)
      .slice(0, 3);
    
    if (points.length === 0) {
      points.push(chunk.substring(0, 100) + '...');
    }
    
    subTopics.push({
      chapterTitle: "Nội dung chính",
      mainSections: [{
        title: "Thông tin tổng hợp",
        subsections: [{
          subtitle: "Chi tiết",
          points: points
        }]
      }]
    });
  }
  
  return {
    mainTopic: mainTopic,
    subTopics: subTopics,
    summary: `Phần ${chunkIndex + 1}: ${chunk.substring(0, 100)}...`
  };
}
// ========== OPTIMIZED CHUNK PROCESSING ==========
async function processSingleChunk(chunk, chunkIndex, totalChunks, sse) {
  const progressData = {
    message: `🔍 Phân tích phần ${chunkIndex + 1}/${totalChunks}...`,
    chunkCurrent: chunkIndex + 1,
    totalChunks: totalChunks
  };
  sendSSE(sse, 'progress', progressData);
  console.log(`Job: ${progressData.message}`);

  try {
    const analysis = await analyzeChunkSimple(chunk, chunkIndex, totalChunks);
    
    const chunkDoneData = {
      message: analysis.error ? `⚠️ Lỗi phân tích phần ${chunkIndex + 1}` : `✅ Đã phân tích phần ${chunkIndex + 1}/${totalChunks}`,
      chunkCurrent: chunkIndex + 1,
      totalChunks: totalChunks,
    };
    sendSSE(sse, 'progress', chunkDoneData);
    
    if (analysis.error) console.warn(`Chunk ${chunkIndex + 1} error: ${chunkDoneData.message}`);
    
    return analysis;
  } catch (error) {
    console.error(`❌ Error processing chunk ${chunkIndex + 1}:`, error);
    return {
      mainTopic: `Lỗi phần ${chunkIndex + 1}`,
      subTopics: [],
      summary: `Lỗi phân tích: ${error.message}`,
      error: true
    };
  }
}

// ========== MINDMAP STRUCTURE AGGREGATION & GENERATION (SỬA ĐỔI) ==========
function aggregateJsonResults(results, chunks) {
    console.log(`Aggregating results from ${results.length} JSON analyses (expected ${chunks.length}).`);
    const validResults = results.filter(r => r && !r.error && !r.fallback);

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

    // SỬA ĐỔI: Đếm tần suất mainTopic thay vì chỉ lấy cái đầu tiên
    const topicMap = new Map();
    let defaultTopic = "Tổng hợp tài liệu";

    validResults.forEach(r => {
        const topic = r.mainTopic ? r.mainTopic.trim() : defaultTopic;
        if (topic) {
            topicMap.set(topic, (topicMap.get(topic) || 0) + 1);
        }
    });

    let finalMainTopic = defaultTopic;
    let maxCount = 0;
    // Nếu có topic "Tổng hợp tài liệu", gán nó làm mặc định
    if (topicMap.has(defaultTopic)) {
        maxCount = topicMap.get(defaultTopic);
    }
    // Tìm topic xuất hiện nhiều nhất
    for (const [topic, count] of topicMap.entries()) {
        if (count > maxCount && topic !== defaultTopic) {
            maxCount = count;
            finalMainTopic = topic;
        }
    }
    console.log(`[Aggregation] Chosen mainTopic: "${finalMainTopic}" (Count: ${maxCount}) from ${topicMap.size} topics.`);


    const combinedSummary = validResults.map(r => r.summary || '').filter(Boolean).join('\n\n');
    const allSubTopics = validResults.flatMap(r => r.subTopics || []);
    const groupedSubTopics = [];
    const chapterMap = new Map();

    allSubTopics.forEach(subTopic => {
        if (!subTopic) return; // Bỏ qua nếu subTopic là null/undefined
        const chapterKey = subTopic.chapterTitle || "Chương không xác định";
        if (!chapterMap.has(chapterKey)) {
            chapterMap.set(chapterKey, { chapterTitle: chapterKey, mainSections: [] });
            groupedSubTopics.push(chapterMap.get(chapterKey));
        }
        const currentChapter = chapterMap.get(chapterKey);
        (subTopic.mainSections || []).forEach(mainSection => {
            if (!mainSection || !mainSection.title) return; // Bỏ qua nếu mainSection không hợp lệ
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
        return `# ${aggregatedJson.mainTopic}\n\n## Lỗi phân tích\n\n${aggregatedJson.summary || 'Không thể phân tích tài liệu'}`;
    }

    let markdown = `# ${aggregatedJson.mainTopic}\n\n`;
    
    if (aggregatedJson.summary && aggregatedJson.summary.trim() !== '') {
        markdown += `> ${aggregatedJson.summary}\n\n`;
    }

    // Duyệt qua các chủ đề phụ
    (aggregatedJson.subTopics || []).forEach(subTopic => {
        if (!subTopic || !subTopic.chapterTitle) return;
        
        markdown += `## ${subTopic.chapterTitle}\n\n`;
        
        // Duyệt qua các section chính
        (subTopic.mainSections || []).forEach(mainSection => {
            if (!mainSection || !mainSection.title) return;
            
            markdown += `### ${mainSection.title}\n\n`;
            
            // Xử lý subsections nếu có
            if (mainSection.subsections && mainSection.subsections.length > 0) {
                mainSection.subsections.forEach(subsection => {
                    if (!subsection || !subsection.subtitle) return;
                    
                    markdown += `#### ${subsection.subtitle}\n\n`;
                    
                    // Thêm các điểm
                    (subsection.points || []).forEach(point => {
                        if (point && point.trim() !== '') {
                            markdown += `- ${point.trim()}\n`;
                        }
                    });
                    markdown += '\n';
                });
            } 
            // Xử lý points trực tiếp nếu không có subsection
            else if (mainSection.points && mainSection.points.length > 0) {
                mainSection.points.forEach(point => {
                    if (point && point.trim() !== '') {
                        markdown += `- ${point.trim()}\n`;
                    }
                });
                markdown += '\n';
            } else {
                markdown += `- *Chưa có nội dung chi tiết*\n\n`;
            }
        });
    });

    // Thêm thông tin tổng hợp nếu có nhiều chunks
    if (aggregatedJson.totalChunks > 1) {
        markdown += `---\n\n*Tổng hợp từ ${aggregatedJson.analyzedChunks}/${aggregatedJson.totalChunks} phần nội dung.*`;
    }

    console.log("✓ Successfully generated clean Markdown from JSON.");
    console.log("Markdown preview:", markdown.substring(0, 200) + "...");
    
    return markdown.trim();
}

// ========== OCR FUNCTIONS ==========
async function ocrSpaceParseBuffer(buffer, mimeType) { 
  if (!OCRSPACE_API_KEY) throw new Error("OCRSPACE_API_KEY not configured."); 
  const form = new FormData(); 
  form.append('apikey', OCRSPACE_API_KEY); 
  form.append('language', 'vie'); 
  form.append('isOverlayRequired', 'false'); 
  form.append('OCREngine', '2'); 
  form.append('scale', 'true'); 
  form.append('detectOrientation', 'true'); 
  form.append('file', buffer, { filename: `upload.${mimeType ? mimeType.split('/')[1] || 'bin' : 'bin'}` }); 
  console.log('Sending request to OCR.Space...'); 
  try { 
    const resp = await axios.post('https://api.ocr.space/parse/image', form, { headers: form.getHeaders(), timeout: 90000 }); 
    console.log('Received response from OCR.Space.'); 
    if (resp.data?.IsErroredOnProcessing) { 
      console.error('OCR.Space Processing Error:', resp.data.ErrorMessage.join ? resp.data.ErrorMessage.join('; ') : resp.data.ErrorMessage); 
    } 
    if (resp.data?.OCRExitCode !== 1) { 
      console.warn(`OCR.Space Exit Code: ${resp.data?.OCRExitCode}. Details might be in ErrorMessage.`); 
    } 
    return resp.data; 
  } catch (error) { 
    console.error("OCR.Space API request error:", error.message); 
    if (error.response) { 
      console.error("OCR.Space Response Status:", error.response.status); 
      console.error("OCR.Space Response Data:", error.response.data); 
    } 
    throw new Error(`Lỗi gọi API OCR.Space: ${error.message}`); 
  } 
}

async function runOcrSpaceFull(buffer, mimeType) { 
  console.log("Running full OCR process..."); 
  const data = await ocrSpaceParseBuffer(buffer, mimeType); 
  if (data?.IsErroredOnProcessing || data?.OCRExitCode !== 1) { 
    const errorMessages = data?.ErrorMessage?.join ? data.ErrorMessage.join('; ') : (data?.ErrorMessage || "Lỗi xử lý OCR không xác định"); 
    console.error(`OCR processing failed with exit code ${data?.OCRExitCode}. Errors: ${errorMessages}`); 
    throw new Error(errorMessages); 
  } 
  if (!data.ParsedResults || data.ParsedResults.length === 0) { 
    console.warn("OCR processed successfully but returned no parsed results."); 
    return ''; 
  } 
  const combinedText = data.ParsedResults.map(p => p.ParsedText || '').join('\n').trim(); 
  console.log(`OCR successful, extracted ${combinedText.length} characters.`); 
  return combinedText; 
}

// ========== MULTER & STORAGE ==========
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => { 
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png', 'image/gif']; 
    if (allowedTypes.includes(file.mimetype)) { 
      cb(null, true); 
    } else { 
      console.warn(`File rejected: Unsupported type ${file.mimetype}`); 
      cb(new Error(`Chỉ chấp nhận file PDF, DOCX, TXT, JPG, PNG, GIF.`)); 
    } 
  } 
});

// ========== JOB STORAGE (IN-MEMORY) ==========
// CẢNH BÁO PRODUCTION: 
// Lưu job trong `Map` (bộ nhớ server) hoạt động tốt khi phát triển (development).
// Tuy nhiên, khi "chạy thật" (production), nếu server bị restart, deploy, hoặc crash,
// tất cả các job đang chạy và đã hoàn thành sẽ bị MẤT.
//
// GIẢI PHÁP: Sử dụng một hệ thống lưu trữ bên ngoài như REDIS.
// - Redis cực kỳ nhanh và lưu trữ dữ liệu bền bỉ.
// - Bạn có thể dùng `redis.set(jobId, jsonData, 'EX', 10 * 60)` để job tự động 
//   hết hạn sau 10 phút, thay thế cho `setTimeout` để xóa job.
// - Điều này cho phép bạn mở rộng (scale) lên nhiều server mà không mất job.
const jobs = new Map();
const sseClients = new Map();

// ========== SSE FUNCTIONS ==========
function sendSSE(res, event, data) { 
  if (!res || res.writableEnded) { 
    if (res && res.writableEnded) { 
      console.warn(`Attempted to write to an already closed SSE stream for event: ${event}`); 
    } 
    return; 
  } 
  try { 
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); 
  } catch (e) { 
    console.error(`❌ Failed to send SSE event '${event}':`, e.message); 
    try { res.end(); } catch (closeErr) {} 
    sseClients.delete(findJobIdByResponse(res)); 
  } 
}

function findJobIdByResponse(res) { 
  for (let [jobId, clientRes] of sseClients.entries()) { 
    if (clientRes === res) { 
      return jobId; 
    } 
  } 
  return null; 
}

// ========== ROUTES ==========
router.get('/page', authMiddleware.checkLoggedIn, documentController.getUploadPage);

router.post('/start-summarize', authMiddleware.checkLoggedIn, upload.single('documentFile'), (req, res, next) => { 
  if (!req.file) { 
    console.log("Upload failed: No file received."); 
    return res.status(400).json({ error: 'Không có file nào được tải lên.' }); 
  } 
  console.log(`Received file: ${req.file.originalname}, Type: ${req.file.mimetype}, Size: ${req.file.size}`); 
  const jobId = uuidv4(); 
  jobs.set(jobId, { 
    id: jobId, 
    status: 'pending', 
    buffer: req.file.buffer, // Buffer được lưu tạm thời
    mimeType: req.file.mimetype, 
    filename: req.file.originalname, 
    results: [], 
    startTime: Date.now() 
  }); 
  console.log(`Job created: ${jobId} for file ${req.file.originalname}`); 
  res.status(202).json({ jobId }); 
}, (err, req, res, next) => { 
  console.error("Multer Upload Error:", err.message); 
  if (err instanceof multer.MulterError) { 
    if (err.code === 'LIMIT_FILE_SIZE') { 
      return res.status(400).json({ error: `File quá lớn, tối đa 50MB.` }); 
    } 
    return res.status(400).json({ error: `Lỗi tải file: ${err.message}` }); 
  } else if (err) { 
    if (err.message.includes('Chỉ chấp nhận file')) { 
      return res.status(400).json({ error: err.message }); 
    } 
    return res.status(500).json({ error: `Lỗi server không xác định khi tải file: ${err.message}` }); 
  } 
  next(); 
});

router.get('/summarize-stream', authMiddleware.checkLoggedIn, (req, res) => { 
  const { jobId } = req.query; 
  const job = jobs.get(jobId); 
  if (!jobId || !job) { 
    console.log(`SSE connection failed: Job ${jobId} not found.`); 
    return res.status(404).send('Job not found or expired.'); 
  } 
  console.log(`SSE client connected for job: ${jobId}`); 
  res.writeHead(200, { 
    'Content-Type': 'text/event-stream', 
    'Cache-Control': 'no-cache', 
    'Connection': 'keep-alive', 
    'Access-Control-Allow-Origin': '*', 
  }); 
  sseClients.set(jobId, res); 
  req.on('close', () => { 
    console.log(`SSE client disconnected for job: ${jobId}`); 
    sseClients.delete(jobId); 
    const currentJob = jobs.get(jobId); 
    if (currentJob && (currentJob.status === 'processing' || currentJob.status === 'pending')) { 
      console.log(`Job ${jobId} still processing after client disconnect.`); 
    } 
    if (!res.writableEnded) { 
      res.end(); 
    } 
  }); 
  if (job.status === 'pending') { 
    console.log(`Starting processing for pending job: ${jobId}`); 
    processDocument(jobId).catch(error => { 
      console.error(`❌ CRITICAL: Uncaught error starting processDocument for ${jobId}:`, error); 
      sendSSE(sseClients.get(jobId), 'error', { message: `Lỗi nghiêm trọng khi bắt đầu xử lý: ${error.message}` }); 
      if (sseClients.has(jobId)) { 
        try { sseClients.get(jobId).end(); } catch (e) {} 
        sseClients.delete(jobId); 
      } 
      if (jobs.has(jobId)) { 
        const jobToError = jobs.get(jobId);
          jobToError.status = 'error'; 
        jobToError.error = `Lỗi nghiêm trọng: ${error.message}`; 
        jobToError.buffer = null; // Dọn dẹp buffer
      } 
    }); 
  } else { 
    console.log(`Job ${jobId} status is already '${job.status}'. Sending final status.`); 
    if (job.status === 'done') { 
      sendSSE(res, 'complete', { 
        markdown: job.result, 
        visualizationUrl: `/upload/mindmap-visualization/${jobId}`, 
        stats: job.stats || {} 
      }); 
      res.end(); 
    } else if (job.status === 'error') { 
      sendSSE(res, 'error', { message: `Lỗi xử lý trước đó: ${job.error || 'Lỗi không xác định'}` }); 
      res.end(); 
    } 
  } 
});

// ========== MAIN PROCESSING FUNCTION - OPTIMIZED ==========
async function processDocument(jobId) {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'pending') {
    console.warn(`Attempted to process job ${jobId} but its status is ${job?.status || 'not found'}.`);
    return;
  }

  console.log(`Processing document for job: ${jobId}`);
  job.status = 'processing';
  const sse = sseClients.get(jobId);
  let extractedText = null; // Khai báo ở scope ngoài

  try {
    sendSSE(sse, 'progress', { message: '🔄 Bắt đầu xử lý tài liệu...' });

    // Step 1: Extract text
    sendSSE(sse, 'progress', { message: '📄 Đang trích xuất văn bản...' });
    console.time(`extractText-${jobId}`);
    extractedText = await extractTextSmart(job.buffer, job.mimeType, sse);
    console.timeEnd(`extractText-${jobId}`);
    
    // Dọn dẹp buffer ngay sau khi trích xuất xong
    job.buffer = null; 
    console.log(`Job ${jobId}: Cleared file buffer from memory.`);

    if (!extractedText || typeof extractedText !== 'string' || extractedText.trim().length < 50) {
      const errorMsg = 'Không thể trích xuất đủ nội dung từ tài liệu. File có thể trống, bị lỗi hoặc định dạng không được hỗ trợ đầy đủ.';
      console.error(`Error for job ${jobId}: ${errorMsg}. Text length: ${extractedText?.length}`);
      throw new Error(errorMsg);
    }

    sendSSE(sse, 'progress', { message: `✅ Đã trích xuất ${extractedText.length} ký tự`, textLength: extractedText.length });
    console.log(`Job ${jobId}: Extracted ${extractedText.length} chars.`);

    // Step 2: Split into chunks
    const chunks = splitChunksSimple(extractedText, CHUNK_SIZE);
    if (chunks.length === 0) {
      throw new Error('Nội dung trích xuất không thể chia thành các phần để phân tích.');
    }
    sendSSE(sse, 'progress', { message: `📦 Đã chia thành ${chunks.length} phần để phân tích`, totalChunks: chunks.length });
    console.log(`Job ${jobId}: Split into ${chunks.length} chunks.`);

    // Step 3: Process chunks với PARALLEL PROCESSING và RATE LIMITING
    sendSSE(sse, 'progress', { message: `🤖 Bắt đầu phân tích ${chunks.length} phần (xử lý song song)...` });
    
    const analyses = [];
    console.time(`analyzeChunks-${jobId}`);
    
    // Xử lý song song với giới hạn concurrent requests
    const CONCURRENT_LIMIT = 3; 
    const BATCH_DELAY = 500; 
    
    for (let i = 0; i < chunks.length; i += CONCURRENT_LIMIT) {
      const batch = chunks.slice(i, i + CONCURRENT_LIMIT);
      const batchPromises = batch.map((chunk, batchIndex) => {
        const chunkIndex = i + batchIndex;
        return processSingleChunk(chunk, chunkIndex, chunks.length, sse);
      });

      // Xử lý batch hiện tại song song
      const batchResults = await Promise.allSettled(batchPromises);
      analyses.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : {
          mainTopic: `Lỗi phần ${i + (batchResults.findIndex(r => r === result)) || 0}`, // Cố gắng lấy index
          subTopics: [],
          summary: `Lỗi phân tích: ${result.reason?.message || 'Unknown error'}`,
          error: true
        }
      ));

      // Progress update sau mỗi batch
      const progressData = {
        message: `📊 Đã xử lý ${Math.min(i + CONCURRENT_LIMIT, chunks.length)}/${chunks.length} phần`,
        chunkCurrent: Math.min(i + CONCURRENT_LIMIT, chunks.length),
        totalChunks: chunks.length
      };
      sendSSE(sse, 'progress', progressData);

      // Delay ngắn giữa các batch
      if (i + CONCURRENT_LIMIT < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
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
    job.result = mindmapMarkdown; // Lưu kết quả Markdown
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
    
    // Đảm bảo buffer đã được dọn dẹp
    if (job && job.buffer) { 
        job.buffer = null; 
        console.log(`Job ${jobId}: Cleared buffer in finally block.`); 
    }
    
    // Đặt lịch xóa job khỏi bộ nhớ (quan trọng để tránh memory leak)
    setTimeout(() => { 
        if (jobs.has(jobId)) { 
            console.log(`Job ${jobId}: Deleting job data from memory.`); 
            jobs.delete(jobId); 
        } 
    }, 10 * 60 * 1000); // 10 phút sau khi xử lý xong
  }
}

// Default route for /upload
router.get('/', (req, res) => { res.redirect('/upload/page'); });

// Mindmap visualization route
router.get('/mindmap-visualization/:jobId', authMiddleware.checkLoggedIn, (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    console.warn(`[Visualization] Job not found in memory: ${jobId}`);
    return res.status(404).send(`
        <h1 style="font-family: sans-serif; color: #d9534f;">404 - Không tìm thấy Job</h1>
        <p style="font-family: sans-serif;">Job ID này không tồn tại. 
        Sơ đồ trực quan chỉ được lưu tạm thời, có thể nó đã hết hạn (sau 10 phút) hoặc chưa từng tồn tại.</p>
        <a href="/upload/page">Quay lại trang tải lên</a>
    `);
  }

  if (job.status !== 'done' || !job.result) {
    console.warn(`[Visualization] Job not complete: ${jobId}, status: ${job.status}`);
    return res.status(400).send(`
        <h1 style="font-family: sans-serif; color: #f0ad4e;">400 - Job chưa hoàn thành</h1>
        <p style="font-family: sans-serif;">Job này đang được xử lý (${job.status}) hoặc đã gặp lỗi trong quá trình phân tích. 
        ${job.error ? `<br/><strong>Lỗi:</strong> ${job.error}` : ''}
        </p>
        <a href="/upload/page">Quay lại trang tải lên</a>
    `);
  }

  const markdownContent = job.result;
  const pageTitle = job.stats?.mainTopic || job.filename || "Sơ đồ tư duy";

  try {
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

// ========== MINDMAP VISUALIZATION HTML GENERATOR ==========
// ========== FIXED MINDMAP VISUALIZATION HTML ==========
// ========== SIMPLIFIED MINDMAP VISUALIZATION HTML ==========
// ========== FIXED MINDMAP VISUALIZATION HTML ==========
function generateMindmapHTML(markdownContent, title = "Mindmap Visualization") {
    if (!markdownContent || markdownContent.trim() === '') {
        markdownContent = "# Lỗi\nNội dung Markdown trống hoặc không hợp lệ.";
    }

    // Chuẩn hóa Markdown
    if (!markdownContent.startsWith('# ')) {
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
    <!-- Sử dụng CDN chính thức từ markmap -->
    <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
    <script src="https://cdn.jsdelivr.net/npm/markmap-lib@0.15.4"></script>
    <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.15.4"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7f6; min-height: 100vh; padding: 15px; }
        .container { max-width: 95%; margin: 15px auto; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: hidden; display: flex; flex-direction: column; }
        .header { background: #4a69bd; color: white; padding: 20px 30px; text-align: center; border-bottom: 5px solid #3c5aa0; }
        .header h1 { font-size: 2em; margin-bottom: 5px; font-weight: 600; }
        .header p { font-size: 1em; opacity: 0.9; }
        .content { display: flex; flex: 1; min-height: 650px; }
        .markdown-panel { flex: 1; padding: 20px; background: #ffffff; border-right: 1px solid #e0e0e0; overflow-y: auto; max-height: 700px; }
        .visualization-panel { flex: 2; padding: 20px; background: #fafafa; display: flex; flex-direction: column; }
        .panel-header { font-size: 1.1em; font-weight: 600; margin-bottom: 15px; color: #333; border-bottom: 2px solid #4a69bd; padding-bottom: 5px; }
        #mindmap { width: 100%; height: 100%; flex: 1; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; min-height: 500px; }
        .markdown-content { background: #f8f9fa; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 0.9em; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; overflow-y: auto; }
        .controls { padding: 15px 20px; background: #e9ecef; border-top: 1px solid #d6dbe0; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .btn { padding: 10px 20px; border: none; border-radius: 6px; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
        .btn-primary { background-color: #007bff; color: white; }
        .btn-primary:hover { background-color: #0056b3; }
        .btn-secondary { background-color: #6c757d; color: white; }
        .btn-secondary:hover { background-color: #5a6268; }
        .loading-error { display: flex; justify-content: center; align-items: center; height: 100%; font-size: 16px; color: #6c757d; padding: 20px; text-align: center; }
        .markmap-foreign { width: 100%; height: 100%; }
        .markmap-svg { width: 100%; height: 100%; }
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
                <div id="mindmap">
                    <div class="loading-error">Đang tải sơ đồ tư duy...</div>
                </div>
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

        function initializeMarkmap() {
            const container = document.getElementById('mindmap');
            
            // Kiểm tra thư viện đã load đầy đủ chưa
            if (typeof window.markmap === 'undefined' || 
                typeof window.markmap.lib === 'undefined' ||
                typeof window.markmap.lib.Transformer === 'undefined') {
                
                container.innerHTML = '<div class="loading-error">Đang tải thư viện D3/Markmap... (vui lòng chờ)</div>';
                setTimeout(initializeMarkmap, 500);
                return;
            }

            try {
                const { Markmap } = window.markmap;
                const { Transformer } = window.markmap.lib;
                
                console.log('Markmap libraries loaded successfully');
                
                // Transform markdown
                const transformer = new Transformer();
                const { root, features } = transformer.transform(markdownContent);
                
                if (!root) {
                    throw new Error('Không thể phân tích cấu trúc markdown');
                }

                console.log('Markdown transformed successfully');

                // Clear container
                container.innerHTML = '';
                
                // Create SVG element
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.setAttribute('class', 'markmap-svg');
                container.appendChild(svg);
                
                // Tạo markmap
                Markmap.create(svg, null, root);
                
                console.log('Markmap created successfully');
                
            } catch (error) {
                console.error('Error creating markmap:', error);
                container.innerHTML = \`
                    <div class="loading-error">
                        <strong>Lỗi khi tạo sơ đồ:</strong><br/>
                        \${error.message}<br/>
                        <small style="margin-top: 10px; display: block;">
                            Chi tiết lỗi: \${error.toString()}<br/>
                            <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Thử lại
                            </button>
                        </small>
                    </div>
                \`;
            }
        }

        function downloadMindmap() {
            alert('Tính năng tải về sẽ được cập nhật trong phiên bản tiếp theo.');
        }

        // Hàm kiểm tra thư viện đã load xong chưa
        function waitForLibraries() {
            const container = document.getElementById('mindmap');
            let attempts = 0;
            const maxAttempts = 30; // 15 giây timeout
            
            function check() {
                attempts++;
                
                if (typeof window.d3 !== 'undefined' && 
                    typeof window.markmap !== 'undefined' && 
                    typeof window.markmap.lib !== 'undefined' &&
                    typeof window.markmap.lib.Transformer !== 'undefined') {
                    
                    console.log('All libraries loaded successfully');
                    initializeMarkmap();
                    return;
                }
                
                if (attempts >= maxAttempts) {
                    container.innerHTML = \`
                        <div class="loading-error">
                            <strong>Lỗi: Không thể tải thư viện</strong><br/>
                            Thư viện D3 hoặc Markmap không tải được.<br/>
                            <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Tải lại trang
                            </button>
                        </div>
                    \`;
                    return;
                }
                
                container.innerHTML = \`<div class="loading-error">Đang tải thư viện... (\${attempts}/\${maxAttempts})</div>\`;
                setTimeout(check, 500);
            }
            
            check();
        }

        // Bắt đầu khi trang loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitForLibraries);
        } else {
            waitForLibraries();
        }

        // Xử lý resize
        window.addEventListener('resize', function() {
            if (typeof window.markmap !== 'undefined') {
                setTimeout(initializeMarkmap, 300);
            }
        });
    </script>
</body>
</html>`;
}
module.exports = router;