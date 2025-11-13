# Trong terminal, tại thư mục d:\Demo\MyMap
git init
git add .
git commit -m "Ready for Render deployment"
git branch -M main
git remote add origin https://github.com/khanhduy2311/MyMap.git
git push -u origin main# 🚀 MyMap - Hướng Dẫn Deploy lên Render.com

## 📋 Chuẩn Bị Trước Khi Deploy

### 1. **Đẩy Code lên GitHub**

```bash
git init
git add .
git commit -m "Prepare for Render deployment"
git branch -M main
git remote add origin https://github.com/khanhduy2311/MyMap.git
git push -u origin main
```

### 2. **Chuẩn Bị Environment Variables**

Bạn cần có sẵn các thông tin sau:
- ✅ `MONGO_URI` - MongoDB Atlas connection string
- ✅ `SESSION_SECRET` - Bất kỳ chuỗi ngẫu nhiên nào
- ✅ `GEMINI_API_KEYS` - API keys từ Google AI Studio (cách nhau bằng dấu phẩy)
- ✅ `OCRSPACE_API_KEY` - API key từ OCR.space
- ✅ `HUGGINGFACE_TOKEN` - Token từ Hugging Face
- ✅ `OPENROUTER_API_KEY` - API key từ OpenRouter

---

## 🎯 Các Bước Deploy trên Render

### **Bước 1: Tạo Tài Khoản Render**
1. Truy cập https://render.com
2. Đăng ký/Đăng nhập bằng GitHub
3. Authorize Render truy cập repositories

### **Bước 2: Deploy từ GitHub**

#### **Option A: Sử dụng Blueprint (Tự động - Khuyến nghị)**

1. Vào Dashboard → Click **"New +"** → Chọn **"Blueprint"**
2. Connect repository: `khanhduy2311/MyMap`
3. Render sẽ tự động đọc file `render.yaml` và tạo:
   - ✅ Web Service (Node.js app)
   - ✅ Redis Service (Cache)
4. Thiết lập Environment Variables (xem bước 3)
5. Click **"Apply"** để bắt đầu deploy

#### **Option B: Manual Setup (Thủ công)**

##### **2.1. Tạo Redis Service trước**
1. Dashboard → **"New +"** → **"Redis"**
2. Name: `mymap-redis`
3. Region: `Singapore` (gần Việt Nam nhất)
4. Plan: **Free**
5. Click **"Create Redis"**
6. Đợi Redis khởi động (2-3 phút)

##### **2.2. Tạo Web Service**
1. Dashboard → **"New +"** → **"Web Service"**
2. Connect repository: `khanhduy2311/MyMap`
3. Cấu hình:
   - **Name**: `mymap-app`
   - **Region**: `Singapore`
   - **Branch**: `main`
   - **Root Directory**: Để trống
   - **Environment**: `Node`
   - **Build Command**: 
     ```
     npm install && cd MindMapBoDoi/project-d10 && npm install && npm run build && cd ../..
     ```
   - **Start Command**: `npm start`
   - **Plan**: **Free**

### **Bước 3: Thiết Lập Environment Variables**

Trong Web Service settings → **"Environment"** → Add các biến sau:

```env
NODE_ENV=production
NODE_VERSION=18.17.0
MONGO_URI=mongodb+srv://your-username:password@cluster.mongodb.net/
SESSION_SECRET=your-random-secret-string-here
GEMINI_API_KEYS=key1,key2,key3
OCRSPACE_API_KEY=your-ocrspace-key
HUGGINGFACE_TOKEN=your-hf-token
OPENROUTER_API_KEY=your-openrouter-key
```

**Kết nối Redis** (nếu dùng Manual Setup):
- Tìm biến `REDIS_URL` → Click **"Add from Internal Service"**
- Chọn: `mymap-redis` → Property: `Connection String`

### **Bước 4: Deploy**
1. Click **"Create Web Service"** (nếu Manual) hoặc **"Apply"** (nếu Blueprint)
2. Render sẽ tự động:
   - ⏳ Clone repository
   - ⏳ Install dependencies
   - ⏳ Build React app
   - ⏳ Start Node.js server
