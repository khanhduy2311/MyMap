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
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      });

      const result = await model.generateContent(prompt);
      return result;
      
    } catch (error) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      console.warn(`Attempt ${attempt + 1} failed:`, errorMessage);
      
      if (!errorMessage.includes('429') && !errorMessage.includes('quota')) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  throw lastError;
}

// ========== TEXT EXTRACTION ==========
async function extractTextSmart(buffer, mimeType, sseRes) {
  console.log("🔍 Extracting text from:", mimeType);

  if (mimeType === 'application/pdf') {
    try {
      const data = await pdf(buffer);
      const text = data.text?.trim() || '';
      
      sendSSE(sseRes, 'progress', {
        message: `✓ Đã trích xuất ${text.length} ký tự từ PDF`
      });
      
      return text;
      
    } catch (error) {
      console.warn("PDF extraction failed:", error.message);
      
      sendSSE(sseRes, 'progress', {
        message: '🔄 Thử sử dụng OCR cho PDF...'
      });
      
      try {
        const ocrText = await runOcrSpaceFull(buffer, mimeType);
        return ocrText;
      } catch (ocrError) {
        console.warn("OCR also failed:", ocrError.message);
        throw new Error(`Không thể trích xuất văn bản từ PDF: ${error.message}`);
      }
    }
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      const text = value?.trim() || '';
      sendSSE(sseRes, 'progress', {
        message: `✓ Đã trích xuất ${text.length} ký tự từ DOCX`
      });
      return text;
    } catch (error) {
      console.warn("DOCX extraction failed:", error.message);
      return '';
    }
  }

  if (mimeType.startsWith('image/')) {
    sendSSE(sseRes, 'progress', { message: '🔄 Đang xử lý hình ảnh với OCR...' });
    try {
      return await runOcrSpaceFull(buffer, mimeType);
    } catch (error) {
      console.warn("Image OCR failed:", error.message);
      return '';
    }
  }

  try {
    return buffer.toString('utf8');
  } catch (error) {
    console.warn("Text extraction failed:", error.message);
    return '';
  }
}

// ========== CHUNK PROCESSING ==========
function splitChunksSimple(text, size = CHUNK_SIZE) {
  if (!text || text.length === 0) return [];
  
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

async function analyzeChunkSimple(chunk, chunkIndex, totalChunks) {
  const prompt = `Phân tích đoạn văn bản sau (phần ${chunkIndex + 1}/${totalChunks}):

${chunk}

Trả về kết quả dạng JSON:
{
  "mainTopic": "chủ đề chính",
  "keyPoints": ["điểm quan trọng 1", "điểm quan trọng 2"],
  "summary": "tóm tắt ngắn"
}`;

  try {
    const result = await generateWithRetry(prompt);
    const text = result?.response?.text() || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn("JSON parse error, using fallback");
      }
    }
    
    return {
      mainTopic: `Phần ${chunkIndex + 1}`,
      keyPoints: ["Nội dung quan trọng"],
      summary: chunk.substring(0, 300) + (chunk.length > 300 ? "..." : "")
    };
    
  } catch (error) {
    console.warn(`Analysis failed for chunk ${chunkIndex + 1}:`, error.message);
    return {
      mainTopic: `Phần ${chunkIndex + 1}`,
      keyPoints: ["Không thể phân tích"],
      summary: "Lỗi phân tích"
    };
  }
}

// ========== STRUCTURED MINDMAP LOGIC ==========
function createMindmapStructure(analysis, chunks) {
  const structure = {
    centralTopic: analysis.mainTopic,
    mainBranches: [],
    keyConcepts: [],
    details: {},
    statistics: {
      totalSections: chunks.length,
      mainTopics: [],
      importantPoints: analysis.keyPoints || []
    }
  };

  if (analysis.keyPoints && analysis.keyPoints.length > 0) {
    structure.mainBranches = organizeIntoBranches(analysis.keyPoints);
  }

  structure.keyConcepts = extractKeyConcepts(analysis);
  structure.details = extractDetailsFromSummary(analysis.summary);

  return structure;
}

function organizeIntoBranches(keyPoints) {
  const branches = {
    definitions: [],
    processes: [],
    examples: [],
    rules: [],
    importantNotes: [],
    applications: []
  };

  keyPoints.forEach(point => {
    const lowerPoint = point.toLowerCase();
    
    if (containsDefinitionKeywords(lowerPoint)) {
      branches.definitions.push(point);
    } else if (containsProcessKeywords(lowerPoint)) {
      branches.processes.push(point);
    } else if (containsExampleKeywords(lowerPoint)) {
      branches.examples.push(point);
    } else if (containsRuleKeywords(lowerPoint)) {
      branches.rules.push(point);
    } else if (containsImportantKeywords(lowerPoint)) {
      branches.importantNotes.push(point);
    } else {
      branches.applications.push(point);
    }
  });

  return Object.entries(branches)
    .filter(([_, items]) => items.length > 0)
    .map(([category, items]) => ({
      branchName: getBranchDisplayName(category),
      items: items.slice(0, 8)
    }));
}

