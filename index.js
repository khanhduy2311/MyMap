// File: index.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const {
    MongoClient
} = require('mongodb');
const flash = require('connect-flash');
// Nạp file routes chính của bạn
const mainRoutes = require('./routes/authRoutes.js');

const uri = process.env.MONGO_URI;
if (!uri) {
    console.error("Lỗi: MONGO_URI chưa được thiết lập trong file .env");
    process.exit(1);
}

const client = new MongoClient(uri);

async function startServer() {
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB Atlas!");
        const db = client.db('users_identity'); // Tên database của bạn

        const app = express();

        app.set('view engine', 'pug');
        app.set('views', 'views'); // Chỉ định thư mục views
        app.use(express.static('public'));
        app.use(express.urlencoded({
            extended: false
        }));

        // 1. Khởi tạo session TRƯỚC
        app.use(session({
            secret: 'my_session_secret',
            resave: false,
            saveUninitialized: false,
            cookie: {
                maxAge: 30 * 24 * 60 * 60 * 1000
            }
        }));

        // 2. Middleware flash cũng cần session nên đặt ngay sau session
        app.use(flash());

        // 3. SAU ĐÓ mới đến middleware tùy chỉnh của bạn để sử dụng session và flash
        app.use((req, res, next) => {
            req.db = db;
            res.locals.user = req.session.user;
            res.locals.success_msg = req.flash('success_msg');
            res.locals.error_msg = req.flash('error_msg');
            next();
        });
        // Sử dụng file routes chính cho tất cả các request
        app.use('/', mainRoutes);

        app.listen(3000, () => console.log('Server is listening on port 3000'));

    } catch (error) {
        console.error("Failed to connect to the database. Server is not started.", error);
        process.exit(1);
    }
}

startServer();