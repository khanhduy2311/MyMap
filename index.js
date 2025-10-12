const express = require('express');
const session = require('express-session');
const { MongoClient } = require('mongodb');
const authRoutes = require('./routes/authRoutes'); // Import file routes

const uri = "mongodb+srv://vietdungtsn_db_user:vietdung333222111@cluster0.ypxmvoz.mongodb.net/";
const client = new MongoClient(uri);

async function startServer() {
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB Atlas!");
        const db = client.db('users_identity');

        const app = express();
        
        // Thiết lập View Engine và Middleware
        app.set('view engine', 'ejs');
        app.use(express.urlencoded({ extended: false }));
        app.use(session({
            secret: 'my_session_secret',
            resave: false,
            saveUninitialized: false,
            cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
        }));

        // Middleware để truyền db và session.user vào mọi request
        app.use((req, res, next) => {
            req.db = db;
            res.locals.user = req.session.user;
            next();
        });

        // Sử dụng file routes
        app.use('/', authRoutes);

        // Khởi động server
        app.listen(3000, () => console.log('Server is listening on port 3000'));

    } catch (error) {
        console.error("Failed to connect to the database. Server is not started.", error);
        process.exit(1);
    }
}

startServer();