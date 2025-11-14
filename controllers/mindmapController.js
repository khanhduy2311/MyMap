const { ObjectId } = require('mongodb');
const { ok, fail } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// Tạo Mindmap (Đã sửa)
exports.createMindmap = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        // === SỬA Ở ĐÂY: Nhận title và content (là markdown string) từ req.body ===
        const { title, content } = req.body;

        // Kiểm tra xem content (markdown string) có tồn tại không
        if (!content || typeof content !== 'string' || content.trim() === '') {
            logger.warn('Attempted to save mindmap with empty content', { userId: req.session.user._id });
            return fail(res, 400, 'EMPTY_CONTENT', 'Nội dung mindmap không được để trống.');
        }

        // Collection name dựa trên user ID
        const collectionName = req.session.user._id.toString();

        // Tạo document để lưu vào DB
        const newMindmapDocument = {
            title: title || 'Mindmap không có tiêu đề', // Lấy title từ req.body hoặc đặt mặc định
            content: content,                         // Lưu markdown string vào content
            createdAt: new Date(),
            deleted: false, // Thêm trạng thái deleted mặc định
            deletedAt: null
        };

        const insertResult = await db.collection(collectionName).insertOne(newMindmapDocument);
        logger.info('Mindmap saved successfully', { 
            userId: collectionName, 
            mindmapId: insertResult.insertedId 
        });

        res.status(201).json({
            success: true,
            data: {
                mindmapId: insertResult.insertedId,
                redirectUrl: '/dashboard'
            },
            message: 'Mindmap đã được lưu thành công!'
        });

    } catch (error) {
        logger.error('Lỗi khi lưu mindmap', { error, userId: req.session.user._id });
        return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi server khi lưu mindmap.');
    }
};

// Xem chi tiết Mindmap với authorization check
exports.getMindmapPage = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        const mindmapId = new ObjectId(req.params.id);
        const collectionName = req.session.user._id.toString();
        
        // Authorization: mindmap phải thuộc collection của user hiện tại
        const mindmap = await db.collection(collectionName).findOne({ 
            _id: mindmapId, 
            deleted: { $ne: true } 
        });

        if (!mindmap) {
            logger.warn('Mindmap access denied or not found', { 
                mindmapId: req.params.id, 
                userId: collectionName 
            });
            return res.status(404).render('404', { pageTitle: 'Không tìm thấy Mindmap' });
        }

        res.render('mindmap-detail', {
            pageTitle: mindmap.title,
            mindmap: mindmap // Truyền cả object mindmap qua
        });

    } catch (error) {
        logger.error('Lỗi khi xem chi tiết mindmap', { 
            error, 
            mindmapId: req.params.id, 
            userId: req.session.user._id 
        });
        if (!res.headersSent) {
            try {
                res.status(500).render('500', { pageTitle: 'Lỗi Server' });
            } catch (renderError) {
                res.status(500).send("Lỗi server khi truy cập chi tiết mindmap.");
            }
        }
    }
};


// Xóa Mindmap (Soft delete - Giữ nguyên logic soft delete)
exports.deleteMindmap = async (req, res) => {
    const db = req.app.locals.mindmapsDb;
    try {
        const mindmapId = req.params.id;
        const collectionName = req.session.user._id.toString();
        let mindmapObjectId;
        try {
            mindmapObjectId = new ObjectId(mindmapId);
        } catch (error) {
            logger.warn('Invalid ObjectId for deletion', { mindmapId });
            return fail(res, 400, 'INVALID_ID', 'ID không hợp lệ');
        }

        const result = await db.collection(collectionName).updateOne(
            { _id: mindmapObjectId },
            {
                $set: {
                    deleted: true,
                    deletedAt: new Date()
                }
            }
        );

        if (result.modifiedCount === 0) {
            logger.warn('Mindmap not found for soft delete', { mindmapId, userId: collectionName });
            return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy mindmap để chuyển vào thùng rác.');
        }
        
        logger.info('Mindmap soft deleted', { mindmapId, userId: collectionName });
        return ok(res, { message: 'Đã chuyển mindmap vào thùng rác' });
    } catch (error) {
        logger.error('Lỗi khi xóa mềm mindmap', { error, mindmapId, userId: collectionName });
        return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi server khi xóa mindmap.');
    }
};