3. Đợi 5-10 phút cho lần deploy đầu tiên

### **Bước 5: Kiểm Tra Deploy**
1. Vào tab **"Logs"** để xem quá trình build
2. Khi thấy log: `🚀 Server is listening on port 10000` → **Thành công!**
3. URL của bạn: `https://mymap-app.onrender.com`

---

## ⚠️ Lưu Ý Quan Trọng

### **1. Free Tier Limitations**
- ⏰ **Cold start**: Service ngủ sau 15 phút không hoạt động
- ⏳ **Wake-up time**: 30-60 giây để start lại
- 💾 **Redis**: 25MB storage
- 🌐 **Bandwidth**: 100GB/tháng

### **2. MongoDB Atlas**
Đảm bảo whitelist IP của Render:
1. MongoDB Atlas → Network Access
2. Add IP: `0.0.0.0/0` (cho phép tất cả - production nên restrict hơn)

### **3. Session & Cookies**
- App đã config `sameSite: 'none'` cho production
- Cookies sẽ hoạt động qua HTTPS

### **4. File Uploads**
- ⚠️ **Render không persistent storage**
- Files upload sẽ mất khi service restart
- **Giải pháp**: Dùng Cloudinary (đã tích hợp trong code)

---

## 🔧 Troubleshooting

### **Build Failed**
```bash
# Check logs trong Render dashboard
# Thường do:
# - Thiếu dependencies
# - Node version không khớp
# - Build timeout (>15 phút)
```

**Fix**: Kiểm tra `package.json` engines:
```json
"engines": {
  "node": ">=18.0.0",
  "npm": ">=9.0.0"
}
```

### **Service không start**
```bash
# Check tab "Logs" xem lỗi gì
# Thường do:
# - Thiếu environment variables
# - MongoDB connection failed
# - Redis connection failed
```

### **502 Bad Gateway**
- Service đang cold start, đợi 30-60s
- Hoặc service crashed, check logs

### **Session không persist**
```bash
# Kiểm tra:
# 1. SESSION_SECRET đã set chưa
# 2. MongoDB connection OK
# 3. Cookie settings trong browser (allow third-party cookies)
```

---

## 🎨 Custom Domain (Optional)

1. Render Dashboard → Web Service → **"Settings"**
2. Scroll to **"Custom Domain"**
3. Add domain: `yourdomain.com`
4. Update DNS records theo hướng dẫn
5. Render tự động provision SSL certificate

---

## 📊 Monitoring

### **Health Check**
Render tự động ping endpoint `/` mỗi 5 phút

### **Logs**
- Real-time: Tab **"Logs"** trong dashboard
- Filter theo: Error, Warn, Info

### **Metrics**
- CPU/Memory usage
- Response time
- Request count

---

## 🔄 Auto Deploy

Mỗi khi push code lên GitHub branch `main`:
1. Render tự động detect changes
2. Rebuild và redeploy
3. Zero-downtime deployment (rolling restart)

---

## 💰 Chi Phí

### **Free Tier (Đủ dùng cho testing)**
- ✅ Web Service: Free
- ✅ Redis: Free (25MB)
- ⚠️ Cold start sau 15 phút

### **Starter Plan ($7/tháng nếu cần)**
- ✅ Không cold start
- ✅ 512MB RAM
- ✅ Persistent storage
- ✅ Custom domains

---

## 📞 Support

Nếu gặp vấn đề:
1. Check logs trong Render dashboard
2. Xem documentation: https://render.com/docs
3. Community forum: https://community.render.com

---

## ✅ Checklist Deploy

- [ ] Code đã push lên GitHub
- [ ] MongoDB Atlas đã whitelist IP
- [ ] Environment variables đã chuẩn bị
- [ ] Redis service đã tạo
- [ ] Web service đã deploy thành công
- [ ] Truy cập URL được
- [ ] Login/Logout hoạt động
- [ ] Upload file hoạt động
- [ ] Mind map render đúng

---

**🎉 Chúc bạn deploy thành công!**
