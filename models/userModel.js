const { ObjectId } = require('mongodb');

// Tìm user bằng email
exports.findUserByEmail = async (db, email) => {
    try {
        return await db.collection('users').findOne({ email: email.toLowerCase() });
    } catch (error) {
        console.error('❌ Lỗi findUserByEmail:', error);
        throw error;
    }
};

// Tìm user bằng email hoặc username
exports.findUserByEmailOrUsername = async (db, email, username) => {
    try {
        return await db.collection('users').findOne({ 
            $or: [
                { email: email.toLowerCase() }, 
                { username: username.toLowerCase() }
            ] 
        });
    } catch (error) {
        console.error('❌ Lỗi findUserByEmailOrUsername:', error);
        throw error;
    }
};

// Tạo user mới
exports.createUser = async (db, user) => {
    try {
        // Chuẩn hóa email và username
        user.email = user.email.toLowerCase();
        user.username = user.username.toLowerCase();
        user.createdAt = new Date();
        user.updatedAt = new Date();
        
        return await db.collection('users').insertOne(user);
    } catch (error) {
        console.error('❌ Lỗi createUser:', error);
        throw error;
    }
};

// Cập nhật avatar cho user
exports.updateUserAvatar = async (db, userId, avatarUrl) => {
    try {
        // Kiểm tra userId hợp lệ
        if (!ObjectId.isValid(userId)) {
            throw new Error('ID người dùng không hợp lệ');
        }

        const userObjectId = new ObjectId(userId);
        
        const result = await db.collection('users').updateOne(
            { _id: userObjectId },
            { 
                $set: { 
                    avatar: avatarUrl,
                    updatedAt: new Date()
                } 
            }
        );

        return result;
    } catch (error) {
        console.error('❌ Lỗi updateUserAvatar:', error);
        throw error;
    }
};

// Lấy thông tin user bằng ID - THÊM HÀM NÀY
exports.findUserById = async (db, userId) => {
    try {
        if (!ObjectId.isValid(userId)) {
            throw new Error('ID người dùng không hợp lệ');
        }

        const userObjectId = new ObjectId(userId);
        return await db.collection('users').findOne({ _id: userObjectId });
    } catch (error) {
        console.error('❌ Lỗi findUserById:', error);
        throw error;
    }
};

// Tìm user bằng username - THÊM NẾU CẦN
exports.findUserByUsername = async (db, username) => {
    try {
        return await db.collection('users').findOne({ username: username.toLowerCase() });
    } catch (error) {
        console.error('❌ Lỗi findUserByUsername:', error);
        throw error;
    }
};