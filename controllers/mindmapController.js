const { ObjectId } = require('mongodb');
const defaultNodeStyle = {
  backgroundColor: '#fff',
  color: '#000',
  fontFamily: 'Arial',
  fontSize: 14,
  borderRadius: '8px',
  fontWeight: 'normal',
  fontStyle: 'normal',
  border: '3px solid #555',
  width: 180,
  height: 'auto',
  opacity: 1,
  lineHeight: '1.2',
  backgroundOpacity: 1,
};
const initialNodes = [
  {
    id: '1',
    type: 'custom',
    position: { x: 0, y: 0 },
    draggable: true,
    selectable: true,
    data: {
      label: 'Node Đầu Tiên',
      style: { ...defaultNodeStyle, backgroundColor: '#a2e9ff' },
    },
  },
];
// ==========================================================

// === HÀM MỚI: Logic tạo mindmap trống ===
exports.createBlankMindmap = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        const collectionName = req.session.user._id.toString();
        const { folderId } = req.body; // Nhận folderId nếu tạo trong thư mục

        const newMindmapDocument = {
            title: 'Mindmap Mới (Chưa đặt tên)',
            content: '# Mindmap Mới\n\n- Node Đầu Tiên', // Content markdown cơ bản
            nodes: initialNodes, // Trạng thái nodes/edges ban đầu
            edges: [],
            folderId: folderId && ObjectId.isValid(folderId) ? new ObjectId(folderId) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deleted: false,
            deletedAt: null
        };

        const result = await db.collection(collectionName).insertOne(newMindmapDocument);

        console.log(`✅ Đã tạo mindmap trống: ${result.insertedId} cho user ${collectionName}`);

        // Trả về ID của mindmap vừa tạo
        res.status(201).json({
            success: true,
            message: 'Đã tạo mindmap trống!',
            mindmapId: result.insertedId.toString() // Quan trọng: Trả về ID
        });

    } catch (error) {
        console.error("❌ Lỗi khi tạo mindmap trống:", error);
        res.status(500).json({ success: false, error: 'Lỗi server khi tạo mindmap.' });
    }
};
// Tạo Mindmap (Đã sửa)
exports.createMindmap = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        // === SỬA Ở ĐÂY: Nhận title và content (là markdown string) từ req.body ===
        const { title, content } = req.body;

        // Kiểm tra xem content (markdown string) có tồn tại không
        if (!content || typeof content !== 'string' || content.trim() === '') {
            console.warn("Attempted to save mindmap with empty content.");
            // Không nên redirect từ API, trả lỗi JSON
            // req.flash('error_msg', 'Không có nội dung mindmap để lưu.');
            // return res.redirect('/upload/page');
             return res.status(400).json({ error: 'Nội dung mindmap không được để trống.' });
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
        console.log(`Mindmap saved successfully for user ${collectionName}, ID: ${insertResult.insertedId}`);

        // === SỬA Ở ĐÂY: Trả về JSON báo thành công KÈM THEO redirectUrl ===
        // req.flash('success_msg', 'Mindmap đã được lưu thành công!'); // Flash message không hoạt động với fetch API
        // res.redirect('/dashboard'); // Không redirect trực tiếp từ API
        res.status(201).json({
            message: 'Mindmap đã được lưu thành công!',
            redirectUrl: '/dashboard' // Frontend sẽ dùng URL này để chuyển trang
        });

    } catch (error) {
        console.error("Lỗi khi lưu mindmap:", error);
        // req.flash('error_msg', 'Có lỗi xảy ra khi lưu mindmap.'); // Không dùng flash
        // res.redirect('/upload/page'); // Không redirect
        res.status(500).json({ error: 'Lỗi server khi lưu mindmap: ' + error.message });
    }
};

