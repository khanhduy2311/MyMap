const { ObjectId } = require('mongodb');
const userModel = require('../models/userModel.js');
const moment = require('moment'); 
// HÀM HIỆN TẠI CỦA BẠN (ĐÃ ĐƯỢC CẬP NHẬT)
exports.getDashboardPage = async (req, res) => {
    try {
        const usersDb = req.app.locals.usersDb;
        const mindmapsDb = req.app.locals.mindmapsDb;
        const userId = new ObjectId(req.session.user._id);
        const user = await userModel.findUserById(usersDb, userId);

        if (!user) {
            req.flash('error_msg', 'Không tìm thấy người dùng.');
            return res.redirect('/login');
        }
        
        // Lấy danh sách thư mục ĐỂ HIỂN THỊ SIDEBAR
        const folders = await mindmapsDb.collection('folders')
            .find({ userId: userId })
            .sort({ name: 1 }) // Sắp xếp A-Z
            .toArray();

        // --- LOGIC PHÂN TRANG VÀ TÌM KIẾM ---
        const page = parseInt(req.query.page) || 1; 
        const limit = 12; 
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || ""; 

        // SỬA LẠI FILTER: Thêm folderId: { $exists: false }
        // Để trang dashboard chính CHỈ hiển thị mindmap không thuộc thư mục nào
        const filter = {
            deleted: { $ne: true },
            folderId: { $exists: false } // QUAN TRỌNG
        };

        if (searchQuery) {
            filter.title = { $regex: searchQuery, $options: 'i' };
        }
        // ------------------------------------

        const mindmapCollectionName = req.session.user._id.toString();
        const collection = mindmapsDb.collection(mindmapCollectionName);

        const mindmaps = await collection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
        const totalMindmaps = await collection.countDocuments(filter);
        const totalPages = Math.ceil(totalMindmaps / limit);
        // ------------------------------------

        res.locals.showSearch = true; // Báo cho header hiển thị search
        res.locals.searchActionUrl = '/dashboard';
        res.locals.searchQuery = searchQuery; // Truyền query ra header

        res.render('dashboard', {
            pageTitle: 'Bảng điều khiển',
            user: user,
            mindmaps: mindmaps,
            folders: folders, // TRUYỀN THƯ MỤC RA VIEW
            currentPage: page,
            totalPages: totalPages,
            searchQuery: searchQuery,
            currentFolder: null // Đánh dấu đây là trang chính, không phải thư mục
        });

    } catch (err) {
        console.error('❌ Lỗi khi tải trang dashboard:', err);
        req.flash('error_msg', 'Lỗi khi tải trang của bạn.');
        res.redirect('/login');
    }
};

// ... (Giữ nguyên các hàm về Thùng rác) ...

