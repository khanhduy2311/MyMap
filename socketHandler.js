// File: socketHandler.js
const { ObjectId } = require('mongodb');

// Map để lưu trạng thái online: userId (string) -> socketId
const onlineUsers = new Map();

module.exports = (io, usersDb, chatDb) => {
    // Lấy các collection cần thiết
    const messagesCollection = chatDb.collection('messages');
    const friendsCollection = usersDb.collection('friends'); // Collection để lấy danh sách bạn bè

    // === Hàm helper lấy danh sách ID bạn bè ===
    async function getFriendsList(userId) {
        if (!userId) return []; // Trả về mảng rỗng nếu không có userId
        try {
            const friendships = await friendsCollection.find({
                status: 'accepted', // Chỉ lấy bạn bè đã chấp nhận
                $or: [{ senderId: userId }, { receiverId: userId }] // Tìm trong cả hai trường
            }).toArray();

            // Lấy ID của người bạn (không phải userId hiện tại)
            return friendships.map(f => {
                return f.senderId.equals(userId) ? f.receiverId : f.senderId;
            });
        } catch (error) {
            console.error(`❌ Error fetching friends list for user ${userId}:`, error);
            return []; // Trả về mảng rỗng nếu có lỗi
        }
    }

    // === Xử lý khi có kết nối mới ===
    io.on('connection', async (socket) => {
        console.log(`🔌 User connected: ${socket.id}`);
        let currentUserId = null; // Biến lưu ObjectId của user cho socket này
        let currentUserIdString = null; // Biến lưu string ID của user

        // --- 1. Xác thực người dùng qua session ---
        try {
            // Kiểm tra session và user._id tồn tại
            if (socket.request.session?.user?._id) {
                currentUserId = new ObjectId(socket.request.session.user._id);
                currentUserIdString = currentUserId.toString();
                console.log(`🙋 User authenticated via session: ${currentUserIdString}`);
                socket.emit('authenticated', { userId: currentUserIdString }); // Gửi ID về client
            } else {
                throw new Error('Session or user ID missing.'); // Ném lỗi nếu thiếu session
            }
        } catch (error) {
            console.warn(`🔒 Authentication error for socket ${socket.id}: ${error.message}. Disconnecting.`);
            socket.emit('chatError', 'Lỗi xác thực. Vui lòng đăng nhập lại.');
            socket.disconnect(true); // Ngắt kết nối nếu xác thực lỗi
            return; // Dừng xử lý thêm cho socket này
        }

        // --- 2. Xử lý trạng thái Online ---
        // Lưu trạng thái online
        onlineUsers.set(currentUserIdString, socket.id);
        console.log(`🟢 User online: ${currentUserIdString}. Total online: ${onlineUsers.size}`);

        // Lấy danh sách bạn bè của user này
        const friendObjectIds = await getFriendsList(currentUserId);
        const friendIds = friendObjectIds.map(id => id.toString()); // Chuyển sang string array

        // Thông báo cho bạn bè đang online biết user này online
        friendIds.forEach(friendId => {
            const friendSocketId = onlineUsers.get(friendId);
            if (friendSocketId) {
                io.to(friendSocketId).emit('user online', { userId: currentUserIdString });
                console.log(`   📢 Notified friend ${friendId} (socket ${friendSocketId}) that ${currentUserIdString} is online.`);
            }
        });

        // Gửi cho user này danh sách bạn bè đang online
        const onlineFriendIds = friendIds.filter(friendId => onlineUsers.has(friendId));
        socket.emit('friends status', { onlineFriendIds: onlineFriendIds });
        console.log(`   📡 Sent online status of ${onlineFriendIds.length} friends back to ${currentUserIdString}.`);

        // --- 3. Lắng nghe các sự kiện chat từ client ---

        // Lấy lịch sử chat
        socket.on('getChatHistory', async (data) => {
            if (!currentUserId || !data || !data.receiverId) return;
            console.log(`📜 Request chat history between ${currentUserIdString} and ${data.receiverId}`);
            try {
                const receiverId = new ObjectId(data.receiverId);
                const messages = await messagesCollection.find({
                    $or: [
                        { senderId: currentUserId, receiverId: receiverId },
                        { senderId: receiverId, receiverId: currentUserId }
                    ]
                }).sort({ createdAt: 1 }).toArray(); // Sắp xếp từ cũ đến mới

                socket.emit('chatHistory', {
                    receiverId: data.receiverId,
                    messages: messages,
                    currentUserId: currentUserIdString // Gửi lại ID để client biết tin nhắn nào là của mình
                });
            } catch (error) {
                console.error(`❌ Error fetching chat history for ${currentUserIdString} and ${data.receiverId}:`, error);
                socket.emit('chatError', 'Không thể tải lịch sử tin nhắn.');
            }
        });

        // Nhận và gửi tin nhắn
        socket.on('sendMessage', async (data) => {
            if (!currentUserId || !data || !data.receiverId || !data.content) {
                console.warn("Invalid sendMessage data:", data);
                return;
            }
            console.log(`💬 Message from ${currentUserIdString} to ${data.receiverId}: ${data.content}`);
            try {
                const receiverId = new ObjectId(data.receiverId);
                const message = {
                    senderId: currentUserId,
                    receiverId: receiverId,
                    content: data.content,
                    createdAt: new Date()
                };
                const result = await messagesCollection.insertOne(message);

                // Gửi lại tin nhắn đã lưu (có _id và createdAt) cho người gửi
                socket.emit('messageSent', { ...message, senderId: currentUserIdString, receiverId: data.receiverId }); // Gửi ID dạng string

                // Gửi tin nhắn cho người nhận nếu họ online
                const receiverSocketId = onlineUsers.get(data.receiverId);
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('receiveMessage', { ...message, senderId: currentUserIdString, receiverId: data.receiverId }); // Gửi ID dạng string
                    console.log(`   📨 Sent message to receiver ${data.receiverId} (socket ${receiverSocketId})`);
                } else {
                    console.log(`   📪 Receiver ${data.receiverId} is offline. Message saved.`);
                    // (Tùy chọn: Xử lý thông báo offline)
                }
            } catch (error) {
                console.error(`❌ Error sending message from ${currentUserIdString} to ${data.receiverId}:`, error);
                socket.emit('chatError', 'Gửi tin nhắn thất bại.');
            }
        });

        // Xử lý typing indicators (Giữ nguyên)
        socket.on('typingStart', (data) => {
            if (!currentUserId || !data || !data.receiverId) return;
            const receiverSocketId = onlineUsers.get(data.receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('typing', { userId: currentUserIdString, isTyping: true });
            }
        });

        socket.on('typingStop', (data) => {
             if (!currentUserId || !data || !data.receiverId) return;
            const receiverSocketId = onlineUsers.get(data.receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('typing', { userId: currentUserIdString, isTyping: false });
            }
        });

        // --- 4. Xử lý khi ngắt kết nối ---
        socket.on('disconnect', async (reason) => {
            console.log(`🔌 User disconnected: ${socket.id}. UserID: ${currentUserIdString}. Reason: ${reason}`);
            if (currentUserIdString) {
                // Xóa trạng thái online
                onlineUsers.delete(currentUserIdString);
                console.log(`🔴 User offline: ${currentUserIdString}. Total online: ${onlineUsers.size}`);

                // Lấy lại danh sách bạn bè
                const friendObjectIdsOnDisconnect = await getFriendsList(currentUserId);
                const friendIdsOnDisconnect = friendObjectIdsOnDisconnect.map(id => id.toString());

                // Thông báo cho bạn bè đang online biết user này offline
                friendIdsOnDisconnect.forEach(friendId => {
                    const friendSocketId = onlineUsers.get(friendId);
                    if (friendSocketId) {
                        io.to(friendSocketId).emit('user offline', { userId: currentUserIdString });
                        console.log(`   📢 Notified friend ${friendId} (socket ${friendSocketId}) that ${currentUserIdString} is offline.`);
                    }
                });
            }
            // Dọn dẹp biến
            currentUserId = null;
            currentUserIdString = null;
        });

    }); // Kết thúc io.on('connection')
}; // Kết thúc module.exports