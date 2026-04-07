// ════════════════════════════════════════════════════════════
// models/Activity.js
// ════════════════════════════════════════════════════════════
const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
    action: { type: String, required: true }, // e.g., 'upload', 'register', 'delete_file', 'change_role'
    description: { type: String, required: true }, // e.g., 'User X uploaded file Y'
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // The user who performed the action
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Activity', ActivitySchema);
