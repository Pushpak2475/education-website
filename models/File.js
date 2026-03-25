// ════════════════════════════════════════════════════════════
// models/File.js
// ════════════════════════════════════════════════════════════
const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  title:         { type: String, required: true, trim: true },
  description:   { type: String, default: '' },
  type:          { type: String, enum: ['notes','pyq','assignment','reference','lab-manual'], required: true },
  department:    { type: String, required: true },
  subject:       { type: String, required: true },
  year:          { type: String, required: true },
  semester:      { type: String, required: true },
  examYear:      { type: String, default: '' },
  fileName:      { type: String, required: true },
  filePath:      { type: String, required: true },
  fileSize:      { type: Number, default: 0 },
  fileType:      { type: String, default: '' },
  uploadedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  downloadCount: { type: Number, default: 0 },
  likes:         { type: Number, default: 0 },
  likedBy:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isApproved:    { type: Boolean, default: true },
  createdAt:     { type: Date, default: Date.now }
});

FileSchema.index({ department: 1, semester: 1, type: 1 });

module.exports = mongoose.model('File', FileSchema);