function containsDefinitionKeywords(text) {
  const keywords = ['định nghĩa', 'khái niệm', 'là gì', 'được hiểu', 'định lý', 'lý thuyết'];
  return keywords.some(keyword => text.includes(keyword));
}

function containsProcessKeywords(text) {
  const keywords = ['cách', 'bước', 'quy trình', 'thủ tục', 'phương pháp', 'tiến hành', 'thực hiện'];
  return keywords.some(keyword => text.includes(keyword));
}

function containsExampleKeywords(text) {
  const keywords = ['ví dụ', 'minh họa', 'chẳng hạn', 'case study', 'ứng dụng'];
  return keywords.some(keyword => text.includes(keyword));
}

function containsRuleKeywords(text) {
  const keywords = ['quy tắc', 'luật', 'nguyên tắc', 'điều kiện', 'yêu cầu', 'ràng buộc'];
  return keywords.some(keyword => text.includes(keyword));
}

function containsImportantKeywords(text) {
  const keywords = ['quan trọng', 'chú ý', 'lưu ý', 'đặc biệt', 'quan trọng cần nhớ'];
  return keywords.some(keyword => text.includes(keyword));
}

function getBranchDisplayName(category) {
  const names = {
    definitions: 'Định nghĩa & Khái niệm',
    processes: 'Quy trình & Phương pháp',
    examples: 'Ví dụ & Minh họa',
    rules: 'Quy tắc & Nguyên tắc',
    importantNotes: 'Điểm quan trọng',
    applications: 'Ứng dụng & Thực hành'
  };
  return names[category] || category;
}

function extractKeyConcepts(analysis) {
  const concepts = new Set();
  
  if (analysis.mainTopic) {
    analysis.mainTopic.split(' ').forEach(word => {
      if (word.length > 3 && !isCommonWord(word)) {
        concepts.add(word);
      }
    });
  }
  
  if (analysis.keyPoints) {
    analysis.keyPoints.forEach(point => {
      point.split(' ').forEach(word => {
        const cleanWord = word.replace(/[.,!?;:]$/, '');
        if (cleanWord.length > 4 && !isCommonWord(cleanWord) && isCapitalizedOrImportant(cleanWord)) {
          concepts.add(cleanWord);
        }
      });
    });
  }
  
  return Array.from(concepts).slice(0, 10);
}

function isCommonWord(word) {
  const commonWords = ['các', 'những', 'đây', 'đó', 'này', 'kia', 'với', 'về', 'cho', 'từ', 'trong', 'ngoài'];
  return commonWords.includes(word.toLowerCase());
}

function isCapitalizedOrImportant(word) {
  return /^[A-Z]/.test(word) || word.length > 6;
}

function extractDetailsFromSummary(summary) {
  if (!summary) return {};
  
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const details = {
    mainIdea: sentences[0] || '',
    supportingPoints: sentences.slice(1, 4),
    conclusion: sentences[sentences.length - 1] || ''
  };
  
  return details;
}

function aggregateResultsStructured(results, chunks) {
  if (!results || results.length === 0) {
    return {
      mainTopic: "Tài liệu chưa được phân tích",
      keyPoints: ["Nội dung không khả dụng"],
      summary: "Không thể tạo tóm tắt từ tài liệu này."
    };
  }

  const topicFrequency = {};
  results.forEach(result => {
    if (result.mainTopic && result.mainTopic !== 'Nội dung chưa phân loại') {
      topicFrequency[result.mainTopic] = (topicFrequency[result.mainTopic] || 0) + 1;
    }
  });

  const mainTopic = Object.keys(topicFrequency).length > 0 
    ? Object.keys(topicFrequency).reduce((a, b) => topicFrequency[a] > topicFrequency[b] ? a : b)
    : results[0]?.mainTopic || "Tổng hợp tài liệu";

  const allKeyPoints = results.flatMap(r => 
    (r.keyPoints || []).filter(point => 
      point && point.length > 5 && !point.includes('Nội dung quan trọng')
    )
  );

  const uniqueKeyPoints = [...new Set(allKeyPoints)]
    .sort((a, b) => b.length - a.length)
    .slice(0, 20);

  const summaries = results.map(r => r.summary).filter(s => s && s.length > 20);
  const summary = summaries.length > 0 
    ? summaries.join(' ') 
    : "Tài liệu chứa nhiều thông tin đa dạng cần được nghiên cứu chi tiết.";

  return {
    mainTopic,
    keyPoints: uniqueKeyPoints.length > 0 ? uniqueKeyPoints : ["Thông tin quan trọng từ tài liệu"],
    summary,
    totalChunks: chunks.length,
    analyzedChunks: results.length
  };
}

