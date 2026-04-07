// ════════════════════════════════════════════════════════════
// routes/admin.js — ADMIN PANEL API ROUTES
// ════════════════════════════════════════════════════════════
// ALL routes here require: logged in + role === 'admin'
// The protect + authorize('admin') middleware enforces this.
//
// GET  /api/admin/stats        — Dashboard stats (users, files, etc.)
// GET  /api/admin/users        — List all users
// PUT  /api/admin/users/:id    — Update user (ban, change role)
// GET  /api/admin/files        — List all files (including unapproved)
// PUT  /api/admin/files/:id    — Approve or reject a file
// DELETE /api/admin/files/:id  — Force delete any file
// ════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const User = require('../models/User');
const File = require('../models/File');
const Message = require('../models/Message');
const { protect, authorize } = require('../middleware/auth');

// ── Apply authentication + admin-only restriction to ALL routes below ──
// router.use() applies middleware to every route in this file
router.use(protect);               // Must be logged in
router.use(authorize('admin'));    // Must have admin role

// ════════════════════════════════════════════════════════════
// GET /api/admin/stats
// ── DASHBOARD OVERVIEW STATS ──
// ════════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    // Run all DB count queries in parallel using Promise.all for speed
    const [
      totalUsers,
      totalFiles,
      totalMessages,
      pendingFiles,
      bannedUsers,
      filesByType,
      filesByDept,
      recentUsers,
      recentFiles
    ] = await Promise.all([
      User.countDocuments(),                            // Total registered users
      File.countDocuments(),                            // Total files
      Message.countDocuments(),                         // Total messages sent
      File.countDocuments({ isApproved: false }),       // Files awaiting approval
      User.countDocuments({ isBanned: true }),          // Banned users
      // Group files by type and count each
      File.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      // Group files by department and count each
      File.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } }
      ]),
      // 5 most recently registered users
      User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt'),
      // 5 most recently uploaded files
      File.find().sort({ createdAt: -1 }).limit(5).populate('uploadedBy', 'name role')
    ]);

    res.json({
      stats: {
        totalUsers,
        totalFiles,
        totalMessages,
        pendingFiles,
        bannedUsers,
        filesByType,
        filesByDept
      },
      recentUsers,
      recentFiles
    });

  } catch (err) {
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/admin/users
// ── LIST ALL USERS ──
// ════════════════════════════════════════════════════════════
router.get('/users', async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;

    // Build filter
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    const users = await User.find(filter)
      .select('-password') // Never send passwords
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    res.json({ users, total });

  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// ════════════════════════════════════════════════════════════
// PUT /api/admin/users/:id
// ── UPDATE A USER (ban/unban, change role) ──
// ════════════════════════════════════════════════════════════
router.put('/users/:id', async (req, res) => {
  try {
    const { isBanned, role } = req.body;
    const updates = {};

    // Only update fields that were provided
    if (isBanned !== undefined) updates.isBanned = isBanned;
    if (role) updates.role = role;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, select: '-password' }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    const action = isBanned ? 'banned' : (isBanned === false ? 'unbanned' : 'updated');
    res.json({ message: `User ${action} successfully`, user });

  } catch (err) {
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/admin/files
// ── LIST ALL FILES (including unapproved) ──
// ════════════════════════════════════════════════════════════
router.get('/files', async (req, res) => {
  try {
    const { isApproved, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';

    const files = await File.find(filter)
      .populate('uploadedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await File.countDocuments(filter);
    res.json({ files, total });

  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch files' });
  }
});

// ════════════════════════════════════════════════════════════
// PUT /api/admin/files/:id
// ── APPROVE or REJECT a file ──
// ════════════════════════════════════════════════════════════
router.put('/files/:id', async (req, res) => {
  try {
    const { isApproved } = req.body;

    const file = await File.findByIdAndUpdate(
      req.params.id,
      { isApproved },
      { new: true }
    );

    if (!file) return res.status(404).json({ message: 'File not found' });

    res.json({
      message: `File ${isApproved ? 'approved ✅' : 'rejected ❌'}`,
      file
    });

  } catch (err) {
    res.status(500).json({ message: 'Failed to update file' });
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /api/admin/files/:id
// ── FORCE DELETE ANY FILE (admin only) ──
// ════════════════════════════════════════════════════════════
router.delete('/files/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    // Delete from disk
    const filePath = path.join(__dirname, '..', file.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Delete from DB
    await File.findByIdAndDelete(req.params.id);

    res.json({ message: 'File deleted by admin' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete file' });
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /api/admin/chat/:id
// ── DELETE A SPECIFIC CHAT MESSAGE ──
// ════════════════════════════════════════════════════════════
router.delete('/chat/:id', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    await Message.findByIdAndDelete(req.params.id);
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete message' });
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /api/admin/chat/clear/:room
// ── CLEAR ENTIRE CHAT ROOM ──
// ════════════════════════════════════════════════════════════
router.delete('/chat/clear/:room', async (req, res) => {
  try {
    const { room } = req.params;
    await Message.deleteMany({ room: room.toLowerCase() });
    res.json({ message: `Room ${room} cleared` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to clear room' });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/admin/activity
// ── FETCH GLOBAL ACTIVITY LOG ──
// ════════════════════════════════════════════════════════════
const Activity = require('../models/Activity');
router.get('/activity', async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate('user', 'name role')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ activities });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch activity log' });
  }
});

// ════════════════════════════════════════════════════════════
// DEPARTMENT MANAGEMENT
// ════════════════════════════════════════════════════════════
const Department = require('../models/Department');

router.post('/departments', async (req, res) => {
  try {
    const { name, code } = req.body;
    const dept = await Department.create({ name, code });
    res.status(201).json({ message: 'Department added', dept });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Department name or code already exists' });
    res.status(500).json({ message: 'Failed to add department' });
  }
});

router.put('/departments/:id', async (req, res) => {
  try {
    const { name, code } = req.body;
    const dept = await Department.findByIdAndUpdate(req.params.id, { name, code }, { new: true });
    if (!dept) return res.status(404).json({ message: 'Department not found' });
    res.json({ message: 'Department updated', dept });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update department' });
  }
});

router.delete('/departments/:id', async (req, res) => {
  try {
    const dept = await Department.findByIdAndDelete(req.params.id);
    if (!dept) return res.status(404).json({ message: 'Department not found' });
    res.json({ message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete department' });
  }
});

module.exports = router;
