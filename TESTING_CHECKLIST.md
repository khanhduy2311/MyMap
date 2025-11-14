# 🧪 Testing Checklist - Trước khi Deploy

## ✅ Local Testing (Đã pass)

### 1. Video Backgrounds
- ✅ Login page: Video typing.mp4 hiển thị
- ✅ Register page: Video galaxy.mp4 hiển thị
- ✅ Forgot password: Video forgot.mp4 hiển thị
- ✅ Reset password: Video reset.mp4 hiển thị
- ✅ Poster images (SVG) hiển thị khi video chưa load

### 2. Authentication Flow
- ✅ Register new account
- ✅ Login with email/password
- ✅ Logout
- ✅ Forgot password email
- ✅ Reset password with token

### 3. Dashboard & Mindmap
- ✅ Tạo mindmap trống từ dashboard
- ✅ View mindmap list
- ✅ Edit mindmap title
- ✅ Delete mindmap (soft delete)
- ✅ Restore from trash
- ✅ Permanent delete

### 4. Profile Management
- ✅ View profile
- ✅ Edit username/display name
- ✅ Change avatar (upload to Cloudinary)
- ✅ Change password

### 5. Friends & Chat
- ✅ Send friend request
- ✅ Accept/reject friend request
- ✅ View friend list
- ✅ Chat with friends (Socket.IO)
- ✅ Online/offline status

### 6. Document Processing
- ✅ Upload PDF/DOCX/Image
- ✅ Extract text (OCR)
- ✅ AI summarization (OpenRouter/Gemini/HuggingFace)
- ✅ Generate mindmap from document

---

## 🚀 Production Testing Checklist (Render)

### Pre-Deploy
- [ ] Commit all changes to Git
- [ ] Push to GitHub/GitLab
- [ ] Verify `.env` has all required vars
- [ ] Backup MongoDB data (if needed)

### Deploy
- [ ] Connect Render to repository
- [ ] Set environment variables in Render dashboard
- [ ] Deploy and wait for build to complete
- [ ] Check build logs for errors

### Post-Deploy Testing

#### 1. Video Backgrounds ⭐ CRITICAL
```
URL: https://your-app.onrender.com/login
- [ ] Video background hiển thị
- [ ] Poster image hiển thị khi loading
- [ ] Video autoplay + loop

URL: /register
- [ ] Video galaxy.mp4 hiển thị

URL: /forgot-password
- [ ] Video forgot.mp4 hiển thị

URL: /reset-password (cần token)
- [ ] Video reset.mp4 hiển thị
```

#### 2. Core Features
```
- [ ] Register account → Email validation works
- [ ] Login → Redirect to dashboard
- [ ] Dashboard loads mindmap list
- [ ] Tạo mindmap trống → Opens React editor
- [ ] Save mindmap → Returns to dashboard
```

#### 3. Avatar Upload ⭐ CRITICAL
```
- [ ] Go to /profile/edit
- [ ] Upload image < 5MB
- [ ] Avatar appears in Cloudinary
- [ ] Avatar URL saved to MongoDB
- [ ] Avatar displays on profile page
```

#### 4. Document Upload
```
- [ ] Go to /upload
- [ ] Upload PDF/DOCX file
- [ ] SSE progress updates
- [ ] AI summarization works
- [ ] Save mindmap works
```

#### 5. Real-time Chat
```
- [ ] Open 2 browser tabs (2 different users)
- [ ] Send friend request
- [ ] Accept request
- [ ] Online status updates
- [ ] Chat messages sync in real-time
```

#### 6. Performance
```
- [ ] Page load < 3s
- [ ] Video streaming smooth
- [ ] No console errors
- [ ] MongoDB queries fast (check indexes)
```

---

## 🐛 Known Issues & Workarounds

### Issue: Video hiển thị chậm lần đầu
**Solution:** Cloudinary caching, refresh page hoặc đợi 30s

### Issue: Mindmap không save
**Checklist:**
1. Browser console có lỗi 400/500 không?
2. MongoDB connection OK? (check Render logs)
3. User collection exists? (check MongoDB Atlas)

### Issue: Avatar upload fail
**Checklist:**
1. Cloudinary credentials đúng không?
2. File size < 5MB?
3. File type: jpg, png, webp?

### Issue: Chat không real-time
**Checklist:**
1. Socket.IO connection OK? (check browser console)
2. Redis connection OK? (optional)
3. Session middleware shared with Socket.IO?

---

## 📊 Monitoring

### Render Dashboard
- CPU/Memory usage
- Request logs
- Error logs

### Cloudinary Dashboard
- Video bandwidth usage
- Image transformations
- Storage used

### MongoDB Atlas
- Connection count
- Query performance
- Database size

---

## 🔥 Emergency Rollback

Nếu production bị lỗi nghiêm trọng:

```bash
# Option 1: Rollback to previous commit
git revert HEAD
git push

# Option 2: Redeploy previous version
# Go to Render → Manual Deploy → Select previous commit

# Option 3: Disable problematic features
# Set env var: FEATURE_FLAG_VIDEO=false
```

---

## ✅ Success Criteria

Deploy được coi là thành công khi:
- ✅ Tất cả 4 video backgrounds hiển thị
- ✅ Tạo mindmap trống hoạt động
- ✅ Avatar upload hoạt động
- ✅ No critical errors in logs
- ✅ Page load time < 5s
- ✅ Session persistence works

---

## 📝 Notes

- Videos đã upload lên Cloudinary:
  - `forgot.mp4`: ✅ https://res.cloudinary.com/df6jrfhk2/video/upload/v1763107853/mindmap_videos/forgot.mp4
  - `galaxy.mp4`: ✅ https://res.cloudinary.com/df6jrfhk2/video/upload/v1763107884/mindmap_videos/galaxy.mp4
  - `reset.mp4`: ✅ https://res.cloudinary.com/df6jrfhk2/video/upload/v1763108049/mindmap_videos/reset.mp4
  - `typing.mp4`: ✅ https://res.cloudinary.com/df6jrfhk2/video/upload/v1763108128/mindmap_videos/typing.mp4

- Poster images (SVG) đã tạo trong `public/images/`

- MongoDB indexes sẽ tự động tạo khi server start

Good luck! 🍀