async function generateStructuredMindmap(analysis, chunks) {
  const structuredData = createMindmapStructure(analysis, chunks);
  
  const prompt = `Tạo mindmap Markdown chi tiết và có cấu trúc từ dữ liệu sau:

DỮ LIỆU ĐÃ PHÂN TÍCH:
${JSON.stringify(structuredData, null, 2)}

YÊU CẦU MINDMAP:
1. CẤU TRÚC PHÂN CẤP RÕ RÀNG:
   - # Chủ đề chính (central topic)
   - ## Các nhánh chính (main branches)
   - ### Các nhánh con (sub-branches)
   - - Các điểm chi tiết (bullet points)

2. TỔ CHỨC THÔNG TIN:
   - Chủ đề chính làm trung tâm
   - Phân nhánh theo nội dung logic
   - Mỗi nhánh có tiêu đề rõ ràng
   - Các điểm quan trọng được liệt kê đầy đủ

3. ĐỊNH DẠNG MARKDOWN:
   - Sử dụng heading levels (#, ##, ###) cho phân cấp
   - Dùng dấu - hoặc * cho list items
   - In đậm **từ khóa quan trọng**
   - Xuống dòng hợp lý để dễ đọc

Chỉ trả về mindmap markdown, không giải thích thêm.`;

  try {
    const result = await generateWithRetry(prompt);
    let markdown = result?.response?.text() || '';
    
    markdown = cleanAndStructureMarkdown(markdown, structuredData);
    return markdown;
    
  } catch (error) {
    console.warn("Structured mindmap failed, using fallback:", error.message);
    return createStructuredFallbackMindmap(structuredData);
  }
}

