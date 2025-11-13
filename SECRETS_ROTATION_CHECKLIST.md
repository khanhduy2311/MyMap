# Secrets Rotation Checklist

Use this checklist whenever secrets might be exposed or after onboarding to production. Update values in Render (or your hosting provider) and your local `.env`.

## High Priority (rotate now)
- [ ] MongoDB Atlas
  - [ ] Create a new database user password (or new user)
  - [ ] Update `MONGO_URI` everywhere
- [ ] Session Secret
  - [ ] Generate a new strong `SESSION_SECRET` (32+ chars)
- [ ] Email (Nodemailer)
  - [ ] Create a new app password (`EMAIL_PASS`)

## AI & External APIs
- [ ] Cloudinary
  - [ ] Regenerate `CLOUDINARY_API_SECRET` (rotate API key if needed)
- [ ] Google Gemini
  - [ ] Revoke exposed keys; create new ones; update `GEMINI_API_KEYS`
- [ ] Hugging Face
  - [ ] Revoke `HUGGINGFACE_TOKEN`; create new one
- [ ] OpenRouter
  - [ ] Revoke `OPENROUTER_API_KEY`; create new key
- [ ] OCR.Space
  - [ ] Regenerate `OCRSPACE_API_KEY`

## Redis
- [ ] Production uses `REDIS_URL`
  - [ ] Rotate credentials or create a new instance
  - [ ] Remove legacy `REDIS_HOST`/`REDIS_PASSWORD` from production configs

## Post-rotation steps
- [ ] Update Render service environment variables
- [ ] Trigger a new deploy (clear build cache)
- [ ] Verify app health: login, upload, AI processing, mind map rendering
- [ ] Remove old secrets from local machines and password managers
