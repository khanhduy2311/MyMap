const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

module.exports = (usersDb) => {
  const friendsCollection = usersDb.collection('friends');

  // TRANG BẠN BÈ - THÊM ROUTE NÀY
  router.get('/', async (req, res) => {
    try {
      const userId = new ObjectId(req.session.user._id);

      // Lấy danh sách lời mời kết bạn đang chờ
      const friendRequests = await friendsCollection.aggregate([
        {
          $match: {
            receiverId: userId,
            status: 'pending'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'senderId',
            foreignField: '_id',
            as: 'sender'
          }
        },
        { $unwind: '$sender' },
        {
          $project: {
            _id: 1,
            senderUsername: '$sender.username',
            senderId: '$sender._id',
            createdAt: 1
          }
        }
      ]).toArray();

      // Lấy danh sách bạn bè
      const friends = await friendsCollection.aggregate([
        {
          $match: {
            $or: [
              { senderId: userId, status: 'accepted' },
              { receiverId: userId, status: 'accepted' }
            ]
          }
        },
        {
          $lookup: {
            from: 'users',
            let: { 
              friendId: { 
                $cond: { 
                  if: { $eq: ['$senderId', userId] },
                  then: '$receiverId',
                  else: '$senderId'
                }
              }
            },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$friendId'] } } },
              { $project: { _id: 1, username: 1, displayName: 1 } }
            ],
            as: 'friendInfo'
          }
        },
        { $unwind: '$friendInfo' },
        {
          $project: {
            _id: '$friendInfo._id',
            username: '$friendInfo.username',
            displayName: '$friendInfo.displayName'
          }
        }
      ]).toArray();

      res.render('friends', {
        user: req.session.user,
        friendRequests: friendRequests,
        friends: friends
      });

    } catch (error) {
      console.error('Lỗi tải trang bạn bè:', error);
      req.flash('error_msg', 'Lỗi khi tải trang bạn bè.');
      res.redirect('/dashboard');
    }
  });

  // Gửi lời mời kết bạn - SỬA LẠI ĐỂ REDIRECT VỀ TRANG BẠN BÈ
  router.post('/send-request', async (req, res) => {
    try {
      const { username } = req.body;
      const senderId = new ObjectId(req.session.user._id);

      // Tìm user theo username
      const receiver = await usersDb.collection('users').findOne({ 
        username: username.trim() 
      });

      if (!receiver) {
        req.flash('error_msg', 'Không tìm thấy người dùng này.');
        return res.redirect('/friends'); // Sửa thành redirect về trang bạn bè
      }

      const receiverId = receiver._id;

      // Kiểm tra không gửi cho chính mình
      if (senderId.equals(receiverId)) {
        req.flash('error_msg', 'Bạn không thể kết bạn với chính mình.');
        return res.redirect('/friends');
      }

      // Kiểm tra đã gửi request chưa
      const existingRequest = await friendsCollection.findOne({
        $or: [
          { senderId, receiverId, status: 'pending' },
          { senderId: receiverId, receiverId: senderId, status: 'pending' }
        ]
      });

      if (existingRequest) {
        req.flash('error_msg', 'Đã gửi lời mời kết bạn trước đó.');
        return res.redirect('/friends');
      }

      // Kiểm tra đã là bạn bè chưa
      const existingFriend = await friendsCollection.findOne({
        $or: [
          { senderId, receiverId, status: 'accepted' },
          { senderId: receiverId, receiverId: senderId, status: 'accepted' }
        ]
      });

      if (existingFriend) {
        req.flash('error_msg', 'Hai bạn đã là bạn bè.');
        return res.redirect('/friends');
      }

      // Tạo friend request
      await friendsCollection.insertOne({
        senderId,
        receiverId,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      req.flash('success_msg', `Đã gửi lời mời kết bạn tới ${username}.`);
      res.redirect('/friends'); // Sửa thành redirect về trang bạn bè

    } catch (error) {
      console.error('Lỗi gửi friend request:', error);
      req.flash('error_msg', 'Lỗi server khi gửi lời mời kết bạn.');
      res.redirect('/friends');
    }
  });

  // Chấp nhận friend request - SỬA LẠI ĐỂ REDIRECT VỀ TRANG BẠN BÈ
  router.post('/accept-request', async (req, res) => {
    try {
      const { requestId } = req.body;
      const userId = new ObjectId(req.session.user._id);

      // Cập nhật trạng thái thành accepted
      const result = await friendsCollection.updateOne(
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
        }
      );

      if (result.modifiedCount === 0) {
        req.flash('error_msg', 'Không tìm thấy lời mời kết bạn.');
      } else {
        req.flash('success_msg', 'Đã chấp nhận lời mời kết bạn.');
      }

      res.redirect('/friends'); // Sửa thành redirect về trang bạn bè

    } catch (error) {
      console.error('Lỗi chấp nhận friend request:', error);
      req.flash('error_msg', 'Lỗi server khi chấp nhận lời mời.');
      res.redirect('/friends');
    }
  });

  // Từ chối friend request - SỬA LẠI ĐỂ REDIRECT VỀ TRANG BẠN BÈ
  router.post('/reject-request', async (req, res) => {
    try {
      const { requestId } = req.body;
      const userId = new ObjectId(req.session.user._id);

      await friendsCollection.deleteOne({
        _id: new ObjectId(requestId),
        receiverId: userId
      });

      req.flash('success_msg', 'Đã từ chối lời mời kết bạn.');
      res.redirect('/friends'); // Sửa thành redirect về trang bạn bè

    } catch (error) {
      console.error('Lỗi từ chối friend request:', error);
      req.flash('error_msg', 'Lỗi server khi từ chối lời mời.');
      res.redirect('/friends');
    }
  });

  // Xóa bạn bè - THÊM CHỨC NĂNG NÀY
  router.post('/remove', async (req, res) => {
    try {
      const { friendId } = req.body;
      const userId = new ObjectId(req.session.user._id);
      const friendObjectId = new ObjectId(friendId);

      await friendsCollection.deleteOne({
        $or: [
          { senderId: userId, receiverId: friendObjectId },
          { senderId: friendObjectId, receiverId: userId }
        ]
      });

      req.flash('success_msg', 'Đã xóa bạn bè.');
      res.redirect('/friends');

    } catch (error) {
      console.error('Lỗi xóa bạn bè:', error);
      req.flash('error_msg', 'Lỗi server khi xóa bạn bè.');
      res.redirect('/friends');
    }
  });

  // Lấy danh sách bạn bè (API) - GIỮ NGUYÊN
  router.get('/list', async (req, res) => {
    try {
      const userId = new ObjectId(req.session.user._id);
      
      const friends = await friendsCollection.aggregate([
        {
          $match: {
            $or: [
              { senderId: userId, status: 'accepted' },
              { receiverId: userId, status: 'accepted' }
            ]
          }
        },
        {
          $lookup: {
            from: 'users',
            let: { 
              friendId: { 
                $cond: { 
                  if: { $eq: ['$senderId', userId] },
                  then: '$receiverId',
                  else: '$senderId'
                }
              }
            },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$friendId'] } } },
              { $project: { _id: 1, username: 1 } }
            ],
            as: 'friendInfo'
          }
        },
        { $unwind: '$friendInfo' },
        {
          $project: {
            _id: '$friendInfo._id',
            username: '$friendInfo.username'
          }
        }
      ]).toArray();

      res.json(friends);
    } catch (error) {
      console.error('Lỗi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Lỗi server' });
    }
  });

  return router;
};