// File: models/mindmap.model.js
const mongoose = require('mongoose');

const mindmapSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: Object,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

const Mindmap = mongoose.model('Mindmap', mindmapSchema);

module.exports = Mindmap;