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
const mindmapRoutes = require('./routes/mindmap'); // ✅ Đảm bảo import ở đây

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

    const db = client.db('users_identity');
    const app = express();
    const PORT = process.env.PORT || 3000;
    app.locals.db = db;

    // ... (Toàn bộ phần cấu hình middleware giữ nguyên)
    app.set('view engine', 'pug');
    app.set('views', 'views');
    app.use(express.static('public'));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(session({
      secret: 'my_session_secret',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: client,
        dbName: 'users_identity',
        collectionName: 'sessions',
        ttl: 30 * 24 * 60 * 60
      }),
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
    }));
    app.use(flash());
    app.use((req, res, next) => {
      req.db = db;
      res.locals.user = req.session.user;
      res.locals.success_msg = req.flash('success_msg');
      res.locals.error_msg = req.flash('error_msg');
      next();
    });
    // ... (Kết thúc phần middleware)


    // ====== Đăng ký Routes ======
    app.use('/dashboard', dashboardRoutes);
    app.use('/profile', profileRoutes);
    app.use('/upload', documentRoutes);
    
    // ✅ THÊM DÒNG NÀY ĐỂ KÍCH HOẠT API LƯU MINDMAP
    app.use('/mindmaps', mindmapRoutes); 
    
    app.use('/', authRoutes);

    // Xóa dòng require thừa ở đây
    // const mindmapRoutes = require('./routes/mindmap'); 

    // Xử lý lỗi 404 (đặt ở cuối cùng)
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