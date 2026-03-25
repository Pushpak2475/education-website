// ════════════════════════════════════════════════════════════
// models/Message.js
// ════════════════════════════════════════════════════════════
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  room:       { type: String, required: true, lowercase: true },
  sender:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:       { type: String, required: true, maxlength: 1000 },
  attachment: { type: String, default: '' },
  createdAt:  { type: Date, default: Date.now }
});

MessageSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
