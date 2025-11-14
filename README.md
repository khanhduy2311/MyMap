# MyMap - Ứng dụng Tạo Sơ Đồ Tư Duy Cộng Tác

Ứng dụng tạo sơ đồ tư duy với xử lý tài liệu AI và chat real-time.

## 🚀 Tính năng

- **Xử lý tài liệu thông minh**: Upload PDF, DOCX, ảnh và tự động tạo mind map bằng AI
- **Trình soạn thảo Mind Map**: Trình soạn thảo trực quan với React Flow
- **Chat thời gian thực**: Trò chuyện với bạn bè qua Socket.IO
- **Quản lý thư mục**: Tổ chức mind maps theo thư mục
- **Xóa mềm**: Khôi phục mind maps đã xóa từ thùng rác

## 📋 Yêu cầu hệ thống

- Node.js >= 14.x
- MongoDB Atlas account
- Redis server (local hoặc cloud)
- npm hoặc yarn

## ⚙️ Cài đặt

### 1. Sao chép dự án

```bash
git clone https://github.com/khanhduy2311/MyMap.git
cd MyMap
```

### 2. Cài đặt thư viện phụ thuộc

```bash
# Thư viện backend
npm install

# Thư viện React app
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

# Redis (quan trọng cho lưu trữ job)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Khóa AI API
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

### 5. Biên dịch ứng dụng React

```bash
cd MindMapBoDoi/project-d10
npm run build
cd ../..
```

## 🏃 Chạy ứng dụng

### Chế độ phát triển

```bash
# Terminal 1: Chạy backend với hot-reload
npm run dev

# Terminal 2: Chạy React app (tùy chọn - cho phát triển)
cd MindMapBoDoi/project-d10
npm start
```

### Chế độ production

```bash
# Biên dịch React app trước
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
├── controllers/           # Logic nghiệp vụ
├── routes/               # Điểm cuối API
├── middlewares/          # Xác thực, kiểm tra, giới hạn tốc độ
├── models/               # Schemas cơ sở dữ liệu (tham khảo)
├── utils/                # Logger, Redis client, email
├── views/                # Templates Pug
├── public/               # Tài nguyên tĩnh
├── logs/                 # Nhật ký ứng dụng
├── MindMapBoDoi/
│   └── project-d10/      # Trình soạn thảo React mind map
└── .github/
    └── copilot-instructions.md  # Hướng dẫn AI agent
```

## 🔐 Bảo mật

### Đã triển khai:
- ✅ Kiểm tra dữ liệu đầu vào với express-validator
- ✅ Giới hạn tốc độ cho đăng nhập, đăng ký, upload
- ✅ Kiểm tra session secret trong môi trường production
- ✅ Lưu trữ job trên Redis (thay thế Map trong bộ nhớ)
- ✅ Ghi nhật ký có cấu trúc với Winston
- ✅ Cấu hình CORS
- ✅ Giới hạn upload file

### Cần làm thêm (tùy chọn):
- [ ] Mã hóa mật khẩu với bcrypt
- [ ] HTTPS trong production
- [ ] Indexes cơ sở dữ liệu để tăng hiệu suất
- [ ] Kiểm thử đơn vị
- [ ] Đóng gói Docker

## 📊 Giám sát & Nhật ký

Nhật ký được lưu trong thư mục `logs/`:
- `error.log`: Chỉ lỗi
- `combined.log`: Tất cả nhật ký

Xem nhật ký theo thời gian thực:
```bash
tail -f logs/combined.log
```

## 🐛 Gỡ lỗi

Backend chạy với flag `--inspect` trong chế độ phát triển:

```bash
npm run dev
```

Sau đó mở Chrome và truy cập `chrome://inspect`

## 🧪 Kiểm thử

Hiện tại chưa có bộ kiểm thử tự động. Kiểm thử thủ công:

```bash
# Kiểm tra kết nối Gemini API
node test-gemini.js
```

## 📝 Biến môi trường

| Biến | Bắt buộc | Mặc định | Mô tả |
|----------|----------|---------|-------------|
| MONGO_URI | ✅ | - | Chuỗi kết nối MongoDB |
| SESSION_SECRET | ✅ (prod) | ngẫu nhiên | Khóa mã hóa session |
| REDIS_HOST | ✅ | localhost | Địa chỉ máy chủ Redis |
| REDIS_PORT | ❌ | 6379 | Cổng máy chủ Redis |
| PORT | ❌ | 3000 | Cổng server |
| NODE_ENV | ❌ | development | Chế độ môi trường |
| LOG_LEVEL | ❌ | info | Mức độ ghi nhật ký |

## 🔑 Bí mật & Môi trường

- Giữ bí mật ngoài git: `.env` đã được bỏ qua. Sử dụng `.env.example` làm mẫu.
- Production trên Render: đặt tất cả biến trong bảng điều khiển dịch vụ. Không upload `.env`.
- Xoay vòng khóa bị rò rỉ ngay lập tức nếu bị lộ trong commits hoặc ảnh chụp màn hình:
    - MongoDB: đổi mật khẩu người dùng và cập nhật `MONGO_URI`.
    - Cloudinary: tạo lại `CLOUDINARY_API_SECRET` (và API key nếu cần).
    - Gemini, Hugging Face, OpenRouter, OCR.Space: thu hồi và tạo lại token.
    - Redis: ưu tiên `REDIS_URL` (xoay vòng thông tin đăng nhập hoặc instance mới).
    - Email: tạo lại mật khẩu ứng dụng (`EMAIL_PASS`).
    - Session: đặt `SESSION_SECRET` mạnh mới.

Lưu ý khi build trên Render:
- Cố định Node ở LTS qua `package.json` engines (`node: 18.x`) để tránh lỗi `localStorage` của Node 25 khi build React app.

## 🤝 Đóng góp

1. Fork dự án
2. Tạo nhánh tính năng (`git checkout -b feature/TinhNangMoi`)
3. Commit thay đổi (`git commit -m 'Thêm TinhNangMoi'`)
4. Push lên nhánh (`git push origin feature/TinhNangMoi`)
5. Tạo Pull Request

## 📄 Giấy phép

Giấy phép ISC

## 👥 Tác giả

- Nguyễn Trung Dũng
- Trương Đình Việt Dũng
- Trần Đình Duy

## 🙏 Cảm ơn

- @xyflow/react cho giao diện dựa trên node
- OpenRouter, Hugging Face, Google Gemini cho xử lý AI
- OCR.Space cho nhận dạng ký tự quang học
