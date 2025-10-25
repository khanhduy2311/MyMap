// File: socketHandler.js
const { ObjectId } = require('mongodb');

// Map để lưu trữ người dùng đang online (userId -> socket.id)
const activeUsers = new Map();

module.exports = (io, chatDb) => {
  const conversationsCollection = chatDb.collection('conversations');
  const friendsCollection = chatDb.collection('friends'); // THÊM DÒNG NÀY

  io.on('connection', (socket) => {
    // === 1. Xác thực người dùng ===
    const session = socket.request.session;
    if (!session || !session.user || !session.user._id) {
      console.log('Socket: Kết nối không xác thực. Đang ngắt...');
      return socket.disconnect(true);
    }
    
    const userId = session.user._id;
    const username = session.user.username;
    
    // SỬA: Lưu cả socket.id và username để dễ debug
    activeUsers.set(userId.toString(), {
      socketId: socket.id,
      username: username
    });
    
    console.log(`Socket: ✅ ${username} (ID: ${userId}) đã kết nối. Socket ID: ${socket.id}`);

    // Gửi sự kiện xác thực thành công
    socket.emit('authenticated', { userId: userId.toString() });

    // === 2. Xử lý khi người dùng gửi tin nhắn ===
    socket.on('sendMessage', async (data) => {
      try {
        const { receiverId, content } = data;
        const senderId = new ObjectId(userId); // SỬA: Dùng userId từ session
        const receiverObjId = new ObjectId(receiverId);

        if (!content || !receiverId) {
          return socket.emit('chatError', 'Thiếu nội dung hoặc người nhận.');
        }

        if (content.trim().length === 0) {
          return socket.emit('chatError', 'Tin nhắn không được để trống.');
        }

        // KIỂM TRA BẠN BÈ: Chỉ cho phép chat nếu là bạn bè
        const friendship = await friendsCollection.findOne({
          $or: [
            { senderId: senderId, receiverId: receiverObjId, status: 'accepted' },
            { senderId: receiverObjId, receiverId: senderId, status: 'accepted' }
          ]
        });

        if (!friendship) {
          return socket.emit('chatError', 'Bạn cần kết bạn với người này để nhắn tin.');
        }

        const newMessage = {
          _id: new ObjectId(),
          senderId: senderId,
          content: content.trim(),
          createdAt: new Date(),
          read: false
        };

        // Tìm hoặc tạo conversation
        let conversation = await conversationsCollection.findOne({
          participants: { 
            $all: [senderId, receiverObjId],
            $size: 2
          }
        });

        let conversationId;

        if (conversation) {
          // Cập nhật conversation hiện có
          await conversationsCollection.updateOne(
            { _id: conversation._id },
            {
              $push: { messages: newMessage },
              $set: { lastUpdatedAt: new Date() }
            }
          );
          conversationId = conversation._id;
        } else {
          // Tạo conversation mới
          const newConversation = {
            participants: [senderId, receiverObjId],
            messages: [newMessage],
            lastUpdatedAt: new Date(),
            createdAt: new Date()
          };
          
          const result = await conversationsCollection.insertOne(newConversation);
          conversationId = result.insertedId;
        }
        
        console.log(`Socket: Tin nhắn từ ${username} tới ${receiverId} đã được lưu.`);

        // === 3. Gửi tin nhắn real-time ===
        const receiverData = activeUsers.get(receiverId.toString());
        if (receiverData) {
          io.to(receiverData.socketId).emit('receiveMessage', {
            _id: newMessage._id.toString(),
            senderId: senderId.toString(),
            content: newMessage.content,
            createdAt: newMessage.createdAt,
            conversationId: conversationId.toString()
          });
          console.log(`Socket: Đã gửi tin nhắn real-time tới ${receiverId}.`);
        } else {
          console.log(`Socket: Người nhận ${receiverId} không online.`);
        }
        
        // Xác nhận cho người gửi
        socket.emit('messageSent', {
          _id: newMessage._id.toString(),
          senderId: senderId.toString(),
          content: newMessage.content,
          createdAt: newMessage.createdAt,
          conversationId: conversationId.toString()
        });

      } catch (error) {
        console.error('Socket: Lỗi khi xử lý sendMessage:', error);
        socket.emit('chatError', 'Lỗi server khi gửi tin nhắn.');
      }
    });

    // === 4. Xử lý lấy lịch sử chat ===
    socket.on('getChatHistory', async (data) => {
      try {
        const { receiverId } = data;
        const senderId = new ObjectId(userId);
        const receiverObjId = new ObjectId(receiverId);

        const conversation = await conversationsCollection.findOne({
          participants: { 
            $all: [senderId, receiverObjId],
            $size: 2
          }
        });

        const messages = conversation ? conversation.messages : [];
        
        // Format messages để client dễ xử lý
        const formattedMessages = messages.map(msg => ({
          _id: msg._id.toString(),
          senderId: msg.senderId.toString(),
          content: msg.content,
          createdAt: msg.createdAt
        }));

        socket.emit('chatHistory', {
          receiverId: receiverId,
          currentUserId: userId.toString(),
          messages: formattedMessages
        });

      } catch (error) {
        console.error('Socket: Lỗi khi lấy lịch sử chat:', error);
        socket.emit('chatError', 'Lỗi khi tải lịch sử tin nhắn.');
      }
    });

    // === 5. Xử lý typing indicator (TÙY CHỌN) ===
    socket.on('typingStart', (data) => {
      const { receiverId } = data;
      const receiverData = activeUsers.get(receiverId.toString());
      if (receiverData) {
        io.to(receiverData.socketId).emit('userTyping', {
          senderId: userId.toString(),
          username: username
        });
      }
    });

    socket.on('typingStop', (data) => {
      const { receiverId } = data;
      const receiverData = activeUsers.get(receiverId.toString());
      if (receiverData) {
        io.to(receiverData.socketId).emit('userStopTyping', {
          senderId: userId.toString()
        });
      }
    });

    // === 6. Xử lý khi ngắt kết nối ===
    socket.on('disconnect', () => {
      activeUsers.delete(userId.toString());
      console.log(`Socket: 🛑 ${username} (ID: ${userId}) đã ngắt kết nối.`);
    });

    // === 7. Xử lý lỗi ===
    socket.on('error', (error) => {
      console.error(`Socket: Lỗi từ ${username}:`, error);
    });
  });
};