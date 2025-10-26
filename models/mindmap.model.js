const mongoose = require('mongoose');

const mindmapSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: { // Có thể bạn có hoặc không có trường này
        type: String,
        trim: true
    },
    // === THÊM TRƯỜNG MỚI NÀY ===
    thumbnailUrl: {
        type: String,
        default: '/images/default-mindmap-thumbnail.png' // Giá trị mặc định
    },
    // === KẾT THÚC THÊM MỚI ===
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // ... các trường khác như visibility, collaborators ...
}, {
    timestamps: true // Tự động thêm createdAt và updatedAt
});

const Mindmap = mongoose.model('Mindmap', mindmapSchema);

module.exports = Mindmap;