<div align="center">

# 🌳 MindTree

### AI-Powered Collaborative Mind Mapping Platform

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://www.mongodb.com/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

**Transform documents into interactive mind maps with AI-powered intelligence**

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-project-structure) • [Demo](#-demo)

</div>

---

## 📖 Overview

MindTree is a modern web application that revolutionizes knowledge organization by automatically converting documents into interactive mind maps using advanced AI processing. Built with Node.js, Express, MongoDB, and React Flow, it offers real-time collaboration, intelligent document processing, and an intuitive visual interface.

### 🎯 Key Highlights

- **🤖 AI Document Processing**: Upload PDF, DOCX, or images and automatically generate structured mind maps using multi-vendor AI (Google Gemini, OpenRouter, Hugging Face)
- **🎨 Interactive Editor**: Drag-and-drop node-based interface with React Flow, featuring auto-layout, undo/redo, and real-time canvas updates
- **💬 Real-Time Chat**: Built-in Socket.IO chat system with friend management and online status tracking
- **📁 Smart Organization**: Folder-based project management with soft delete and trash recovery
- **🔐 Enterprise-Ready**: Session management, rate limiting, input validation, and structured logging with Winston

---

## ✨ Features

### 📄 Intelligent Document Processing
- **Multi-format Support**: PDF, DOCX, and image files (JPG, PNG)
- **OCR Integration**: Extract text from images using OCR.Space API
- **AI Summarization**: Multi-vendor fallback system (OpenRouter → Hugging Face → Gemini)
- **Progress Tracking**: Real-time SSE (Server-Sent Events) for job status updates
- **Smart Conversion**: Automatically structures content into hierarchical mind maps

### 🎨 Mind Map Editor
- **React Flow Integration**: Professional node-based canvas with smooth interactions
- **Auto-Layout**: Dagre algorithm with horizontal (LR) layout direction
- **Rich Editing**: Node styling, custom colors, edge connections
- **Undo/Redo**: Temporal state management with Zustand + Zundo
- **Auto-Save**: Debounced saves (1.5s) with manual save option
- **Thumbnail Generation**: HTML-to-image conversion for visual previews
- **Gradient Fallbacks**: 20 beautiful gradient themes for cards without thumbnails

### 👥 Collaboration & Chat
- **Friend System**: Send/accept friend requests, manage connections
- **Real-Time Chat**: Socket.IO powered messaging with online status indicators
- **Session Sharing**: Persistent sessions across HTTP and WebSocket connections

### 📂 Organization
- **Folder Management**: Create custom folders to organize mind maps
- **Soft Delete**: Trash system with restore capabilities
- **Search & Filter**: Quick access to projects and documents
- **Responsive Design**: Mobile-friendly interface with glass morphism UI

---

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:

- **Node.js** >= 18.x (LTS recommended)
- **MongoDB Atlas** account (or local MongoDB instance)
- **Redis Server** (local or cloud instance)
- **npm** or **yarn** package manager

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/khanhduy2311/MyMap.git
cd MyMap
```

**2. Install dependencies**

```bash
# Backend dependencies
npm install

# React app dependencies
cd MindMapBoDoi/project-d10
npm install
cd ../..
```

**3. Environment configuration**

Create `.env` file from template:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
# MongoDB Connection
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/mymap

# Session Security (CRITICAL: Change in production!)
SESSION_SECRET=your_secure_random_secret_min_32_characters_long

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# AI API Keys (comma-separated for rotation)
GEMINI_API_KEYS=key1,key2,key3
OCRSPACE_API_KEY=your_ocr_space_key
HUGGINGFACE_TOKEN=your_huggingface_token
OPENROUTER_API_KEY=your_openrouter_key

# Cloudinary (Optional - for avatar uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Service (Optional - for password reset)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

**4. Setup Redis**

<details>
<summary><b>Windows</b> (using WSL)</summary>

```powershell
wsl --install
wsl
sudo apt-get update
sudo apt-get install redis-server
redis-server
```
</details>

<details>
<summary><b>macOS</b> (using Homebrew)</summary>

```bash
brew install redis
brew services start redis
```
</details>

<details>
<summary><b>Linux</b> (Ubuntu/Debian)</summary>

```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```
</details>

<details>
<summary><b>Redis Cloud</b> (Free Tier)</summary>

1. Sign up at [Redis Cloud](https://redis.com/try-free/)
2. Create a database instance
3. Copy connection details to `.env`:
   ```env
   REDIS_URL=redis://username:password@host:port
   ```
</details>

**5. Build React application**

```bash
cd MindMapBoDoi/project-d10
npm run build
cd ../..
```

**6. Start the server**

```bash
# Development mode (with hot-reload)
npm run dev

# Production mode
npm start
```

🎉 **Application running at** `http://localhost:3000`

---

## 📁 Project Structure

```
MyMap/
├── 📂 controllers/              # Business logic & request handlers
│   ├── authController.js        # Authentication (login, register, password reset)
│   ├── documentController.js    # Document upload & AI processing
│   ├── mindmapController.js     # CRUD operations for mind maps
│   └── profileController.js     # User profile management
│
├── 📂 routes/                   # API endpoint definitions
│   ├── authRoutes.js           # /login, /register, /forgot-password
│   ├── document.js             # /upload, /stream-progress
│   ├── mindmap.js              # /mindmaps/:id (CRUD, save, JSON export)
│   ├── friendRoutes.js         # Friend system & chat
│   └── dashboardRoutes.js      # Dashboard views
│
├── 📂 middlewares/              # Request preprocessing
│   ├── middlewares.js          # checkLoggedIn, bypassLogin
│   ├── validation.js           # Input validation with express-validator
│   ├── rateLimiter.js          # Rate limiting for sensitive endpoints
│   └── uploadMiddleware.js     # Multer file upload configuration
│
├── 📂 models/                   # MongoDB schema definitions (reference only)
│   ├── userModel.js            # User schema
│   └── mindmap.model.js        # Mind map schema
│
├── 📂 utils/                    # Helper utilities
│   ├── logger.js               # Winston structured logging
│   ├── redisClient.js          # Redis connection manager
│   └── sendEmail.js            # Email service integration
│
├── 📂 views/                    # Pug templates (server-rendered)
│   ├── layouts/
│   │   ├── default.pug         # Main layout template
│   │   └── defaultHome.pug     # Home page layout
│   ├── dashboard.pug           # Mind map dashboard
│   ├── login.pug               # Authentication pages
│   └── ...
│
├── 📂 public/                   # Static assets
│   ├── css/                    # Stylesheets
│   ├── js/                     # Client-side scripts
│   └── uploads/                # User-uploaded files
│
├── 📂 MindMapBoDoi/
│   └── 📂 project-d10/         # React mind map editor
│       ├── src/
│       │   ├── App.jsx         # Main React component
│       │   ├── store/          # Zustand state management
│       │   ├── components/     # CustomNode, Toolbar, etc.
│       │   └── utils/          # Layout algorithms, converters
│       └── build/              # Production build (served by Express)
│
├── 📂 logs/                     # Application logs
│   ├── error.log               # Error-level logs only
│   └── combined.log            # All logs
│
├── 📂 .github/
│   └── copilot-instructions.md # AI coding agent guidelines
│
├── index.js                     # Express app entry point
├── socketHandler.js             # Socket.IO real-time logic
├── package.json                 # Dependencies & scripts
└── README.md                    # This file
```

### Architecture Overview

**Frontend Stack:**
- **Pug Templates**: Server-rendered pages (dashboard, login, profile)
- **React App**: Mind map editor at `/editor/:id` (built to `MindMapBoDoi/project-d10/build/`)
- **Socket.IO Client**: Real-time chat and friend status updates

**Backend Stack:**
- **Express.js**: RESTful API + template rendering
- **MongoDB Native Driver**: Database operations (note: models are reference schemas)
- **Socket.IO**: WebSocket connections for chat
- **Redis**: Job queue and session storage

**Data Flow:**
1. User uploads document → Multer stores in memory
2. Text extraction (pdf-parse, mammoth, OCR.Space)
3. AI processing with fallback chain (OpenRouter → HF → Gemini)
4. Markdown → Mind map conversion
5. Store in user-specific MongoDB collection (`mindmapsDb.collection(userId)`)
6. Render React app at `/editor/:id` for editing

---

## 🔐 Security & Best Practices

### ✅ Implemented Security Features

- **Input Validation**: Express-validator for all user inputs
- **Rate Limiting**: Protection against brute-force attacks on login/register/upload
- **Session Management**: Secure session handling with Redis store
- **CORS Configuration**: Controlled cross-origin resource sharing
- **File Upload Limits**: Restricted file sizes (50MB) and types
- **Session Secret Validation**: Enforced strong secrets in production
- **Structured Logging**: Winston logger with rotation and error tracking
- **Soft Delete Pattern**: Safe deletion with recovery options

### 🔧 Production Recommendations

- [ ] **HTTPS**: Enable SSL/TLS certificates (Let's Encrypt recommended)
- [ ] **Password Hashing**: Implement bcrypt for user passwords
- [ ] **Database Indexes**: Add indexes on frequently queried fields
- [ ] **Environment Isolation**: Separate dev/staging/production databases
- [ ] **Secrets Management**: Use AWS Secrets Manager or HashiCorp Vault
- [ ] **Docker Containerization**: Consistent deployment across environments
- [ ] **Unit & Integration Tests**: Jest/Mocha test coverage
- [ ] **CI/CD Pipeline**: Automated testing and deployment

### 🔑 Secret Rotation Guide

If API keys are exposed (commits, screenshots, logs):

1. **MongoDB**: Change user password in Atlas dashboard → Update `MONGO_URI`
2. **Cloudinary**: Regenerate `CLOUDINARY_API_SECRET` in settings
3. **AI APIs**: Revoke and create new tokens:
   - Gemini: [Google AI Studio](https://makersuite.google.com/app/apikey)
   - OpenRouter: [OpenRouter Dashboard](https://openrouter.ai/keys)
   - Hugging Face: [HF Tokens](https://huggingface.co/settings/tokens)
   - OCR.Space: [OCR.Space API](https://ocr.space/ocrapi)
4. **Redis**: Rotate credentials or create new instance → Update `REDIS_URL`
5. **Session Secret**: Generate new 32+ character random string
6. **Email**: Regenerate app password in Gmail settings

---

## 📊 Monitoring & Logging

### Log Files

Logs are stored in the `logs/` directory:

- **`error.log`**: Error-level events only (critical issues)
- **`combined.log`**: All log levels (info, warn, error, debug)

### Real-Time Log Monitoring

```bash
# Tail combined logs
tail -f logs/combined.log

# Filter errors only
tail -f logs/error.log

# Watch with grep
tail -f logs/combined.log | grep ERROR
```

### Log Levels

- **`error`**: Application errors, uncaught exceptions
- **`warn`**: Deprecated features, potential issues
- **`info`**: General operational messages (default)
- **`debug`**: Detailed information for debugging

Configure log level in `.env`:
```env
LOG_LEVEL=info  # Options: error, warn, info, debug
```

---

## 🐛 Development & Debugging

### Development Mode

```bash
# Start with hot-reload and debugging
npm run dev
```

Features enabled:
- **Nodemon**: Auto-restart on file changes
- **Node Inspector**: Debugging on `--inspect` flag
- **Verbose Logging**: Debug-level logs enabled

### Chrome DevTools Debugging

1. Start in dev mode: `npm run dev`
2. Open Chrome and navigate to `chrome://inspect`
3. Click "Open dedicated DevTools for Node"
4. Set breakpoints and inspect variables

### Testing AI Integration

```bash
# Test Gemini API connectivity
node test-gemini.js
```

### Common Issues & Solutions

<details>
<summary><b>Issue: Redis connection failed</b></summary>

**Symptoms**: `Error: Redis connection failed` in logs

**Solutions**:
- Ensure Redis server is running: `redis-cli ping` (should return `PONG`)
- Check `.env` for correct `REDIS_HOST` and `REDIS_PORT`
- For Redis Cloud, verify `REDIS_URL` format: `redis://username:password@host:port`
</details>

<details>
<summary><b>Issue: MongoDB connection timeout</b></summary>

**Symptoms**: `MongoNetworkError: connection timed out`

**Solutions**:
- Whitelist your IP in MongoDB Atlas Network Access
- Verify `MONGO_URI` format and credentials
- Check firewall settings blocking port 27017
</details>

<details>
<summary><b>Issue: React build fails with "localStorage not defined"</b></summary>

**Symptoms**: Error during `npm run build` in React app

**Solutions**:
- Lock Node.js to v18 LTS in `package.json`:
  ```json
  "engines": {
    "node": "18.x"
  }
  ```
- Avoid Node.js v25+ which breaks SSR builds
</details>

<details>
<summary><b>Issue: Mind map changes not saving</b></summary>

**Symptoms**: Console shows "⏭️ Skip save: isLoaded: undefined"

**Solutions**:
- Ensure React app is rebuilt: `cd MindMapBoDoi/project-d10 && npm run build`
- Check browser console for store initialization errors
- Verify `currentMindmapId` is set in Zustand store
</details>

---

## 🧪 Testing

### Manual Testing

Currently, the project relies on manual testing. Key test scenarios:

1. **Authentication Flow**
   - Register new user
   - Login with credentials
   - Password reset via email
   - Session persistence

2. **Document Processing**
   - Upload PDF and verify mind map generation
   - Upload DOCX and check conversion
   - Upload image and test OCR extraction
   - Monitor SSE progress updates

3. **Mind Map Editor**
   - Create nodes and edges
   - Test auto-save (wait 1.5s after edit)
   - Manual save and redirect to dashboard
   - Undo/redo functionality
   - Layout changes (horizontal orientation)

4. **Chat System**
   - Send friend requests
   - Accept/reject requests
   - Real-time message delivery
   - Online status updates

### Future: Automated Testing

Planned test implementation:

```bash
# Install test dependencies (not yet configured)
npm install --save-dev jest supertest @testing-library/react

# Run tests
npm test
```

---

## 📝 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| **Database** |
| `MONGO_URI` | ✅ | - | MongoDB connection string (Atlas or local) |
| **Redis** |
| `REDIS_HOST` | ✅ | `localhost` | Redis server hostname |
| `REDIS_PORT` | ❌ | `6379` | Redis server port |
| `REDIS_PASSWORD` | ❌ | - | Redis authentication password |
| `REDIS_URL` | ❌ | - | Full Redis connection URL (overrides HOST/PORT) |
| **Session** |
| `SESSION_SECRET` | ✅ (prod) | random | Session encryption key (32+ chars) |
| **Server** |
| `PORT` | ❌ | `3000` | Express server port |
| `NODE_ENV` | ❌ | `development` | Environment mode (`development` or `production`) |
| **AI Services** |
| `GEMINI_API_KEYS` | ❌ | - | Comma-separated Google Gemini keys |
| `OPENROUTER_API_KEY` | ❌ | - | OpenRouter API key |
| `HUGGINGFACE_TOKEN` | ❌ | - | Hugging Face inference token |
| `OCRSPACE_API_KEY` | ❌ | - | OCR.Space API key |
| **Cloudinary** |
| `CLOUDINARY_CLOUD_NAME` | ❌ | - | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ❌ | - | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ❌ | - | Cloudinary API secret |
| **Email** |
| `EMAIL_HOST` | ❌ | - | SMTP server hostname |
| `EMAIL_PORT` | ❌ | `587` | SMTP server port |
| `EMAIL_USER` | ❌ | - | Email account username |
| `EMAIL_PASS` | ❌ | - | Email account password (app password) |
| **Logging** |
| `LOG_LEVEL` | ❌ | `info` | Winston log level (`error`, `warn`, `info`, `debug`) |

---

## 🚢 Deployment

### Deploying to Render.com

**1. Prepare for deployment**

```bash
# Ensure React app is built
cd MindMapBoDoi/project-d10
npm run build
cd ../..

# Commit build files
git add MindMapBoDoi/project-d10/build/
git commit -m "Add production build"
git push origin main
```

**2. Create Render service**

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure build settings:
   - **Build Command**: `npm install && cd MindMapBoDoi/project-d10 && npm install && npm run build && cd ../..`
   - **Start Command**: `npm start`
   - **Environment**: `Node`

**3. Set environment variables**

Add all required variables from `.env` in Render's Environment section.

**4. Configure Node.js version**

In `package.json`, lock Node to LTS:
```json
"engines": {
  "node": "18.x"
}
```

**5. Deploy**

Render will automatically deploy on push to main branch.

### Deploying to Heroku

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login to Heroku
heroku login

# Create app
heroku create mymap-app

# Add MongoDB & Redis add-ons
heroku addons:create mongolab:sandbox
heroku addons:create heroku-redis:hobby-dev

# Set environment variables
heroku config:set SESSION_SECRET=your_secret
heroku config:set GEMINI_API_KEYS=your_keys
# ... (set all other env vars)

# Deploy
git push heroku main

# Open app
heroku open
```

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Development Workflow

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/your-username/MyMap.git
   cd MyMap
   ```

3. **Create** a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```

4. **Make** your changes and test thoroughly

5. **Commit** with descriptive messages:
   ```bash
   git commit -m "feat: Add amazing feature"
   ```

6. **Push** to your fork:
   ```bash
   git push origin feature/amazing-feature
   ```

7. **Open** a Pull Request with:
   - Clear description of changes
   - Screenshots (if UI changes)
   - Test results

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation updates
- `style:` Code style changes (formatting, no logic change)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

### Code Style

- **JavaScript**: Follow Airbnb style guide
- **Indentation**: 2 spaces
- **Comments**: English for technical, Vietnamese for user-facing messages
- **Async/await**: Preferred over promise chains

---

## 📄 License

This project is licensed under the **ISC License**.

```
Copyright (c) 2025 MindTree Team

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.
```

---

## 👥 Team

### Core Developers

- **Nguyễn Trung Dũng** - Backend Architecture & AI Integration
- **Trương Đình Việt Dũng** - Frontend Development & UI/UX
- **Trần Đình Duy** - Database Design & Real-Time Features

### Contact

- **GitHub**: [@khanhduy2311](https://github.com/khanhduy2311)
- **Issues**: [Report a bug](https://github.com/khanhduy2311/MyMap/issues)
- **Discussions**: [Join the conversation](https://github.com/khanhduy2311/MyMap/discussions)

---

## 🙏 Acknowledgments

### Technologies & Libraries

- **[@xyflow/react](https://reactflow.dev/)** - Powerful node-based UI framework
- **[Zustand](https://github.com/pmndrs/zustand)** - Lightweight state management
- **[Dagre](https://github.com/dagrejs/dagre)** - Graph layout algorithms
- **[Socket.IO](https://socket.io/)** - Real-time bidirectional communication
- **[Winston](https://github.com/winstonjs/winston)** - Versatile logging library
- **[Express.js](https://expressjs.com/)** - Fast, unopinionated web framework

### AI Services

- **[Google Gemini](https://ai.google.dev/)** - Advanced language models
- **[OpenRouter](https://openrouter.ai/)** - Multi-model AI API aggregator
- **[Hugging Face](https://huggingface.co/)** - Open-source AI model hub
- **[OCR.Space](https://ocr.space/)** - Optical character recognition API

### Inspiration

Special thanks to the open-source community for continuous innovation in web technologies and AI-powered applications.

---

<div align="center">

**⭐ Star this repo if you find it useful!**

Made with ❤️ by the MindTree Team

[Back to Top](#-mindtree)

</div>
