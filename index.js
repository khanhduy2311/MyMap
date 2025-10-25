// File: index.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const { MongoClient } = require('mongodb');
const MongoStore = require('connect-mongo');
const http = require('http');
const { Server } = require("socket.io");

// ====== Routes ======
const authRoutes = require('./routes/authRoutes.js');
const documentRoutes = require('./routes/document');
const dashboardRoutes = require('./routes/dashboardRoutes.js');
const profileRoutes = require('./routes/profileRoutes.js');
const mindmapRoutes = require('./routes/mindmap');
const friendRoutes = require('./routes/friendRoutes.js');

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("❌ Lỗi: MONGO_URI chưa được thiết lập trong file .env");
  process.exit(1);
}

const client = new MongoClient(uri);

async function startServer() {
  try {
    await client.connect();
    console.log("✅ Successfully connected to MongoDB Atlas!");

    // === KHỞI TẠO DATABASE ===
    const usersDb = client.db('users_identity');
    const mindmapsDb = client.db('mindmaps');
    const chatDb = client.db('chat_storage');

    const app = express();
    const PORT = process.env.PORT || 3000;
    const server = http.createServer(app);
    
    // === SỬA LẠI: Cấu hình Socket.IO với CORS ===
    const io = new Server(server, {
      cors: {
        origin: "*", // Hoặc "http://localhost:3000" cho production
        methods: ["GET", "POST"]
      }
    });

    // === LƯU DATABASE VÀO APP.LOCALS ===
    app.locals.usersDb = usersDb;
    app.locals.mindmapsDb = mindmapsDb;
    app.locals.chatDb = chatDb;

    // ... (Cấu hình middleware)
    app.set('view engine', 'pug');
    app.set('views', 'views');
    app.use(express.static('public'));
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    const sessionMiddleware = session({
      secret: process.env.SESSION_SECRET || 'my_session_secret', // Nên dùng biến môi trường
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: client,
        dbName: 'users_identity',
        collectionName: 'sessions',
        ttl: 30 * 24 * 60 * 60
      }),
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production', // HTTPS trong production
        httpOnly: true
      }
    });

    // === SỬ DỤNG SESSION CHO EXPRESS ===
    app.use(sessionMiddleware);

    // === CHIA SẺ SESSION CHO SOCKET.IO - SỬA LẠI ===
    io.engine.use(sessionMiddleware);

    app.use(flash());

    // === MIDDLEWARE TRUYỀN DATABASE ===
    app.use((req, res, next) => {
      req.usersDb = req.app.locals.usersDb;
      req.mindmapsDb = req.app.locals.mindmapsDb;
      req.chatDb = req.app.locals.chatDb;
      res.locals.user = req.session.user;
      res.locals.success_msg = req.flash('success_msg');
      res.locals.error_msg = req.flash('error_msg');
      next();
    });

    // === KHỞI TẠO SOCKET HANDLER - THÊM usersDb ===
    require('./socketHandler.js')(io, usersDb, chatDb); 

    // ====== ĐĂNG KÝ ROUTES ======
    app.use('/friends', friendRoutes(usersDb));
    app.use('/dashboard', dashboardRoutes);
    app.use('/profile', profileRoutes);
    app.use('/upload', documentRoutes);
    app.use('/mindmaps', mindmapRoutes);
    app.use('/', authRoutes);

    // === ROUTE CHÍNH ===
    app.get('/', (req, res) => {
      if (req.session.user) {
        res.redirect('/dashboard');
      } else {
        res.redirect('/login');
      }
    });

    // Xử lý lỗi 404
    app.use((req, res) => {
      res.status(404).render('404', {
        pageTitle: 'Lỗi 404',
        user: req.session.user
      });
    });

    // Xử lý lỗi 500
    app.use((error, req, res, next) => {
      console.error('Server Error:', error);
      res.status(500).render('500', {
        pageTitle: 'Lỗi Server',
        user: req.session.user
      });
    });

    server.listen(PORT, () => {
      console.log(`🚀 Server is listening on port ${PORT}`);
      console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error("❌ Failed to connect to the database.", error);
    process.exit(1);
  }
}

startServer();