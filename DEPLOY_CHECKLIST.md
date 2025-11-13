# ✅ DEPLOY TO RENDER - QUICK CHECKLIST

## 📦 Repository Status
- ✅ Code đã push lên GitHub: `https://github.com/khanhduy2311/MyMap`
- ✅ Branch: `main`
- ✅ Latest commit: `c02f398 - Add video production notes and upload script`

---

## 🎯 NEXT STEPS - Deploy to Render

### **Step 1: Go to Render Dashboard**
🔗 https://render.com/dashboard

### **Step 2: Create New Blueprint**
1. Click **"New +"** → **"Blueprint"**
2. Connect GitHub repository: `khanhduy2311/MyMap`
3. Render will auto-read `render.yaml`

### **Step 3: Add Environment Variables**

Copy these to Render Environment section:

```env
# Required - Copy from your .env file
MONGO_URI=mongodb+srv://...
SESSION_SECRET=your-secret-here
GEMINI_API_KEYS=key1,key2,key3
OCRSPACE_API_KEY=...
HUGGINGFACE_TOKEN=...
OPENROUTER_API_KEY=...

# Auto-configured by Render
NODE_ENV=production
NODE_VERSION=18.17.0
REDIS_URL=<auto-from-redis-service>
```

### **Step 4: Click "Apply"**
⏳ Wait 5-10 minutes for first deployment

### **Step 5: Verify Deployment**
When you see in logs:
```
✅ Redis connected successfully!
✅ Successfully connected to MongoDB Atlas!
🚀 Server is listening on port 10000
```
→ **SUCCESS!** Your app is live at: `https://mymap-app.onrender.com`

---

## 📋 Pre-Deployment Checklist

### Database
- [ ] MongoDB Atlas whitelist IP: `0.0.0.0/0`
- [ ] Test connection string works
- [ ] Database has data (or ready for fresh start)

### Environment Variables
- [ ] `MONGO_URI` - copied from Atlas
- [ ] `SESSION_SECRET` - random string generated
- [ ] `GEMINI_API_KEYS` - from Google AI Studio
- [ ] `OCRSPACE_API_KEY` - from OCR.space
- [ ] `HUGGINGFACE_TOKEN` - from Hugging Face
- [ ] `OPENROUTER_API_KEY` - from OpenRouter

### Code
- [ ] Latest code pushed to GitHub
- [ ] `render.yaml` exists in root
- [ ] `.gitignore` excludes large files
- [ ] React app builds successfully locally

---

## ⚠️ Important Notes

### 1. Video Files
Large videos (>10MB) are excluded from Git.

**For production:**
- Upload to Cloudinary (free 25GB)
- Use script: `node scripts/upload-videos.js`
- See: [VIDEO_PRODUCTION_NOTES.md](./VIDEO_PRODUCTION_NOTES.md)

### 2. Free Tier Limitations
- ⏰ Cold start after 15 min inactivity
- ⏳ Wake-up takes 30-60 seconds
- 💾 No persistent file storage
- 🌐 100GB bandwidth/month

### 3. First Deploy
- Takes 5-10 minutes
- May timeout - just wait and retry
- Check logs for any errors

---

## 🔧 Troubleshooting

### Build Failed
```
Error: Command failed with exit code 1
```
**Fix**: 
- Check Node version in `package.json` engines
- Ensure all dependencies in `package.json`
- Look at build logs for specific error

### Service Won't Start
```
Error: Cannot connect to MongoDB
```
**Fix**:
- Verify `MONGO_URI` is correct
- Check MongoDB Network Access whitelist
- Test connection locally first

### 502 Bad Gateway
**Cause**: Service is cold starting
**Fix**: Wait 30-60 seconds and refresh

---

## 📞 Need Help?

1. **Check Logs**: Render Dashboard → Service → Logs tab
2. **Documentation**: [DEPLOY_RENDER.md](./DEPLOY_RENDER.md)
3. **Render Docs**: https://render.com/docs
4. **Community**: https://community.render.com

---

## 🚀 After Successful Deploy

### Test These Features:
- [ ] Open app URL: `https://your-app.onrender.com`
- [ ] Login/Register works
- [ ] Upload document works
- [ ] Create mind map works
- [ ] Mind map displays horizontally ✅
- [ ] Chat feature works
- [ ] Session persists across refreshes

### Optional:
- [ ] Setup custom domain
- [ ] Configure monitoring
- [ ] Setup auto-backup for MongoDB
- [ ] Upgrade to paid plan if needed

---

**🎉 Ready to Deploy!**

Current Time: 2025-11-13
All code changes committed and pushed to GitHub.
Render deployment config is ready in `render.yaml`.

**Next Action**: Go to https://render.com and click "New Blueprint"
