# 🐛 Bug Fixes - Production Deploy (Render)

## Các lỗi đã được sửa:

### ✅ 1. Video background không hiện trên production
**Nguyên nhân:** Video files (143MB) bị gitignore, không có trên Render

**Giải pháp:**
- ✅ Thêm Cloudinary CDN URLs vào tất cả Pug templates
- ✅ Thêm fallback local paths cho development
- ✅ Tạo poster images (SVG) để fallback khi video không load
- ✅ Cập nhật folder name từ `mymap-videos` → `mindmap_videos`

**Files đã sửa:**
- `views/login.pug` - Added Cloudinary URL + poster
- `views/register.pug` - Added Cloudinary URL + poster
- `views/forgot-password.pug` - Added Cloudinary URL + poster
- `views/reset-password.pug` - Added Cloudinary URL + poster

**Cách upload videos lên Cloudinary:**
```bash
node scripts/upload-videos.js
```

---

### ✅ 2. Không tạo được mindmap trống từ dashboard
**Nguyên nhân:** 
- Frontend gửi `nodes` và `edges` thay vì `content` (markdown)
- Response path sai: `data.mindmapId` thay vì `data.data.mindmapId`

**Giải pháp:**
- ✅ Sửa `createNewMindmap()` function trong `views/dashboard.pug`
- ✅ Gửi `content: '# Mindmap mới\n\nBắt đầu...'` thay vì nodes/edges
- ✅ Fix response path: `data.data.mindmapId`
- ✅ Thêm POST route `/mindmaps/` (alias cho `/mindmaps/create`)

**Files đã sửa:**
- `views/dashboard.pug` - Fixed createNewMindmap function
- `routes/mindmap.js` - Added POST `/` route

---

### ✅ 3. Lỗi khi đổi avatar
**Nguyên nhân:** Thiếu validation cho Cloudinary credentials

**Giải pháp:**
- ✅ Thêm check Cloudinary config trong `middlewares/avatarUpload.js`
- ✅ Log error rõ ràng khi thiếu credentials
- ✅ Avatar upload controller đã có error handling đầy đủ

**Files đã sửa:**
- `middlewares/avatarUpload.js` - Added config validation

---

### ✅ 4. Thiếu poster images cho video fallback
**Giải pháp:**
- ✅ Tạo script `scripts/generate-poster-images.js`
- ✅ Generate 4 SVG poster images với gradient backgrounds
- ✅ Đã tạo: poster-typing.svg, poster-galaxy.svg, poster-forgot.svg, poster-reset.svg

---

## 🚀 Deployment Checklist cho Render

### 1. Environment Variables (Render Dashboard)
Đảm bảo có đầy đủ:
```
MONGO_URI=mongodb+srv://...
SESSION_SECRET=your_secret_key
NODE_ENV=production

# Cloudinary (bắt buộc cho avatar upload)
CLOUDINARY_CLOUD_NAME=df6jrfhk2
CLOUDINARY_API_KEY=241763353478845
CLOUDINARY_API_SECRET=5OLgMgW1VwLawhDwiLJ5nURyvR4

# Email (optional, for password reset)
EMAIL_USER=...
EMAIL_PASS=...

# AI APIs (optional, for document processing)
GEMINI_API_KEYS=...
HUGGINGFACE_TOKEN=...
OPENROUTER_API_KEY=...
OCRSPACE_API_KEY=...
```

### 2. Upload Videos lên Cloudinary (Chỉ làm 1 lần)
```bash
# Local machine
node scripts/upload-videos.js
```

### 3. Build Process
Render sẽ tự động chạy:
```bash
npm install
npm run build  # Build React app
npm start      # Start server
```

### 4. Kiểm tra sau deploy
- ✅ Video backgrounds hiển thị trên login/register/forgot/reset pages
- ✅ Tạo mindmap trống từ dashboard hoạt động
- ✅ Upload avatar hoạt động (Cloudinary)
- ✅ Tạo mindmap từ document upload hoạt động
- ✅ Session persistence hoạt động
- ✅ MongoDB indexes đã được tạo

---

## 📝 Files thay đổi trong lần fix này

### Views (Pug templates)
- `views/login.pug`
- `views/register.pug`
- `views/forgot-password.pug`
- `views/reset-password.pug`
- `views/dashboard.pug`

### Routes
- `routes/mindmap.js`

### Middlewares
- `middlewares/avatarUpload.js`

### Scripts
- `scripts/generate-poster-images.js` (new)
- `scripts/upload-videos.js` (updated folder name)

### Public Assets
- `public/images/poster-*.svg` (4 files generated)

---

## 🔧 Nếu vẫn có lỗi sau deploy

### Video không hiển thị
1. Kiểm tra Cloudinary URLs có đúng không
2. Chạy `node scripts/upload-videos.js` nếu chưa upload
3. Kiểm tra browser console có lỗi CORS không

### Không tạo được mindmap
1. Check browser console có lỗi 400/500 không
2. Verify MongoDB connection working
3. Check user collection đã được tạo chưa

### Avatar upload fail
1. Verify Cloudinary credentials trong Render env vars
2. Check file size < 5MB
3. Check file type là image (jpg, png, webp)

### Session bị mất
1. Verify SESSION_SECRET đã set trong Render
2. Check cookie.secure = true (production)
3. Verify MongoDB sessions collection working

---

## 📞 Debug Commands

```bash
# Check Cloudinary config
node -e "require('dotenv').config(); console.log(process.env.CLOUDINARY_CLOUD_NAME)"

# Test MongoDB connection
node -e "require('dotenv').config(); const {MongoClient}=require('mongodb'); MongoClient.connect(process.env.MONGO_URI).then(()=>console.log('✅ DB OK')).catch(e=>console.error('❌',e))"

# Check if videos uploaded to Cloudinary
# Go to: https://console.cloudinary.com/console/media_library
```

---

## ✅ Summary

**Tất cả lỗi chính đã được sửa:**
1. ✅ Videos → Cloudinary CDN + SVG posters
2. ✅ Mindmap creation → Fixed request payload
3. ✅ Avatar upload → Added validation
4. ✅ API responses → Standardized with ok/fail helpers
5. ✅ Logging → Replaced console with Winston logger
6. ✅ MongoDB indexes → Auto-created on startup

**Ready to deploy! 🚀**
