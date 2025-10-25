const { ObjectId } = require('mongodb');
const userModel = require('../models/userModel.js');
const moment = require('moment');

function isSameDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// === GET /dashboard ===
exports.getDashboardPage = async (req, res) => {
  try {
    const usersDb = req.app.locals.usersDb;
    const mindmapsDb = req.app.locals.mindmapsDb;
    const userId = new ObjectId(req.session.user._id);

    // Lấy thông tin người dùng
    const user = await userModel.findUserById(usersDb, userId);
    if (!user) {
      req.flash('error_msg', 'Không tìm thấy người dùng.');
      return res.redirect('/login');
    }

    // 👉 Xác định lần đầu đăng nhập
    const isFirstLoginEver = !user.lastLogin;
    const today = new Date();
    const showWelcomeAnimation = !user.lastLogin || !isSameDay(user.lastLogin, today);
    // Cập nhật lastLogin nếu chưa có hoặc khác ngày hiện tại
    if (showWelcomeAnimation) {
      await usersDb.collection('users').updateOne(
        { _id: userId },
        { $set: { lastLogin: today } }
      );
    }

    // Lấy danh sách thư mục
    const folders = await mindmapsDb
      .collection('folders')
      .find({ userId: userId })
      .sort({ name: 1 })
      .toArray();

    // Phân trang & tìm kiếm
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;
    const searchQuery = req.query.search || '';

    const filter = {
      deleted: { $ne: true },
      folderId: { $exists: false },
    };

    if (searchQuery) {
      filter.title = { $regex: searchQuery, $options: 'i' };
    }

    const mindmapCollectionName = req.session.user._id.toString();
    const collection = mindmapsDb.collection(mindmapCollectionName);

    const mindmaps = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalMindmaps = await collection.countDocuments(filter);
    const totalPages = Math.ceil(totalMindmaps / limit);

    // Render ra dashboard
    res.locals.showSearch = true;
    res.locals.searchActionUrl = '/dashboard';
    res.locals.searchQuery = searchQuery;

    res.render('dashboard', {
      pageTitle: 'Bảng điều khiển',
      user: {
        ...user,
        isFirstLogin: showWelcomeAnimation,
        isFirstLoginEver: isFirstLoginEver
      },
      mindmaps,
      folders,
      currentPage: page,
      totalPages,
      searchQuery,
      currentFolder: null,
    });
  } catch (err) {
    console.error('❌ Lỗi khi tải trang dashboard:', err);
    req.flash('error_msg', 'Lỗi khi tải trang của bạn.');
    res.redirect('/login');
  }
};
// [POST] /dashboard/folders
exports.createFolder = async (req, res) => {
    try {
        const { folderName } = req.body;
        if (!folderName || folderName.trim() === "") {
            req.flash('error_msg', 'Tên thư mục không được để trống.');
            return res.redirect('/dashboard');
        }

        const mindmapsDb = req.app.locals.mindmapsDb;
        const userId = new ObjectId(req.session.user._id);

        await mindmapsDb.collection('folders').insertOne({
            name: folderName.trim(),
            userId: userId,
            createdAt: new Date()
        });

        req.flash('success_msg', 'Đã tạo thư mục mới!');
        res.redirect('/dashboard');

    } catch (err) {
        console.error('❌ Lỗi khi tạo thư mục:', err);
        req.flash('error_msg', 'Lỗi khi tạo thư mục.');
        res.redirect('/dashboard');
    }
};

// [GET] /dashboard/folders/:id
exports.getFolderPage = async (req, res) => {
    try {
        const usersDb = req.app.locals.usersDb;
        const mindmapsDb = req.app.locals.mindmapsDb;
        const userId = new ObjectId(req.session.user._id);
        const folderId = new ObjectId(req.params.id);

        const user = await userModel.findUserById(usersDb, userId);
        if (!user) return res.redirect('/login');
        
        const folders = await mindmapsDb.collection('folders')
            .find({ userId: userId })
            .sort({ name: 1 })
            .toArray();

        const currentFolder = folders.find(f => f._id.equals(folderId));
        if (!currentFolder) {
            req.flash('error_msg', 'Không tìm thấy thư mục.');
            return res.redirect('/dashboard');
        }

        const page = parseInt(req.query.page) || 1; 
        const limit = 12; 
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || ""; 

        const filter = {
            deleted: { $ne: true },
            folderId: folderId
        };
        if (searchQuery) {
            filter.title = { $regex: searchQuery, $options: 'i' };
        }

        const mindmapCollectionName = req.session.user._id.toString();
        const collection = mindmapsDb.collection(mindmapCollectionName);

        const mindmaps = await collection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
        const totalMindmaps = await collection.countDocuments(filter);
        const totalPages = Math.ceil(totalMindmaps / limit);

        res.render('dashboard', {
            pageTitle: `Thư mục: ${currentFolder.name}`,
            user: user,
            mindmaps: mindmaps,
            folders: folders,
            currentPage: page,
            totalPages: totalPages,
            searchQuery: searchQuery,
            currentFolder: currentFolder
        });

    } catch (err) {
        console.error('❌ Lỗi khi tải trang thư mục:', err);
        req.flash('error_msg', 'Lỗi khi tải trang thư mục.');
        res.redirect('/dashboard');
    }
};