// Cập nhật tên Mindmap qua API (Giữ nguyên)
exports.updateMindmapTitleAPI = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        let mindmapObjectId;
        try {
            mindmapObjectId = new ObjectId(req.params.id);
        } catch (error) {
            logger.warn('Invalid ObjectId for title update', { mindmapId: req.params.id });
            return fail(res, 400, 'INVALID_ID', 'ID không hợp lệ.');
        }
        const collectionName = req.session.user._id.toString();
        const { title } = req.body;

        if (!title || typeof title !== 'string' || title.trim() === '') {
            return fail(res, 400, 'INVALID_TITLE', 'Tên mindmap không được để trống.');
        }
         const trimmedTitle = title.trim(); // Trim whitespace

        const result = await db.collection(collectionName).updateOne(
            // Chỉ update mindmap chưa bị xóa mềm
            { _id: mindmapObjectId, deleted: { $ne: true } },
            { $set: { title: trimmedTitle } } // Lưu tên đã trim
        );

        if (result.matchedCount === 0) {
            logger.warn('Mindmap not found for title update', { mindmapId: req.params.id, userId: collectionName });
            return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy mindmap hoặc mindmap đã ở trong thùng rác.');
        }
        if (result.modifiedCount === 0) {
            return ok(res, { message: 'Tên không có gì thay đổi.', newTitle: trimmedTitle });
        }

        logger.info('Mindmap title updated', { mindmapId: req.params.id, newTitle: trimmedTitle, userId: collectionName });
        return ok(res, { message: 'Cập nhật tên thành công!', newTitle: trimmedTitle });

    } catch (error) {
        logger.error('Lỗi khi cập nhật tên mindmap', { error, mindmapId: req.params.id, userId: collectionName });
        return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi server khi cập nhật tên.');
    }
};

// Thêm hàm lấy danh sách mindmap đã xóa (Thùng rác)
exports.getTrashPage = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        const collectionName = req.session.user._id.toString();
        const deletedMindmaps = await db.collection(collectionName)
            .find({ deleted: true })
            .sort({ deletedAt: -1 }) // Sắp xếp theo ngày xóa mới nhất
            .toArray();

        res.render('trash', { // Tạo file view 'trash.pug'
            pageTitle: 'Thùng rác',
            mindmaps: deletedMindmaps,
            moment: require('moment') // Truyền moment để format ngày tháng
        });
    } catch (error) {
        logger.error('Lỗi khi lấy danh sách thùng rác', { error, userId: collectionName });
        res.status(500).render('500', { pageTitle: 'Lỗi Server' });
    }
};

// Thêm hàm khôi phục mindmap từ thùng rác
exports.restoreMindmap = async (req, res) => {
    const db = req.app.locals.mindmapsDb;
    try {
        const mindmapId = req.params.id;
        const collectionName = req.session.user._id.toString();
        let mindmapObjectId;
        try { mindmapObjectId = new ObjectId(mindmapId); }
        catch (error) { 
            logger.warn('Invalid ObjectId for restore', { mindmapId });
            return fail(res, 400, 'INVALID_ID', 'ID không hợp lệ'); 
        }

        const result = await db.collection(collectionName).updateOne(
            { _id: mindmapObjectId, deleted: true },
            { $set: { deleted: false, deletedAt: null } }
        );

        if (result.modifiedCount === 0) {
            logger.warn('Mindmap not found in trash for restore', { mindmapId, userId: collectionName });
            return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy mindmap trong thùng rác hoặc đã được khôi phục.');
        }
        
        logger.info('Mindmap restored', { mindmapId, userId: collectionName });
        return ok(res, { message: 'Khôi phục mindmap thành công!' });
    } catch (error) {
        logger.error('Lỗi khi khôi phục mindmap', { error, mindmapId, userId: collectionName });
        return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi server khi khôi phục.');
    }
};

// Thêm hàm xóa vĩnh viễn mindmap
exports.deleteMindmapPermanently = async (req, res) => {
    const db = req.app.locals.mindmapsDb;
    try {
        const mindmapId = req.params.id;
        const collectionName = req.session.user._id.toString();
        let mindmapObjectId;
        try { mindmapObjectId = new ObjectId(mindmapId); }
        catch (error) { 
            logger.warn('Invalid ObjectId for permanent deletion', { mindmapId });
            return fail(res, 400, 'INVALID_ID', 'ID không hợp lệ'); 
        }

        const result = await db.collection(collectionName).deleteOne(
            { _id: mindmapObjectId, deleted: true }
        );

        if (result.deletedCount === 0) {
            logger.warn('Mindmap not found in trash for permanent deletion', { mindmapId, userId: collectionName });
            return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy mindmap trong thùng rác.');
        }
        
        logger.info('Mindmap permanently deleted', { mindmapId, userId: collectionName });
        return ok(res, { message: 'Đã xóa vĩnh viễn mindmap.' });
    } catch (error) {
        logger.error('Lỗi khi xóa vĩnh viễn mindmap', { error, mindmapId, userId: collectionName });
        return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi server khi xóa vĩnh viễn.');
    }
};