// ================================================
// === THÊM MỚI CÁC HÀM DƯỚI ĐÂY VÀO CUỐI FILE ===
// ================================================

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

        // Lấy thông tin user (giữ nguyên)
        const user = await userModel.findUserById(usersDb, userId);
        if (!user) return res.redirect('/login');
        
        // 1. Lấy tất cả thư mục (để hiển thị sidebar)
        const folders = await mindmapsDb.collection('folders')
            .find({ userId: userId })
            .sort({ name: 1 })
            .toArray();

        // 2. Lấy thông tin của thư mục HIỆN TẠI
        const currentFolder = folders.find(f => f._id.equals(folderId));
        if (!currentFolder) {
            req.flash('error_msg', 'Không tìm thấy thư mục.');
            return res.redirect('/dashboard');
        }

        // 3. Phân trang & Tìm kiếm BÊN TRONG THƯ MỤC
        const page = parseInt(req.query.page) || 1; 
        const limit = 12; 
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || ""; 

        // FILTER: Lấy mindmap CÓ folderId là thư mục này
        const filter = {
            deleted: { $ne: true },
            folderId: folderId // QUAN TRỌNG
        };
        if (searchQuery) {
            filter.title = { $regex: searchQuery, $options: 'i' };
        }

        const mindmapCollectionName = req.session.user._id.toString();
        const collection = mindmapsDb.collection(mindmapCollectionName);

        const mindmaps = await collection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
        const totalMindmaps = await collection.countDocuments(filter);
        const totalPages = Math.ceil(totalMindmaps / limit);

        // 4. Render, dùng chung view dashboard.pug
        res.render('dashboard', {
            pageTitle: `Thư mục: ${currentFolder.name}`,
            user: user,
            mindmaps: mindmaps,
            folders: folders, // Danh sách tất cả thư mục
            currentPage: page,
            totalPages: totalPages,
            searchQuery: searchQuery,
            currentFolder: currentFolder // Thông tin thư mục hiện tại
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
        const { folderId } = req.body; // ID của thư mục muốn chuyển đến
        const { id: mindmapId } = req.params; // ID của mindmap
        
        if (!folderId) {
            return res.status(400).json({ success: false, message: 'Thiếu Folder ID.' });
        }

        const db = req.app.locals.mindmapsDb;
        const collectionName = req.session.user._id.toString();

        const result = await db.collection(collectionName).updateOne(
            { _id: new ObjectId(mindmapId) },
            { $set: { folderId: new ObjectId(folderId) } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap.' });
        }
        
        res.json({ success: true, message: 'Đã di chuyển mindmap!' });

    } catch (err) {
        console.error('❌ Lỗi khi di chuyển mindmap:', err);
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};


exports.getTrashPage = async (req, res) => {
    try {
        const mindmapsDb = req.app.locals.mindmapsDb;
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
                                 .sort({ deletedAt: -1 }) // <-- Sắp xếp theo ngày xóa
                                 .toArray();
        
        // === SỬA LỖI Ở ĐÂY: Bổ sung logic tính toán ===
        const mindmapsWithRemainingDays = deletedMindmaps.map(mindmap => {
            if (!mindmap.deletedAt) {
              // Xử lý dự phòng nếu mindmap không có ngày xóa
              return { ...mindmap, remainingDays: 0 };
            }
            
            // Tính ngày hết hạn (30 ngày sau khi xóa)
            const deletionDate = moment(mindmap.deletedAt);
            const expiryDate = deletionDate.add(30, 'days');
            
            // Tính số ngày còn lại (làm tròn lên)
            // Dùng max(0, ...) để đảm bảo không hiển thị số âm
            const remainingDays = Math.max(0, expiryDate.diff(moment(), 'days') + 1); 
            
            return { ...mindmap, remainingDays: remainingDays }; // Trả về object đã tính toán
        });
        // === KẾT THÚC SỬA LỖI ===
        
        res.locals.showSearch = true; 
        res.locals.searchActionUrl = '/dashboard/trash'; 
        res.locals.searchQuery = searchQuery; 

        res.render('dashboard-trash', {
            pageTitle: 'Thùng rác',
            user: req.session.user,
            mindmaps: mindmapsWithRemainingDays, // <-- Dùng biến đã xử lý
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

        // Cập nhật lại trường 'deleted' thành false
        const result = await db.collection(collectionName).updateOne(
            { _id: mindmapId },
            { $set: { deleted: false } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap để khôi phục.' });
        }

        // Trả về tín hiệu thành công
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

        // Chỉ xóa vĩnh viễn các mục CỦA USER NÀY và ĐÃ Ở TRONG THÙNG RÁC
        const result = await db.collection(collectionName).deleteOne(
            { _id: mindmapId, deleted: true } 
        );

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap trong thùng rác.' });
        }

        // Trả về tín hiệu thành công
        res.json({ success: true, message: 'Đã xóa vĩnh viễn mindmap.' });

    } catch (error) {
        console.error("Lỗi khi xóa vĩnh viễn mindmap:", error);
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

/**
 * Xóa vĩnh viễn TẤT CẢ mindmap trong thùng rác.
 * Được gọi từ nút "Dọn sạch thùng rác".
 */
exports.emptyTrash = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        const collectionName = req.session.user._id.toString();

        // Xóa TẤT CẢ các mục CỦA USER NÀY và ĐÃ Ở TRONG THÙNG RÁC
        const result = await db.collection(collectionName).deleteMany(
            { deleted: true } 
        );

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Thùng rác đã trống.' });
        }

        // Trả về tín hiệu thành công
        res.json({ success: true, message: `Đã dọn sạch ${result.deletedCount} mục.` });

    } catch (error) {
        console.error("Lỗi khi dọn sạch thùng rác:", error);
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

// [GET] /dashboard/api/search-suggestions
exports.getSearchSuggestions = async (req, res) => {
    try {
        const query = req.query.q || ""; // Lấy từ khóa tìm kiếm 'q'
        
        // Chỉ tìm khi có ít nhất 2 ký tự
        if (query.length < 2) { 
            return res.json([]);
        }

        const mindmapsDb = req.app.locals.mindmapsDb;
        const collectionName = req.session.user._id.toString();

        const filter = {
            deleted: { $ne: true },
            title: { $regex: query, $options: 'i' } // Tìm kiếm không phân biệt hoa thường
        };

        const suggestions = await mindmapsDb.collection(collectionName)
            .find(filter)
            .limit(5) // Giới hạn 5 gợi ý
            .project({ title: 1 }) // Chỉ lấy _id (mặc định) và title
            .toArray();
        
        // Trả về một mảng JSON
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

        // === THAY ĐỔI: Chỉ tìm mục ĐÃ XÓA ===
        const filter = {
            deleted: true, // Chỉ tìm trong thùng rác
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