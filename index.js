// File: index.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const { MongoClient } = require('mongodb');
const MongoStore = require('connect-mongo');
// Routes
const mainRoutes = require('./routes/authRoutes.js');
const documentRoutes = require('./routes/document'); 

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

    const db = client.db('users_identity'); // Tên database của bạn

    const app = express();
    const PORT = process.env.PORT || 3000;
    app.locals.db = db;

    // ====== Cấu hình view engine ======
    app.set('view engine', 'pug');
    app.set('views', 'views');
    app.use(express.static('public'));
    app.use(express.urlencoded({ extended: false }));

    // ====== Session ======
    app.use(session({
      secret: 'my_session_secret',
      resave: false,
      saveUninitialized: false, // Sửa thành false
      store: MongoStore.create({ // <-- THÊM KHỐI NÀY
        client: client,
        dbName: 'users_identity',
        collectionName: 'sessions',
        ttl: 30 * 24 * 60 * 60 // 30 ngày (tính bằng giây)
      }),
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 ngày (tính bằng mili giây)
    }));

    // ====== Flash message ======
    app.use(flash());

    // ====== Middleware gắn session, flash, db ======
    app.use((req, res, next) => {
      req.db = db;
      res.locals.user = req.session.user;
      res.locals.success_msg = req.flash('success_msg');
      res.locals.error_msg = req.flash('error_msg');
      next();
    });

    // ====== Routes ======
    app.use('/', mainRoutes);               // Routes chính (login, register, home, v.v.)
    app.use('/upload', documentRoutes);     // Routes upload tài liệu (PDF/DOCX)

    // ====== 404 fallback ======
    app.use((req, res) => {
      res.status(404).send('404 - Không tìm thấy trang');
    });

    // ====== Khởi động server ======
    app.listen(PORT, () => console.log(`🚀 Server is listening on port ${PORT}`));

  } catch (error) {
    console.error("❌ Failed to connect to the database. Server is not started.", error);
    process.exit(1);
  }
}

startServer();