// === THÊM MỚI: Hàm xử lý lưu dữ liệu mindmap (nodes, edges) từ React ===
exports.updateMindmapData = async (req, res) => {
    const db = req.app.locals.mindmapsDb;
    const collectionName = req.session.user._id.toString(); // Lấy collection dựa trên user ID
    let mindmapObjectId;

    // --- 1. Lấy ID và Dữ liệu ---
    try {
        mindmapObjectId = new ObjectId(req.params.id);
    } catch (error) {
        logger.warn('Invalid ObjectId for data update', { mindmapId: req.params.id });
        return fail(res, 400, 'INVALID_ID', 'ID mindmap không hợp lệ.');
    }

    // Lấy dữ liệu nodes và edges từ body của request (React gửi lên)
    const { nodes, edges, thumbnailUrl } = req.body;

    // --- 2. Validate Dữ liệu (Cơ bản) ---
    // Kiểm tra xem nodes và edges có phải là mảng không (có thể thêm kiểm tra kỹ hơn)
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
        logger.warn('Invalid data format for mindmap update', { mindmapId: req.params.id, userId: collectionName });
        return fail(res, 400, 'INVALID_FORMAT', 'Dữ liệu gửi lên không đúng định dạng (nodes và edges phải là mảng).');
    }

    if (thumbnailUrl && typeof thumbnailUrl !== 'string') {
         console.warn(`Invalid thumbnailUrl format received for mindmap ${req.params.id}`);
         // Không chặn request, nhưng có thể bỏ qua việc lưu URL nếu nó không hợp lệ
         // Hoặc trả lỗi nếu thumbnailUrl là bắt buộc
         // return res.status(400).json({ success: false, message: 'Định dạng URL thumbnail không hợp lệ.' });
    }

    // --- 3. Cập nhật Database ---
    try {
        // Tạo đối tượng $set động để chỉ cập nhật thumbnailUrl nếu nó được gửi lên
        const updateFields = {
            nodes: nodes,
            edges: edges,
            updatedAt: new Date()
        };
        // Chỉ thêm thumbnailUrl vào $set nếu nó tồn tại và là string
        if (thumbnailUrl && typeof thumbnailUrl === 'string') {
            updateFields.thumbnailUrl = thumbnailUrl; // <<<--- THÊM thumbnailUrl VÀO ĐÂY
        } else {
             console.log(`ThumbnailUrl not provided or invalid for mindmap ${req.params.id}, skipping update.`);
        }


        const result = await db.collection(collectionName).updateOne(
            { _id: mindmapObjectId, deleted: { $ne: true } },
            {
                $set: updateFields // <<<--- SỬ DỤNG ĐỐI TƯỢNG updateFields
            }
        );

        if (result.matchedCount === 0) {
            logger.warn('Mindmap not found for data update', { mindmapId: req.params.id, userId: collectionName });
            return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy mindmap hoặc mindmap đã ở trong thùng rác.');
        }

        if (result.modifiedCount === 0 && result.upsertedCount === 0) {
            logger.info('Mindmap data unchanged', { mindmapId: req.params.id, userId: collectionName });
            return ok(res, { message: 'Dữ liệu mindmap không thay đổi.', updated: false });
        }

        logger.info('Mindmap data updated successfully', { 
            mindmapId: req.params.id, 
            userId: collectionName,
            hasThumbnail: !!updateFields.thumbnailUrl 
        });
        return ok(res, { message: 'Đã lưu sơ đồ thành công!', updated: true });

    } catch (error) {
        logger.error('Lỗi khi cập nhật dữ liệu mindmap', { error, mindmapId: req.params.id, userId: collectionName });
        return fail(res, 500, 'INTERNAL_ERROR', 'Lỗi server khi lưu sơ đồ.');
    }
};