// test-gemini.js
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Khởi tạo với API key từ .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Dùng model hợp lệ (hiện tại Google khuyên dùng: gemini-1.5-flash hoặc gemini-1.5-pro)
const MODEL_NAME = "gemini-2.5-flash";

async function testGemini() {
  try {
    console.log("🔍 Đang thử gọi Gemini API...");

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const result = await model.generateContent("Xin chào, Gemini! Bạn có đang hoạt động không?");
    console.log("✅ Phản hồi từ Gemini:");
    console.log(result.response.text());
  } catch (err) {
    console.error("❌ Lỗi khi gọi Gemini:", err.message || err);
  }
}

testGemini();
