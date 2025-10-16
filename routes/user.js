const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

router.post('/update', async (req, res) => {
  const db = req.app.locals.db;
  const { userId, name, username, email } = req.body;

  if (!userId) return res.status(400).json({ success: false, message: 'Thiếu userId' });

  try {
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { name, username, email } }
    );

    res.json({ success: true, message: 'Cập nhật thông tin thành công!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thông tin' });
  }
});

module.exports = router;
