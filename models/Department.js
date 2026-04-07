// ════════════════════════════════════════════════════════════
// models/Department.js
// ════════════════════════════════════════════════════════════
const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Department', DepartmentSchema);
