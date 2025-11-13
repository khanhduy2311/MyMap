# MyMap - AI Coding Agent Instructions

## Project Overview
MyMap is a collaborative mind mapping application with document processing and real-time chat. The architecture splits between:
- **Backend**: Node.js/Express server with MongoDB (port 3000)
- **Frontend**: Mixed Pug templates (main app) + React app (mind map editor at `/import/:id`)

## Architecture & Data Flow

### Database Organization (MongoDB Atlas)
The app uses **3 separate databases** (not collections):
1. `users_identity` - user accounts, sessions, friends, folders
2. `mindmaps` - **per-user collections** where each user gets a collection named by their `_id`
3. `chat_storage` - chat messages

**Critical Pattern**: When a user registers, create their mindmap collection:
```javascript
await mindmapsDb.createCollection(newUserId.toString());
```

### Session & Request Flow
- Session middleware is shared between Express and Socket.IO via `io.engine.use(sessionMiddleware)`
- Database references stored in `app.locals` and propagated to `req` in middleware:
  ```javascript
  req.usersDb = req.app.locals.usersDb;
  req.mindmapsDb = req.app.locals.mindmapsDb;
  ```
- Authentication: `middlewares/middlewares.js` exports `checkLoggedIn` and `bypassLogin`

### Routing Priority (index.js lines 120-170)
Order matters to prevent React app from capturing Pug routes:
1. API/Pug routes (`/friends`, `/dashboard`, `/profile`, `/upload`, `/mindmaps`, auth routes)
2. Root redirect (`/` → `/dashboard` or `/login`)
3. React app route (`/import/:id` → serves `build/index.html`)
4. React static files (`build/` directory)
5. 404 handler

## Key Components

### Document Processing Pipeline (`routes/document.js`)
Multi-vendor AI fallback system for OCR and summarization:
1. **File Upload**: Multer with memory storage (50MB limit)
2. **Text Extraction**:
   - PDF: `pdf-parse` library
   - DOCX: `mammoth` library  
   - Images: OCR.Space API (`ocrSpaceParseBuffer`)
3. **AI Processing** (cascading fallback):
   - **OpenRouter** free models (primary): `generateWithOpenRouter()`
   - **Hugging Face** inference API: `generateWithHuggingFace()`
   - **Gemini API** with key rotation: `keyManager.next()`
4. **Job System**: SSE (Server-Sent Events) for progress updates
   - Jobs stored in-memory `Map` (⚠️ not production-ready, use Redis)
   - Client connects to `/upload/stream-progress/:jobId` for updates

### Mind Map Editor (React App)
Located in `MindMapBoDoi/project-d10/`:
- **State**: Zustand store (`src/store/store.js`) with temporal undo/redo (zundo)
- **Libraries**: 
  - `@xyflow/react` for node-based UI
  - `cytoscape` for alternative layout
  - `dagre` for auto-layout algorithms
- **Auto-save**: Debounced PATCH to `/mindmaps/:id/save` (nodes, edges, thumbnail)
- **Data Structure**: 
  ```javascript
  { nodes: [], edges: [], content: "markdown" }
  ```
- **Build**: Run `npm run build` in `project-d10/` before serving

### Real-Time Chat (Socket.IO)
- Handler: `socketHandler.js`
- Session authentication: `socket.request.session.user._id`
- Online status tracking: `onlineUsers Map` (userId → socketId)
- Friend status broadcasts: Only notifies users in friend list

### Soft Delete Pattern
Mindmaps use soft deletion:
```javascript
{ deleted: false, deletedAt: null }  // Active
{ deleted: true, deletedAt: Date }    // Trashed
```
Always filter: `{ deleted: { $ne: true } }` when querying active mindmaps

## Development Workflows

### Environment Setup
Required `.env` variables:
```
MONGO_URI=mongodb+srv://...
SESSION_SECRET=your_secret
PORT=3000
GEMINI_API_KEYS=key1,key2,key3  # Comma-separated for rotation
OCRSPACE_API_KEY=...
HUGGINGFACE_TOKEN=...
OPENROUTER_API_KEY=...
```

### Running the App
```powershell
# Backend (from root)
npm run dev  # nodemon with --inspect flag

# React app development (from MindMapBoDoi/project-d10/)
npm start    # Proxies to localhost:3000

# Production build
cd MindMapBoDoi\project-d10; npm run build; cd ..\..
npm start
```

### Key Commands
- Debugging: Backend runs with `--inspect` in dev mode
- Logs: Extensive console logging with emojis (🚀, ✅, ❌, ⚠️)

## Project-Specific Conventions

### File Organization
- **Controllers**: Business logic, interact with DB
- **Routes**: Define endpoints, call controllers
- **Middlewares**: Auth, file uploads, request preprocessing
- **Models**: Mongoose schemas (note: app uses native MongoDB driver, schemas are reference only)
- **Views**: Pug templates extending `layouts/default.pug` or `layouts/defaultHome.pug`

### Naming Patterns
- Collections: Lowercase (e.g., `users`, `sessions`, `messages`)
- User mindmap collections: User's `_id.toString()` as collection name
- API endpoints: RESTful (e.g., `PATCH /mindmaps/:id`, `DELETE /mindmaps/:id`)

### Error Handling
- Flash messages: `req.flash('error_msg', 'message')` for Pug pages
- API errors: JSON responses with `{ error: 'message' }` or `{ success: false }`
- Avoid sending responses after headers sent: Check `!res.headersSent`

### Code Style
- Comments in Vietnamese for user-facing messages
- English for technical logs/comments
- Async/await preferred over promises
- MongoDB native driver (not Mongoose for operations, despite models/)

## Integration Points

### External APIs
1. **OCR.Space**: Image → text extraction (OCRSPACE_API_KEY)
2. **Google Gemini**: AI summarization with key rotation
3. **Hugging Face Inference**: Fallback LLM (models: Mistral-7B, Zephyr-7B)
4. **OpenRouter**: Free tier LLM aggregator (Claude, Gemini, Llama)
5. **Cloudinary**: Avatar/file storage (via multer-storage-cloudinary)

### Cross-Component Communication
- **Pug → API**: `fetch()` calls with session cookies
- **React → Backend**: Axios with proxy (dev) or same-origin (prod)
- **Socket.IO**: Friend status updates, chat messages
- **SSE**: Document processing progress (`/upload/stream-progress/:jobId`)

## Common Pitfalls
1. **Route ordering**: React catch-all must come AFTER Pug routes
2. **Collection naming**: User mindmaps in `mindmapsDb.collection(userId.toString())`
3. **Soft deletes**: Always filter `{ deleted: { $ne: true } }`
4. **Session access**: Available in both Express (`req.session`) and Socket.IO (`socket.request.session`)
5. **AI fallback**: Don't fail on first API error, cascade through vendors
6. **React build**: Must rebuild after changes to serve on `/import/:id`

## Testing Patterns
No formal test suite. Manual testing with:
- `test-gemini.js` for Gemini API connectivity
- Console logs for tracing request flow
- Browser DevTools for React component debugging
