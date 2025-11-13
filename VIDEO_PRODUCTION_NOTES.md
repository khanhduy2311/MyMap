# 📹 Video Files - Production Notes

## ⚠️ Video Files Không Được Commit

Các video files trong `public/videos/` đã bị loại trừ khỏi Git vì quá lớn:
- `forgot.mp4` - 13.79 MB
- `galaxy.mp4` - 40.52 MB  
- `reset.mp4` - 52.19 MB
- `typing.mp4` - 36.52 MB

**Tổng: ~143 MB**

## 🚀 Solutions cho Production

### **Option 1: Upload lên CDN (Khuyến nghị)**

#### **Cloudinary (Free 25GB)**
```bash
# Upload videos
npm install cloudinary
```

```javascript
// Upload script
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'your-cloud-name',
  api_key: 'your-api-key',
  api_secret: 'your-api-secret'
});

// Upload
cloudinary.uploader.upload('public/videos/galaxy.mp4', {
  resource_type: 'video',
  public_id: 'galaxy',
  folder: 'mymap-videos'
});
```

#### **Sử dụng trong code:**
```pug
// views/home.pug
video(autoplay muted loop playsinline)
  source(src="https://res.cloudinary.com/your-cloud/video/upload/mymap-videos/galaxy.mp4" type="video/mp4")
```

### **Option 2: Self-host trên Render**

⚠️ **Lưu ý**: Render free tier không có persistent storage

```bash
# Thêm vào .slugignore (nếu deploy Heroku)
public/videos/*.mp4

# Hoặc mount external storage
```

### **Option 3: YouTube Embed**

Upload video lên YouTube (unlisted) và embed:

```pug
// views/home.pug
iframe(
  src="https://www.youtube.com/embed/VIDEO_ID?autoplay=1&mute=1&loop=1&playlist=VIDEO_ID"
  frameborder="0"
  allow="autoplay; encrypted-media"
)
```

### **Option 4: Compress Videos**

Giảm kích thước file trước khi deploy:

```bash
# Cài đặt FFmpeg
# Windows: choco install ffmpeg
# Mac: brew install ffmpeg

# Compress video
ffmpeg -i galaxy.mp4 -vcodec libx265 -crf 28 galaxy-compressed.mp4

# Kết quả: ~5-10MB thay vì 40MB
```

## 📦 Temporary Solution

Nếu cần videos cho local development:
1. Download từ Google Drive/Dropbox
2. Copy vào `public/videos/`
3. Git sẽ tự động ignore

## 🔧 Update Code for CDN

Khi đã upload lên CDN, update các file Pug:

```pug
// Before
video(autoplay muted loop playsinline)
  source(src="/videos/galaxy.mp4" type="video/mp4")

// After (Cloudinary)
video(autoplay muted loop playsinline)
  source(
    src="https://res.cloudinary.com/your-cloud/video/upload/v1/mymap-videos/galaxy.mp4" 
    type="video/mp4"
  )
```

## ✅ Checklist

- [ ] Videos uploaded to CDN
- [ ] Update video URLs in Pug files
- [ ] Test video playback on production
- [ ] Update `.gitignore` to exclude videos
- [ ] Document CDN credentials in `.env`

---

**Cho mục đích demo**: Có thể thay videos bằng ảnh tĩnh hoặc CSS animations để giảm file size.