function cleanAndStructureMarkdown(markdown, structure) {
  let cleaned = markdown
    .replace(/^```markdown\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/\*\*(.*?)\*\*/g, '**$1**')
    .trim();

  if (!cleaned.includes('# ') || cleaned.split('\n').length < 5) {
    return createStructuredFallbackMindmap(structure);
  }

  if (structure.statistics.totalSections > 1) {
    cleaned += `\n\n---\n*Tổng hợp từ ${structure.statistics.totalSections} phần nội dung*`;
  }

  return cleaned;
}

function createStructuredFallbackMindmap(structure) {
  let markdown = `# ${structure.centralTopic}\n\n`;

  structure.mainBranches.forEach(branch => {
    markdown += `## ${branch.branchName}\n`;
    branch.items.forEach(item => {
      markdown += `- ${item}\n`;
    });
    markdown += '\n';
  });

  if (structure.keyConcepts.length > 0) {
    markdown += `## Khái niệm quan trọng\n`;
    structure.keyConcepts.forEach(concept => {
      markdown += `- **${concept}**\n`;
    });
    markdown += '\n';
  }

  if (structure.details.mainIdea) {
    markdown += `## Tóm tắt\n`;
    markdown += `### Ý chính\n`;
    markdown += `- ${structure.details.mainIdea}\n\n`;
    
    if (structure.details.supportingPoints && structure.details.supportingPoints.length > 0) {
      markdown += `### Điểm hỗ trợ\n`;
      structure.details.supportingPoints.forEach(point => {
        markdown += `- ${point.trim()}\n`;
      });
      markdown += '\n';
    }
  }

  return markdown;
}

// ========== OCR FUNCTIONS ==========
async function ocrSpaceParseBuffer(buffer, mimeType) {
  if (!OCRSPACE_API_KEY) throw new Error("OCRSPACE_API_KEY not configured.");
  
  const form = new FormData();
  form.append('apikey', OCRSPACE_API_KEY);
  form.append('language', 'eng');
  form.append('isOverlayRequired', 'false');
  form.append('OCREngine', '2');
  form.append('file', buffer, {
    filename: `upload.${mimeType.split('/')[1] || 'bin'}`
  });

  try {
    const resp = await axios.post('https://api.ocr.space/parse/image', form, {
      headers: form.getHeaders(),
      timeout: 60000
    });
    return resp.data;
  } catch (error) {
    console.warn("OCR.Space API error:", error.message);
    throw error;
  }
}

async function runOcrSpaceFull(buffer, mimeType) {
  const data = await ocrSpaceParseBuffer(buffer, mimeType);
  if (data?.IsErroredOnProcessing) {
    throw new Error(data.ErrorMessage || "OCR processing failed");
  }
  return (data.ParsedResults || []).map(p => p.ParsedText || '').join('\n');
}

// ========== MULTER & STORAGE ==========
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

const jobs = new Map();
const sseClients = new Map();

// ========== SSE FUNCTIONS ==========
function sendSSE(res, event, data) {
  if (!res || res.writableEnded) return;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch (e) {
    console.warn("Failed to send SSE:", e.message);
  }
}

// ========== ROUTES ==========
router.get('/page', authMiddleware.checkLoggedIn, documentController.getUploadPage);

router.post('/start-summarize', authMiddleware.checkLoggedIn, upload.single('documentFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  
  const jobId = uuidv4();
  const enableOcrPreview = req.body.enableOcrPreview === 'true';

  jobs.set(jobId, {
    id: jobId,
    status: 'pending',
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    filename: req.file.originalname,
    enableOcrPreview,
    results: [],
    startTime: Date.now()
  });
  
  res.status(202).json({ jobId });
});

router.get('/summarize-stream', authMiddleware.checkLoggedIn, (req, res) => {
  const { jobId } = req.query;
  const job = jobs.get(jobId);
  
  if (!jobId || !job) {
    return res.status(404).send('Job not found.');
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  sseClients.set(jobId, res);
  
  req.on('close', () => {
    sseClients.delete(jobId);
  });

  if (job.status === 'pending') {
    processDocument(jobId).catch(error => {
      console.error('Processing error:', error);
    });
  }
});

// ========== MINDMAP VISUALIZATION HTML GENERATOR ==========
function generateMindmapHTML(markdownContent, title = "Mindmap Visualization") {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.2.7"></script>
    <script src="https://cdn.jsdelivr.net/npm/markmap-lib@0.11.6"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 300;
        }
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }
        .content {
            display: flex;
            min-height: 600px;
        }
        .markdown-panel {
            flex: 1;
            padding: 30px;
            background: #f8f9fa;
            border-right: 2px solid #e9ecef;
            overflow-y: auto;
            max-height: 800px;
        }
        .visualization-panel {
            flex: 2;
            padding: 20px;
            background: white;
            position: relative;
        }
        #mindmap {
            width: 100%;
            height: 700px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            background: #fafafa;
        }
        .markdown-content {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.08);
            font-family: 'Consolas', 'Monaco', monospace;
            line-height: 1.6;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .controls {
            padding: 20px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
            display: flex;
            gap: 15px;
            justify-content: center;
        }
        .btn {
            padding: 12px 25px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .btn-primary {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
        }
        .btn-secondary {
            background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
            color: white;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        }
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            font-size: 18px;
            color: #7f8c8d;
        }
        .node {
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .node:hover {
            filter: brightness(1.1);
        }
        @media (max-width: 768px) {
            .content {
                flex-direction: column;
            }
            .markdown-panel {
                border-right: none;
                border-bottom: 2px solid #e9ecef;
                max-height: 400px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗺️ Mindmap Visualization</h1>
            <p>Interactive visualization of your document structure</p>
        </div>
        
        <div class="content">
            <div class="markdown-panel">
                <h3>Markdown Content:</h3>
                <div class="markdown-content">${markdownContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>
            
            <div class="visualization-panel">
                <h3>Interactive Mindmap:</h3>
                <svg id="mindmap"></svg>
            </div>
        </div>
        
        <div class="controls">
            <button class="btn btn-primary" onclick="downloadMindmap()">
                📥 Download as Image
            </button>
            <button class="btn btn-secondary" onclick="window.print()">
                🖨️ Print Mindmap
            </button>
            <a href="/document/page" class="btn btn-secondary">
                ↩️ Back to Upload
            </a>
        </div>
    </div>

    <script>
        const markdownContent = \`${markdownContent}\`;
        
        // Initialize markmap
        const { Transformer } = window.markmap;
        const { Markmap } = window.markmap;
        
        async function renderMindmap() {
            try {
                const transformer = new Transformer();
                const { root, features } = transformer.transform(markdownContent);
                
                const svg = document.getElementById('mindmap');
                svg.innerHTML = '';
                
                Markmap.create(svg, {}, root);
                
                // Add zoom and pan functionality
                const panZoom = window.markmap.panZoom;
                if (panZoom) {
                    panZoom(svg, {
                        maxZoom: 5,
                        minZoom: 0.1,
                    });
                }
                
            } catch (error) {
                console.error('Error rendering mindmap:', error);
                document.getElementById('mindmap').innerHTML = 
                    '<div class="loading">Error rendering mindmap. Please check the console.</div>';
            }
        }
        
        function downloadMindmap() {
            const svg = document.getElementById('mindmap');
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const pngFile = canvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.download = 'mindmap.png';
                downloadLink.href = pngFile;
                downloadLink.click();
            };
            
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        }
        
        // Render on load
        document.addEventListener('DOMContentLoaded', renderMindmap);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            setTimeout(renderMindmap, 100);
        });
    </script>
</body>
</html>`;
}

// ========== NEW ROUTE FOR MINDMAP VISUALIZATION ==========
router.get('/mindmap-visualization/:jobId', authMiddleware.checkLoggedIn, (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  
  if (!job || job.status !== 'done') {
    return res.status(404).send('Mindmap not found or not ready.');
  }
  
  const html = generateMindmapHTML(job.result, `Mindmap - ${job.filename}`);
  res.send(html);
});

// ========== MAIN PROCESSING FUNCTION ==========
async function processDocument(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  
  job.status = 'processing';
  const sse = sseClients.get(jobId);
  
  try {
    sendSSE(sse, 'progress', { message: '🔄 Bắt đầu xử lý tài liệu...' });

    // Step 1: Extract text
    sendSSE(sse, 'progress', { message: '📄 Đang trích xuất văn bản...' });
    const extractedText = await extractTextSmart(job.buffer, job.mimeType, sse);
    
    if (!extractedText || extractedText.trim().length < 100) {
      throw new Error('Không thể trích xuất văn bản từ tài liệu. File có thể bị lỗi hoặc định dạng không được hỗ trợ.');
    }

    sendSSE(sse, 'progress', { 
      message: `✅ Đã trích xuất ${extractedText.length} ký tự`,
      textLength: extractedText.length
    });

    // Step 2: Split into chunks
    const chunks = splitChunksSimple(extractedText, CHUNK_SIZE);
    sendSSE(sse, 'progress', {
      message: `📦 Chia thành ${chunks.length} phần để phân tích`,
      totalChunks: chunks.length
    });

    // Step 3: Process each chunk
    const analyses = [];
    for (let i = 0; i < chunks.length; i++) {
      sendSSE(sse, 'progress', {
        message: `🤖 Đang phân tích phần ${i + 1}/${chunks.length}`,
        chunkDone: i,
        totalChunks: chunks.length
      });

      const analysis = await analyzeChunkSimple(chunks[i], i, chunks.length);
      analyses.push(analysis);

      sendSSE(sse, 'progress', {
        message: `✅ Đã phân tích phần ${i + 1}/${chunks.length}`,
        chunkDone: i + 1,
        totalChunks: chunks.length
      });

      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Step 4: Aggregate results
    sendSSE(sse, 'progress', { message: '📊 Đang tổng hợp kết quả...' });
    const finalAnalysis = aggregateResultsStructured(analyses, chunks);

    // Step 5: Generate mindmap
    sendSSE(sse, 'progress', { message: '🗺️ Đang tạo mindmap có cấu trúc...' });
    const mindmap = await generateStructuredMindmap(finalAnalysis, chunks);

    // Step 6: Complete
    job.status = 'done';
    job.result = mindmap;
    job.processingTime = Date.now() - job.startTime;

    // Send completion with visualization link
    sendSSE(sse, 'complete', {
      markdown: mindmap,
      visualizationUrl: `/document/mindmap-visualization/${jobId}`,
      stats: {
        totalChunks: chunks.length,
        processedChunks: analyses.length,
        processingTime: job.processingTime,
        textLength: extractedText.length,
        mainTopic: finalAnalysis.mainTopic
      }
    });

    console.log(`✅ Job ${jobId} completed with structured mindmap`);

  } catch (error) {
    console.error('❌ Processing failed:', error.message);
    job.status = 'error';
    job.error = error.message;
    
    sendSSE(sse, 'error', {
      message: `Lỗi xử lý: ${error.message}`
    });
  } finally {
    try {
      if (sse && !sse.writableEnded) {
        sse.end();
      }
    } catch (e) {
      console.warn('Error closing SSE:', e.message);
    }
    
    sseClients.delete(jobId);
    job.buffer = null;
    
    setTimeout(() => {
      jobs.delete(jobId);
    }, 5 * 60 * 1000);
  }
}
router.get('/upload', (req, res) => {
  res.render('upload-document');
});
module.exports = router;