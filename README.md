# MyMap - Collaborative Mind Mapping Application

Ứng dụng tạo sơ đồ tư duy với xử lý tài liệu AI và chat real-time.

## 🚀 Tính năng

- **Xử lý tài liệu thông minh**: Upload PDF, DOCX, ảnh và tự động tạo mind map bằng AI
- **Mind Map Editor**: Trình soạn thảo trực quan với React Flow
- **Real-time Chat**: Trò chuyện với bạn bè qua Socket.IO
- **Quản lý thư mục**: Tổ chức mind maps theo thư mục
- **Soft Delete**: Khôi phục mind maps đã xóa từ thùng rác

## 📋 Yêu cầu hệ thống

- Node.js >= 14.x
- MongoDB Atlas account
- Redis server (local hoặc cloud)
- npm hoặc yarn

## ⚙️ Cài đặt

### 1. Clone repository

```bash
git clone https://github.com/khanhduy2311/MyMap.git
cd MyMap
```

### 2. Cài đặt dependencies

```bash
# Backend dependencies
npm install

# React app dependencies
cd MindMapBoDoi/project-d10
npm install
cd ../..
```

### 3. Cấu hình môi trường

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Cập nhật các biến môi trường:

```env
# MongoDB
MONGO_URI=mongodb+srv://your_connection_string

# Session (QUAN TRỌNG: Đổi trong production!)
SESSION_SECRET=your_secure_random_secret_min_32_chars

# Redis (quan trọng cho job storage)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# AI API Keys
GEMINI_API_KEYS=key1,key2,key3
OCRSPACE_API_KEY=your_key
HUGGINGFACE_TOKEN=your_token
OPENROUTER_API_KEY=your_key
```

### 4. Cài đặt Redis

**Windows:**
```powershell
# Sử dụng Windows Subsystem for Linux (WSL)
wsl --install
wsl
sudo apt-get update
sudo apt-get install redis-server
redis-server
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Hoặc sử dụng Redis Cloud (miễn phí):**
- Đăng ký tại https://redis.com/try-free/
- Lấy connection string và cập nhật `.env`

### 5. Build React app

```bash
cd MindMapBoDoi/project-d10
npm run build
cd ../..
```

## 🏃 Chạy ứng dụng

### Development mode

```bash
# Terminal 1: Chạy backend với hot-reload
npm run dev

# Terminal 2: Chạy React app (optional - cho development)
cd MindMapBoDoi/project-d10
npm start
```

### Production mode

```bash
# Build React app trước
cd MindMapBoDoi/project-d10
npm run build
cd ../..

# Chạy server
npm start
```

Server sẽ chạy tại `http://localhost:3000`

## 🗂️ Cấu trúc dự án

```
MyMap/
├── controllers/           # Business logic
├── routes/               # API endpoints
├── middlewares/          # Auth, validation, rate limiting
├── models/               # Database schemas (reference)
├── utils/                # Logger, Redis client, email
├── views/                # Pug templates
├── public/               # Static assets
├── logs/                 # Application logs
├── MindMapBoDoi/
│   └── project-d10/      # React mind map editor
└── .github/
    └── copilot-instructions.md  # AI agent guidelines
```

## 🔐 Bảo mật

### Đã triển khai:
- ✅ Input validation với express-validator
- ✅ Rate limiting cho login, register, upload
- ✅ Session secret validation trong production
- ✅ Redis-based job storage (thay thế in-memory Map)
- ✅ Structured logging với Winston
- ✅ CORS configuration
- ✅ File upload restrictions

### Cần làm thêm (tùy chọn):
- [ ] Password hashing với bcrypt
- [ ] HTTPS trong production
- [ ] Database indexes cho performance
- [ ] Unit tests
- [ ] Docker containerization

## 📊 Monitoring & Logs

Logs được lưu trong thư mục `logs/`:
- `error.log`: Chỉ errors
- `combined.log`: Tất cả logs

Xem logs real-time:
```bash
tail -f logs/combined.log
```

## 🐛 Debugging

Backend chạy với flag `--inspect` trong dev mode:

```bash
npm run dev
```

Sau đó mở Chrome và truy cập `chrome://inspect`

## 🧪 Testing

Hiện tại chưa có test suite. Test thủ công:

```bash
# Test Gemini API connection
node test-gemini.js
```

## 📝 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| MONGO_URI | ✅ | - | MongoDB connection string |
| SESSION_SECRET | ✅ (prod) | random | Session encryption key |
| REDIS_HOST | ✅ | localhost | Redis server host |
| REDIS_PORT | ❌ | 6379 | Redis server port |
| PORT | ❌ | 3000 | Server port |
| NODE_ENV | ❌ | development | Environment mode |
| LOG_LEVEL | ❌ | info | Logging level |

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📄 License

ISC License

## 👥 Authors

- Nguyễn Trung Dũng
- Trương Đình Việt Dũng
- Trần Đình Duy

## 🙏 Acknowledgments

- @xyflow/react cho node-based UI
- OpenRouter, Hugging Face, Google Gemini cho AI processing
- OCR.Space cho optical character recognition