// Xem chi tiết Mindmap (Giữ nguyên)
exports.getMindmapPage = async (req, res) => {
    try {
        const db = req.app.locals.mindmapsDb;
        const mindmapId = new ObjectId(req.params.id);
        const collectionName = req.session.user._id.toString();
        // === THÊM ĐIỀU KIỆN: Chỉ tìm mindmap chưa bị xóa mềm ===
        const mindmap = await db.collection(collectionName).findOne({ _id: mindmapId, deleted: { $ne: true } });

        if (!mindmap) {
             console.log(`Mindmap not found or deleted: ID ${req.params.id} for user ${collectionName}`);
            return res.status(404).render('404', { pageTitle: 'Không tìm thấy Mindmap' });
        }

        res.render('mindmap-detail', {
            pageTitle: mindmap.title,
            mindmap: mindmap // Truyền cả object mindmap qua
        });

    } catch (error) {
         console.error(`Lỗi khi xem chi tiết mindmap ID ${req.params.id}:`, error);
         // Tránh render lỗi nếu header đã gửi
         if (!res.headersSent) {
             try {
                // Thử render trang lỗi 500 nếu có
                res.status(500).render('500', { pageTitle: 'Lỗi Server' });
             } catch (renderError) {
                 // Nếu render cũng lỗi, gửi text đơn giản
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
             console.warn(`Invalid ObjectId for deletion: ${mindmapId}`);
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
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
             console.log(`Mindmap not found or already deleted for soft delete: ID ${mindmapId}`);
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy mindmap để chuyển vào thùng rác.'
            });
        }
         console.log(`Mindmap soft deleted: ID ${mindmapId}`);
        res.json({ success: true, message: 'Đã chuyển mindmap vào thùng rác' });
    } catch (error) {
        console.error('Lỗi khi xóa mềm mindmap:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa mindmap.' });
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
             console.warn(`Invalid ObjectId for title update: ${req.params.id}`);
             return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
         }
        const collectionName = req.session.user._id.toString();
        const { title } = req.body;

        if (!title || typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({ success: false, message: 'Tên mindmap không được để trống.' });
        }
         const trimmedTitle = title.trim(); // Trim whitespace

        const result = await db.collection(collectionName).updateOne(
            // Chỉ update mindmap chưa bị xóa mềm
            { _id: mindmapObjectId, deleted: { $ne: true } },
            { $set: { title: trimmedTitle } } // Lưu tên đã trim
        );

        if (result.matchedCount === 0) { // Kiểm tra matchedCount thay vì modifiedCount để biết nó có tồn tại không
             console.log(`Mindmap not found or deleted for title update: ID ${req.params.id}`);
             return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap hoặc mindmap đã ở trong thùng rác.' });
         }
         if (result.modifiedCount === 0) {
            // Tìm thấy nhưng không có gì thay đổi (tên giống hệt)
            return res.json({ success: true, message: 'Tên không có gì thay đổi.', newTitle: trimmedTitle });
         }

         console.log(`Mindmap title updated: ID ${req.params.id} to "${trimmedTitle}"`);
        res.json({ success: true, message: 'Cập nhật tên thành công!', newTitle: trimmedTitle });

    } catch (error) {
        console.error("Lỗi khi cập nhật tên mindmap qua API:", error);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật tên.' });
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
        console.error("Lỗi khi lấy danh sách thùng rác:", error);
        res.status(500).render('500', { pageTitle: 'Lỗi Server' }); // Hoặc gửi lỗi
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
        catch (error) { return res.status(400).json({ success: false, message: 'ID không hợp lệ' }); }

        const result = await db.collection(collectionName).updateOne(
            { _id: mindmapObjectId, deleted: true }, // Chỉ khôi phục cái đã xóa
            { $set: { deleted: false, deletedAt: null } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap trong thùng rác hoặc đã được khôi phục.' });
        }
        res.json({ success: true, message: 'Khôi phục mindmap thành công!' });
    } catch (error) {
        console.error('Lỗi khi khôi phục mindmap:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi khôi phục.' });
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
        catch (error) { return res.status(400).json({ success: false, message: 'ID không hợp lệ' }); }

        const result = await db.collection(collectionName).deleteOne(
            { _id: mindmapObjectId, deleted: true } // Chỉ xóa vĩnh viễn cái đã ở thùng rác
        );

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap trong thùng rác.' });
        }
        res.json({ success: true, message: 'Đã xóa vĩnh viễn mindmap.' });
    } catch (error) {
        console.error('Lỗi khi xóa vĩnh viễn mindmap:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa vĩnh viễn.' });
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
        console.warn(`Invalid ObjectId for data update: ${req.params.id}`);
        return res.status(400).json({ success: false, message: 'ID mindmap không hợp lệ.' });
    }

    // Lấy dữ liệu nodes và edges từ body của request (React gửi lên)
    const { nodes, edges } = req.body;

    // --- 2. Validate Dữ liệu (Cơ bản) ---
    // Kiểm tra xem nodes và edges có phải là mảng không (có thể thêm kiểm tra kỹ hơn)
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
        console.warn(`Invalid data format received for mindmap ${req.params.id}: nodes or edges are not arrays.`);
        return res.status(400).json({ success: false, message: 'Dữ liệu gửi lên không đúng định dạng (nodes và edges phải là mảng).' });
    }

    // --- 3. Cập nhật Database ---
    try {
        const result = await db.collection(collectionName).updateOne(
            { _id: mindmapObjectId, deleted: { $ne: true } }, // Chỉ cập nhật mindmap chưa bị xóa
            {
                $set: {
                    nodes: nodes,       // Lưu mảng nodes
                    edges: edges,       // Lưu mảng edges
                    updatedAt: new Date() // Cập nhật thời gian sửa đổi
                }
            }
        );

        // --- 4. Gửi Phản hồi ---
        if (result.matchedCount === 0) {
            console.log(`Mindmap not found or deleted for data update: ID ${req.params.id}`);
            return res.status(404).json({ success: false, message: 'Không tìm thấy mindmap hoặc mindmap đã ở trong thùng rác.' });
        }

        if (result.modifiedCount === 0) {
            // Tìm thấy nhưng không có gì thay đổi (dữ liệu giống hệt)
            console.log(`Mindmap data unchanged: ID ${req.params.id}`);
            return res.json({ success: true, message: 'Dữ liệu mindmap không thay đổi.', updated: false });
        }

        console.log(`Mindmap data updated successfully: ID ${req.params.id}`);
        res.json({ success: true, message: 'Đã lưu sơ đồ thành công!', updated: true });

    } catch (error) {
        console.error("Lỗi khi cập nhật dữ liệu mindmap:", error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lưu sơ đồ.' });
    }
};