// [PATCH] /dashboard/mindmaps/:id/move
exports.moveMindmap = async (req, res) => {
    try {
        const { folderId } = req.body; 
        const { id: mindmapId } = req.params;
        
        if (!folderId) {
            return res.status(400).json({ success: false, message: 'Thiếu Folder ID.' });
        }

        const db = req.app.locals.mindmapsDb;
        const collectionName = req.session.user._id.toString();
        
        let updateOperation;

        if (folderId === "root") {
            updateOperation = { $unset: { folderId: "" } };
        } else {
            updateOperation = { $set: { folderId: new ObjectId(folderId) } };
        }

        const result = await db.collection(collectionName).updateOne(
            { _id: new ObjectId(mindmapId) },
            updateOperation 
        );

        if (result.matchedCount === 0) { 
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap.' });
        }
        
        res.json({ success: true, message: 'Đã di chuyển mindmap!' });

    } catch (err) {
        console.error('❌ Lỗi khi di chuyển mindmap:', err);
        if (err.name === 'BSONTypeError') {
            return res.status(400).json({ success: false, message: 'Folder ID không hợp lệ.' });
        }
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

exports.getTrashPage = async (req, res) => {
    try {
        const mindmapsDb = req.app.locals.mindmapsDb;
        const usersDb = req.app.locals.usersDb;
        const userId = new ObjectId(req.session.user._id);
        
        const user = await userModel.findUserById(usersDb, userId);
        if (!user) {
            req.flash('error_msg', 'Không tìm thấy người dùng.');
            return res.redirect('/login');
        }

        const collectionName = req.session.user._id.toString();
        const searchQuery = req.query.search || ""; 
        const filter = {
            deleted: true
        };
        if (searchQuery) {
            filter.title = { $regex: searchQuery, $options: 'i' };
        }

        const deletedMindmaps = await mindmapsDb.collection(collectionName)
                                 .find(filter) 
                                 .sort({ deletedAt: -1 })
                                 .toArray();
        
        const mindmapsWithRemainingDays = deletedMindmaps.map(mindmap => {
            if (!mindmap.deletedAt) {
              return { ...mindmap, remainingDays: 0 };
            }
            
            const deletionDate = moment(mindmap.deletedAt);
            const expiryDate = deletionDate.add(30, 'days');
            const remainingDays = Math.max(0, expiryDate.diff(moment(), 'days') + 1); 
            
            return { ...mindmap, remainingDays: remainingDays };
        });
        
        res.locals.showSearch = true; 
        res.locals.searchActionUrl = '/dashboard/trash'; 
        res.locals.searchQuery = searchQuery; 

        res.render('dashboard-trash', {
            pageTitle: 'Thùng rác',
            user: user,
            mindmaps: mindmapsWithRemainingDays,
            searchQuery: searchQuery
        });
    } catch (err) {
        console.error('❌ Lỗi khi tải trang thùng rác:', err);
        req.flash('error_msg', 'Lỗi khi tải trang thùng rác.');
        res.redirect('/dashboard');
    }
};

exports.recoverMindmap = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        const mindmapId = new ObjectId(req.params.id);
        const collectionName = req.session.user._id.toString();

        const result = await db.collection(collectionName).updateOne(
            { _id: mindmapId },
            { $set: { deleted: false } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap để khôi phục.' });
        }

        res.json({ success: true, message: 'Khôi phục thành công!' });

    } catch (error) {
        console.error("Lỗi khi khôi phục mindmap:", error);
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

exports.deleteMindmapPermanently = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        const mindmapId = new ObjectId(req.params.id);
        const collectionName = req.session.user._id.toString();

        const result = await db.collection(collectionName).deleteOne(
            { _id: mindmapId, deleted: true } 
        );

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap trong thùng rác.' });
        }

        res.json({ success: true, message: 'Đã xóa vĩnh viễn mindmap.' });

    } catch (error) {
        console.error("Lỗi khi xóa vĩnh viễn mindmap:", error);
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

exports.emptyTrash = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        const collectionName = req.session.user._id.toString();

        const result = await db.collection(collectionName).deleteMany(
            { deleted: true } 
        );

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Thùng rác đã trống.' });
        }

        res.json({ success: true, message: `Đã dọn sạch ${result.deletedCount} mục.` });

    } catch (error) {
        console.error("Lỗi khi dọn sạch thùng rác:", error);
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

// [GET] /dashboard/api/search-suggestions
exports.getSearchSuggestions = async (req, res) => {
    try {
        const query = req.query.q || "";
        
        if (query.length < 2) { 
            return res.json([]);
        }

        const mindmapsDb = req.app.locals.mindmapsDb;
        const collectionName = req.session.user._id.toString();

        const filter = {
            deleted: { $ne: true },
            title: { $regex: query, $options: 'i' }
        };

        const suggestions = await mindmapsDb.collection(collectionName)
            .find(filter)
            .limit(5)
            .project({ title: 1 })
            .toArray();
        
        res.json(suggestions);

    } catch (err) {
        console.error('❌ Lỗi khi lấy gợi ý tìm kiếm:', err);
        res.status(500).json({ error: 'Lỗi server' });
    }
};

exports.getTrashSearchSuggestions = async (req, res) => {
    try {
        const query = req.query.q || ""; 
        if (query.length < 2) { 
            return res.json([]);
        }

        const mindmapsDb = req.app.locals.mindmapsDb;
        const collectionName = req.session.user._id.toString();

        const filter = {
            deleted: true,
            title: { $regex: query, $options: 'i' }
        };

        const suggestions = await mindmapsDb.collection(collectionName)
            .find(filter)
            .limit(5)
            .project({ title: 1 })
            .toArray();
        
        res.json(suggestions);

    } catch (err) {
        console.error('❌ Lỗi khi lấy gợi ý tìm kiếm thùng rác:', err);
        res.status(500).json({ error: 'Lỗi server' });
    }
};

// [GET] /dashboard/folder
exports.getFoldersPage = async (req, res) => {
    try {
        const mindmapsDb = req.app.locals.mindmapsDb;
        const usersDb = req.app.locals.usersDb;
        const userId = new ObjectId(req.session.user._id);

        const user = await userModel.findUserById(usersDb, userId);
        if (!user) {
            req.flash('error_msg', 'Không tìm thấy người dùng.');
            return res.redirect('/login');
        }

        const folders = await mindmapsDb.collection('folders')
            .find({ userId: userId })
            .sort({ name: 1 })
            .toArray();

        res.render('dashboard-folders', {
            pageTitle: 'Thư mục của bạn',
            user: user,
            folders: folders,
            currentFolder: null 
        });

    } catch (err) {
        console.error('❌ Lỗi khi tải trang thư mục:', err);
        req.flash('error_msg', 'Lỗi khi tải trang thư mục.');
        res.redirect('/dashboard');
    }
};

// [PATCH] /dashboard/folders/:id/rename
exports.renameFolder = async (req, res) => {
    try {
        const folderId = req.params.id;
        const userId = new ObjectId(req.session.user._id);
        const { name: newName } = req.body;

        if (!ObjectId.isValid(folderId)) {
            return res.status(400).json({ success: false, message: 'ID thư mục không hợp lệ.' });
        }
        if (!newName || typeof newName !== 'string' || newName.trim() === '') {
            return res.status(400).json({ success: false, message: 'Tên thư mục mới không được để trống.' });
        }
        
        const trimmedName = newName.trim();
        const folderObjectId = new ObjectId(folderId);
        const mindmapsDb = req.app.locals.mindmapsDb;

        const result = await mindmapsDb.collection('folders').updateOne(
            { _id: folderObjectId, userId: userId },
            { $set: { name: trimmedName } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thư mục hoặc bạn không có quyền sửa.' });
        }
        
        res.json({ success: true, message: 'Đổi tên thư mục thành công!', newName: trimmedName });

    } catch (err) {
        console.error('❌ Lỗi Controller renameFolder:', err);
        res.status(500).json({ success: false, message: 'Lỗi server không xác định khi đổi tên thư mục.' });
    }
};

// [DELETE] /dashboard/folders/:id
exports.deleteFolder = async (req, res) => {
    try {
        const folderId = req.params.id;
        const userId = new ObjectId(req.session.user._id);
        const mindmapCollectionName = req.session.user._id.toString();

        if (!ObjectId.isValid(folderId)) {
            return res.status(400).json({ success: false, message: 'ID thư mục không hợp lệ.' });
        }

        const folderObjectId = new ObjectId(folderId);
        const mindmapsDb = req.app.locals.mindmapsDb;

        await mindmapsDb.collection(mindmapCollectionName).updateMany(
            { folderId: folderObjectId },
            { $unset: { folderId: "" } }
        );

        const result = await mindmapsDb.collection('folders').deleteOne(
            { _id: folderObjectId, userId: userId }
        );

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thư mục hoặc bạn không có quyền xóa.' });
        }

        res.json({ success: true, message: 'Đã xóa thư mục! Các mindmap bên trong đã được chuyển ra trang chính.' });

    } catch (err) {
        console.error('❌ Lỗi Controller deleteFolder:', err);
        res.status(500).json({ success: false, message: 'Lỗi server không xác định khi xóa thư mục.' });
    }
};

