// File: index.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const { MongoClient } = require('mongodb');
const MongoStore = require('connect-mongo');

// ====== Routes ======
const authRoutes = require('./routes/authRoutes.js');
const documentRoutes = require('./routes/document');
const dashboardRoutes = require('./routes/dashboardRoutes.js');
const profileRoutes = require('./routes/profileRoutes.js');
const mindmapRoutes = require('./routes/mindmap');

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

    // === THAY ĐỔI: Khởi tạo 2 database ===
    const usersDb = client.db('users_identity'); // DB cho user, session
    const mindmapsDb = client.db('mindmaps'); // DB mới "ngang hàng"
    // =====================================

    const app = express();
    const PORT = process.env.PORT || 3000;
    
    // === THAY ĐỔI: Lưu 2 database vào app.locals ===
    app.locals.usersDb = usersDb;
    app.locals.mindmapsDb = mindmapsDb;
    // ==========================================

    // ... (Cấu hình middleware)
    app.set('view engine', 'pug');
    app.set('views', 'views');
    app.use(express.static('public'));
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    app.use(session({
      secret: 'my_session_secret',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: client,
        dbName: 'users_identity', // Session vẫn lưu ở db user
        collectionName: 'sessions',
        ttl: 30 * 24 * 60 * 60
      }),
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
    }));
    app.use(flash());
    
    // === THAY ĐỔI: Truyền 2 database qua request ===
    app.use((req, res, next) => {
      req.usersDb = req.app.locals.usersDb;     // DB cho user
      req.mindmapsDb = req.app.locals.mindmapsDb; // DB cho mindmap
      res.locals.user = req.session.user;
      res.locals.success_msg = req.flash('success_msg');
      res.locals.error_msg = req.flash('error_msg');
      next();
    });
    // ============================================

    // ====== Đăng ký Routes (Giữ nguyên) ======
    app.use('/dashboard', dashboardRoutes);
    app.use('/profile', profileRoutes);
    app.use('/upload', documentRoutes);
    app.use('/mindmaps', mindmapRoutes); 
    app.use('/', authRoutes);

    // Xử lý lỗi 404 (Giữ nguyên)
    app.use((req, res) => {
      res.status(404).render('404', { pageTitle: 'Lỗi 404' });
    });

    app.listen(PORT, () => console.log(`🚀 Server is listening on port ${PORT}`));

  } catch (error) {
    console.error("❌ Failed to connect to the database.", error);
    process.exit(1);
  }
}

startServer();