const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const authMiddleware = require('../middlewares/middlewares'); // Giả sử bạn có middleware này

// Truyền vào usersDb (kết nối database chính)
module.exports = (usersDb) => {
  // Lấy cả hai collection cần thiết
  const friendsCollection = usersDb.collection('friends');
  const usersCollection = usersDb.collection('users');
  console.log("friendRoutes initialized. Collections ready:", !!friendsCollection, !!usersCollection); // Log khởi tạo

  // TRANG BẠN BÈ - Đảm bảo có middleware xác thực
  router.get('/', authMiddleware.checkLoggedIn, async (req, res, next) => {
    console.log(`[${new Date().toISOString()}] GET /friends - User session:`, req.session.user); // Log session
    try {
      if (!req.session.user || !req.session.user._id) {
        console.error('❌ Lỗi: Session user không tồn tại hoặc thiếu _id trong GET /friends');
        return res.redirect('/login');
      }

      let userId;
      try {
        userId = new ObjectId(req.session.user._id);
        console.log("User ID (ObjectId):", userId); // Log userId
      } catch (idError) {
        console.error('❌ Lỗi: req.session.user._id không phải là ObjectId hợp lệ:', req.session.user._id, idError);
        return next(new Error('User ID không hợp lệ.')); // Chuyển lỗi rõ ràng
      }


      console.log("Đang lấy friendRequests..."); // Log bước 1
      // --- Lấy danh sách lời mời kết bạn đang chờ ---
      const friendRequests = await friendsCollection.aggregate([
        { $match: { receiverId: userId, status: 'pending' } },
        {
          $lookup: {
            from: 'users',
            localField: 'senderId',
            foreignField: '_id',
            as: 'senderInfo'
          }
        },
        // Thêm kiểm tra nếu $lookup không trả về kết quả
        { $match: { senderInfo: { $ne: [] } } },
        { $unwind: '$senderInfo' },
        {
          $project: {
            _id: 1,
            senderUsername: '$senderInfo.username',
            senderId: '$senderInfo._id',
            createdAt: 1
          }
        },
        { $sort: { createdAt: -1 } }
      ]).toArray();
      console.log("FriendRequests fetched:", friendRequests.length); // Log kết quả 1

      console.log("Đang lấy friends..."); // Log bước 2
      // --- Lấy danh sách bạn bè ---
      const friends = await friendsCollection.aggregate([
        {
          $match: {
            status: 'accepted',
            $or: [
              { senderId: userId },
              { receiverId: userId }
            ]
          }
        },
        {
          $addFields: {
            friendId: {
              $cond: {
                if: { $eq: ['$senderId', userId] },
                then: '$receiverId',
                else: '$senderId'
              }
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'friendId',
            foreignField: '_id',
            as: 'friendInfo'
          }
        },
         // Thêm kiểm tra nếu $lookup không trả về kết quả
        { $match: { friendInfo: { $ne: [] } } },
        { $unwind: '$friendInfo' },
        {
          $project: {
            _id: '$friendInfo._id',
            username: '$friendInfo.username',
            displayName: '$friendInfo.displayName',
            avatar: '$friendInfo.avatar'
          }
        },
        { $sort: { username: 1 } }
      ]).toArray();
      console.log("Friends fetched:", friends.length); // Log kết quả 2

      const renderData = {
        pageTitle: 'Bạn bè',
        user: req.session.user,
        friendRequests: friendRequests,
        friends: friends,
        showSearch: false
      };
      console.log("Dữ liệu chuẩn bị render:", JSON.stringify(renderData, null, 2)); // Log dữ liệu render

      // Render trang với dữ liệu đã lấy
      res.render('friends', renderData);
      console.log("Đã gọi res.render('friends')"); // Log render

    } catch (error) {
      console.error('❌ Lỗi nghiêm trọng khi tải trang bạn bè:', error);
      next(error); // Chuyển lỗi cho middleware
    }
  });

  // --- Gửi lời mời kết bạn (POST) ---
   router.post('/send-request', authMiddleware.checkLoggedIn, async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /friends/send-request - Body:`, req.body, "- User:", req.session.user.username);
    try {
      const { username } = req.body;
      const senderId = new ObjectId(req.session.user._id);

      if (!username || username.trim() === '') {
        console.log("Lỗi gửi request: Thiếu username");
        return res.status(400).json({ success: false, message: 'Vui lòng nhập username.' });
      }

      const receiver = await usersCollection.findOne({ username: username.trim() });
      console.log("Tìm receiver:", receiver ? receiver.username : 'Không tìm thấy');

      if (!receiver) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng này.' });
      }

      const receiverId = receiver._id;

      if (senderId.equals(receiverId)) {
        console.log("Lỗi gửi request: Gửi cho chính mình");
        return res.status(400).json({ success: false, message: 'Bạn không thể kết bạn với chính mình.' });
      }

      const existingRelation = await friendsCollection.findOne({
        $or: [
          { senderId: senderId, receiverId: receiverId },
          { senderId: receiverId, receiverId: senderId }
        ]
      });
      console.log("Kiểm tra existingRelation:", existingRelation);

      if (existingRelation) {
        if (existingRelation.status === 'pending') {
          return res.status(400).json({ success: false, message: 'Đã gửi lời mời trước đó hoặc đang chờ phản hồi.' });
        } else if (existingRelation.status === 'accepted') {
          return res.status(400).json({ success: false, message: 'Hai bạn đã là bạn bè.' });
        }
      }

      await friendsCollection.insertOne({
        senderId,
        receiverId,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log("Đã tạo friend request.");

      return res.json({ success: true, message: `Đã gửi lời mời tới ${username}.` });

    } catch (error) {
      console.error('❌ Lỗi gửi friend request:', error);
      return res.status(500).json({ success: false, message: 'Lỗi server khi gửi lời mời.' });
    }
  });

  // --- Chấp nhận lời mời (POST) ---
   router.post('/accept-request', authMiddleware.checkLoggedIn, async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /friends/accept-request - Body:`, req.body, "- User:", req.session.user.username);
    try {
      const { requestId } = req.body;
      const userId = new ObjectId(req.session.user._id);

      if (!requestId || !ObjectId.isValid(requestId)) {
         console.log("Lỗi accept: ID không hợp lệ", requestId);
         return res.status(400).json({ success: false, message: 'ID lời mời không hợp lệ.' });
      }

      const result = await friendsCollection.findOneAndUpdate(
        {
          _id: new ObjectId(requestId),
          receiverId: userId,
          status: 'pending'
        },
        {
          $set: {
            status: 'accepted',
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );
      console.log("Kết quả accept:", result);

      // Sửa kiểm tra: findOneAndUpdate trả về object chứa 'value' (document sau update) hoặc null nếu không tìm thấy
      if (!result || !result.value) {
        console.log("Lỗi accept: Không tìm thấy request hoặc đã xử lý");
        return res.status(404).json({ success: false, message: 'Không tìm thấy lời mời hoặc lời mời đã được xử lý.' });
      }

      console.log("Đã accept request:", requestId);
      return res.json({ success: true, message: 'Đã chấp nhận lời mời kết bạn.' });

    } catch (error) {
      console.error('❌ Lỗi chấp nhận friend request:', error);
      return res.status(500).json({ success: false, message: 'Lỗi server khi chấp nhận lời mời.' });
    }
  });

  // --- Từ chối / Hủy lời mời (POST) ---
   router.post('/reject-request', authMiddleware.checkLoggedIn, async (req, res) => {
     console.log(`[${new Date().toISOString()}] POST /friends/reject-request - Body:`, req.body, "- User:", req.session.user.username);
    try {
      const { requestId } = req.body;
      const userId = new ObjectId(req.session.user._id);

      if (!requestId || !ObjectId.isValid(requestId)) {
         console.log("Lỗi reject: ID không hợp lệ", requestId);
         return res.status(400).json({ success: false, message: 'ID lời mời không hợp lệ.' });
      }

      const result = await friendsCollection.deleteOne({
        _id: new ObjectId(requestId),
        status: 'pending',
        $or: [
          { receiverId: userId },
          { senderId: userId }
        ]
      });
      console.log("Kết quả reject/delete:", result);

      if (result.deletedCount === 0) {
        console.log("Lỗi reject: Không tìm thấy request hoặc không có quyền");
        return res.status(404).json({ success: false, message: 'Không tìm thấy lời mời hoặc bạn không có quyền.' });
      }

      console.log("Đã reject/delete request:", requestId);
      return res.json({ success: true, message: 'Đã từ chối/hủy lời mời kết bạn.' });

    } catch (error) {
      console.error('❌ Lỗi từ chối/hủy friend request:', error);
      return res.status(500).json({ success: false, message: 'Lỗi server khi xử lý lời mời.' });
    }
  });


  // --- Xóa bạn bè (POST) ---
   router.post('/remove', authMiddleware.checkLoggedIn, async (req, res) => {
     console.log(`[${new Date().toISOString()}] POST /friends/remove - Body:`, req.body, "- User:", req.session.user.username);
    try {
      const { friendId } = req.body;
      const userId = new ObjectId(req.session.user._id);

      if (!friendId || !ObjectId.isValid(friendId)) {
        console.log("Lỗi remove: ID bạn bè không hợp lệ", friendId);
        return res.status(400).json({ success: false, message: 'ID bạn bè không hợp lệ.' });
      }
      const friendObjectId = new ObjectId(friendId);

      const result = await friendsCollection.deleteOne({
        status: 'accepted',
        $or: [
          { senderId: userId, receiverId: friendObjectId },
          { senderId: friendObjectId, receiverId: userId }
        ]
      });
      console.log("Kết quả remove friend:", result);

      if (result.deletedCount === 0) {
         console.log("Lỗi remove: Không tìm thấy mối quan hệ bạn bè");
         return res.status(404).json({ success: false, message: 'Không tìm thấy mối quan hệ bạn bè này.' });
      }

      console.log("Đã remove friend:", friendId);
      return res.json({ success: true, message: 'Đã xóa bạn bè thành công.' });

    } catch (error) {
      console.error('❌ Lỗi xóa bạn bè:', error);
      return res.status(500).json({ success: false, message: 'Lỗi server khi xóa bạn bè.' });
    }
  });

  // --- API Lấy danh sách bạn bè (cho chat client-side) ---
  router.get('/list', authMiddleware.checkLoggedIn, async (req, res, next) => { // Thêm next
    console.log(`[${new Date().toISOString()}] GET /friends/list - User:`, req.session.user.username);
    try {
      const userId = new ObjectId(req.session.user._id);

      const friends = await friendsCollection.aggregate([
        {
          $match: {
            status: 'accepted',
            $or: [{ senderId: userId }, { receiverId: userId }]
          }
        },
        {
          $addFields: {
            friendId: { $cond: { if: { $eq: ['$senderId', userId] }, then: '$receiverId', else: '$senderId' } }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'friendId',
            foreignField: '_id',
            as: 'friendInfo'
          }
        },
        { $match: { friendInfo: { $ne: [] } } }, // Thêm kiểm tra
        { $unwind: '$friendInfo' },
        {
          $project: {
            _id: '$friendInfo._id',
            username: '$friendInfo.username',
            avatar: '$friendInfo.avatar'
          }
        },
        { $sort: { username: 1 } }
      ]).toArray();
      console.log("API /list fetched friends:", friends.length);

      res.json(friends);
    } catch (error) {
      console.error('❌ Lỗi lấy danh sách bạn bè (API):', error);
      // Không gọi next(error) ở đây vì đây là API trả JSON
      res.status(500).json({ error: 'Lỗi server khi lấy danh sách bạn bè.' });
    }
  });


  return router;
};

