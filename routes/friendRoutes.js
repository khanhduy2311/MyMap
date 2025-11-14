const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const authMiddleware = require('../middlewares/middlewares');
const { sanitizeUser } = require('../utils/sanitizeUser');
const { ok, fail } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// Truyền vào usersDb (kết nối database chính)
module.exports = (usersDb) => {
  // Lấy cả hai collection cần thiết
  const friendsCollection = usersDb.collection('friends');
  const usersCollection = usersDb.collection('users');
  console.log("friendRoutes initialized. Collections ready:", !!friendsCollection, !!usersCollection); // Log khởi tạo

  // TRANG BẠN BÈ - Đảm bảo có middleware xác thực
  router.get('/', authMiddleware.checkLoggedIn, async (req, res, next) => {
    try {
      if (!req.session.user || !req.session.user._id) {
        logger.error('GET /friends: Session user không tồn tại', { session: req.session });
        return res.redirect('/login');
      }

      let userId;
      try {
        userId = new ObjectId(req.session.user._id);
      } catch (idError) {
        logger.error('GET /friends: Invalid ObjectId', { userId: req.session.user._id, error: idError });
        return next(new Error('User ID không hợp lệ.'));
      }

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

      const renderData = {
        pageTitle: 'Bạn bè',
        user: req.session.user,
        friendRequests: friendRequests,
        friends: friends,
        showSearch: false
      };

      res.render('friends', renderData);

    } catch (error) {
      logger.error('Lỗi tải trang bạn bè', { error, userId: req.session.user._id });
      next(error);
    }
  });

  // --- Gửi lời mời kết bạn (POST) ---
   router.post('/send-request', authMiddleware.checkLoggedIn, async (req, res) => {
    try {
      const { username } = req.body;
      const senderId = new ObjectId(req.session.user._id);

      if (!username || username.trim() === '') {
        return fail(res, 400, 'MISSING_USERNAME', 'Vui lòng nhập username.');
      }

      const receiver = await usersCollection.findOne({ username: username.trim() });

      if (!receiver) {
        return fail(res, 404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng này.');
      }

      const receiverId = receiver._id;

      if (senderId.equals(receiverId)) {
        return fail(res, 400, 'SELF_REQUEST', 'Bạn không thể kết bạn với chính mình.');
      }

      const existingRelation = await friendsCollection.findOne({
        $or: [
          { senderId: senderId, receiverId: receiverId },
          { senderId: receiverId, receiverId: senderId }
        ]
      });

      if (existingRelation) {
        if (existingRelation.status === 'pending') {
          return fail(res, 400, 'PENDING_REQUEST', 'Đã gửi lời mời trước đó hoặc đang chờ phản hồi.');
        } else if (existingRelation.status === 'accepted') {
          return fail(res, 400, 'ALREADY_FRIENDS', 'Hai bạn đã là bạn bè.');
        }
      }

      await friendsCollection.insertOne({
        senderId,
        receiverId,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return ok(res, { message: `Đã gửi lời mời tới ${username}.` });

    } catch (error) {
      logger.error('Lỗi gửi friend request', { error, senderId: req.session.user._id, username: req.body.username });
      return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi server khi gửi lời mời.');
    }
  });

  // --- Chấp nhận lời mời (POST) ---
   router.post('/accept-request', authMiddleware.checkLoggedIn, async (req, res) => {
    try {
      const { requestId } = req.body;
      const userId = new ObjectId(req.session.user._id);

      if (!requestId || !ObjectId.isValid(requestId)) {
         return fail(res, 400, 'INVALID_REQUEST_ID', 'ID lời mời không hợp lệ.');
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

      if (!result || !result.value) {
        return fail(res, 404, 'REQUEST_NOT_FOUND', 'Không tìm thấy lời mời hoặc lời mời đã được xử lý.');
      }

      return ok(res, { message: 'Đã chấp nhận lời mời kết bạn.' });

    } catch (error) {
      logger.error('Lỗi chấp nhận friend request', { error, userId: req.session.user._id, requestId: req.body.requestId });
      return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi server khi chấp nhận lời mời.');
    }
  });

  // --- Từ chối / Hủy lời mời (POST) ---
   router.post('/reject-request', authMiddleware.checkLoggedIn, async (req, res) => {
    try {
      const { requestId } = req.body;
      const userId = new ObjectId(req.session.user._id);

      if (!requestId || !ObjectId.isValid(requestId)) {
         return fail(res, 400, 'INVALID_REQUEST_ID', 'ID lời mời không hợp lệ.');
      }

      const result = await friendsCollection.deleteOne({
        _id: new ObjectId(requestId),
        status: 'pending',
        $or: [
          { receiverId: userId },
          { senderId: userId }
        ]
      });

      if (result.deletedCount === 0) {
        return fail(res, 404, 'REQUEST_NOT_FOUND', 'Không tìm thấy lời mời hoặc bạn không có quyền.');
      }

      return ok(res, { message: 'Đã từ chối/hủy lời mời kết bạn.' });

    } catch (error) {
      logger.error('Lỗi từ chối friend request', { error, userId: req.session.user._id, requestId: req.body.requestId });
      return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi server khi xử lý lời mời.');
    }
  });


  // --- Xóa bạn bè (POST) ---
   router.post('/remove', authMiddleware.checkLoggedIn, async (req, res) => {
    try {
      const { friendId } = req.body;
      const userId = new ObjectId(req.session.user._id);

      if (!friendId || !ObjectId.isValid(friendId)) {
        return fail(res, 400, 'INVALID_FRIEND_ID', 'ID bạn bè không hợp lệ.');
      }
      const friendObjectId = new ObjectId(friendId);

      const result = await friendsCollection.deleteOne({
        status: 'accepted',
        $or: [
          { senderId: userId, receiverId: friendObjectId },
          { senderId: friendObjectId, receiverId: userId }
        ]
      });

      if (result.deletedCount === 0) {
         return fail(res, 404, 'FRIEND_NOT_FOUND', 'Không tìm thấy mối quan hệ bạn bè này.');
      }

      return ok(res, { message: 'Đã xóa bạn bè thành công.' });

    } catch (error) {
      logger.error('Lỗi xóa bạn bè', { error, userId: req.session.user._id, friendId: req.body.friendId });
      return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi server khi xóa bạn bè.');
    }
  });

  // --- API Lấy danh sách bạn bè (cho chat client-side) ---
  router.get('/list', authMiddleware.checkLoggedIn, async (req, res, next) => {
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
        { $match: { friendInfo: { $ne: [] } } },
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

      // Sanitize để chắc chắn không rò rỉ password (dù projection đã loại bỏ)
      const sanitizedFriends = friends.map(f => sanitizeUser(f));
      return ok(res, sanitizedFriends);
    } catch (error) {
      logger.error('Lỗi lấy danh sách bạn bè API', { error, userId: req.session.user._id });
      return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi server khi lấy danh sách bạn bè.');
    }
  });


  return router;
};

