// ════════════════════════════════════════════════════════════
// models/User.js
// ════════════════════════════════════════════════════════════
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true, minlength: 6 },
  role:       { type: String, enum: ['student','faculty','admin'], default: 'student' },
  department: { type: String, default: '' },
  year:       { type: String, default: '' },
  semester:   { type: String, default: '' },
  avatar:     { type: String, default: '' },
  points:     { type: Number, default: 0 },
  isApproved: { type: Boolean, default: true },
  isBanned:   { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.matchPassword = async function(entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', UserSchema);
