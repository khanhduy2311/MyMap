const { ObjectId } = require('mongodb');

// Tìm user bằng email
exports.findUserByEmail = async (db, email) => {
    return await db.collection('users').findOne({ email: email });
};

// Tìm user bằng email hoặc username
exports.findUserByEmailOrUsername = async (db, email, username) => {
    return await db.collection('users').findOne({ $or: [{ email }, { username }] });
};

// Tạo user mới
exports.createUser = async (db, user) => {
    return await db.collection('users').insertOne(user);
};