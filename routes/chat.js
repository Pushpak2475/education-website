// ════════════════════════════════════════════════════════════
// routes/chat.js — CHAT HISTORY API ROUTES
// ════════════════════════════════════════════════════════════
// The real-time SENDING of messages happens via Socket.IO (see chatSocket.js).
// But we also need HTTP routes to:
//   GET /api/chat/history/:room — Load old messages when a user joins a room
//   GET /api/chat/rooms         — Get list of all available chat rooms
// ════════════════════════════════════════════════════════════

const express  = require('express');
const router   = express.Router();
const Message  = require('../models/Message');
const { protect } = require('../middleware/auth');

// ── Pre-defined chat rooms ──
// In a real app these could be stored in DB, but static is fine here
const CHAT_ROOMS = [
  { id: 'general',    name: 'General',       icon: '🌐', description: 'General college discussions' },
  { id: 'cse',        name: 'CSE',           icon: '💻', description: 'Computer Science students' },
  { id: 'ece',        name: 'ECE',           icon: '📡', description: 'Electronics students' },
  { id: 'mechanical', name: 'Mechanical',    icon: '⚙️',  description: 'Mechanical students' },
  { id: 'civil',      name: 'Civil',         icon: '🏗️',  description: 'Civil students' },
  { id: 'dsa-doubts', name: 'DSA Doubts',    icon: '🧩', description: 'Ask DSA questions' },
  { id: 'dbms-help',  name: 'DBMS Help',     icon: '🗄️',  description: 'DBMS queries' },
  { id: 'exam-prep',  name: 'Exam Prep',     icon: '📚', description: 'Exam preparation' },
  { id: 'faculty-qa', name: 'Faculty Q&A',   icon: '👨‍🏫', description: 'Faculty answers questions' }
];

// ────────────────────────────────────────────────────────────
// GET /api/chat/rooms
// Returns the list of all chat rooms
// ────────────────────────────────────────────────────────────
router.get('/rooms', (req, res) => {
  res.json({ rooms: CHAT_ROOMS });
});

// ────────────────────────────────────────────────────────────
// GET /api/chat/history/:room
// ── LOAD CHAT HISTORY FOR A ROOM ──
// Returns the last 50 messages in the room, oldest first
// Requires login (protect middleware)
// ────────────────────────────────────────────────────────────
router.get('/history/:room', protect, async (req, res) => {
  try {
    const { room } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Fetch last N messages from this room
    // Sort by createdAt ascending (-1 to get latest, then reverse) so they display chronologically
    const messages = await Message.find({ room: room.toLowerCase() })
      .populate('sender', 'name role department avatar') // Include sender's profile info
      .sort({ createdAt: -1 })   // Get newest messages
      .limit(limit)
      .then(msgs => msgs.reverse()); // Reverse so oldest is first in array

    res.json({ messages });

  } catch (err) {
    res.status(500).json({ message: 'Failed to load chat history' });
  }
});

module.exports = router;


// ════════════════════════════════════════════════════════════
// socket/chatSocket.js — REAL-TIME CHAT WITH SOCKET.IO
// ════════════════════════════════════════════════════════════
// Socket.IO enables REAL-TIME bidirectional communication.
// Unlike regular HTTP (request → response), WebSockets stay
// open so the server can PUSH messages to all connected users
// the moment someone sends a message.
//
// HOW IT WORKS:
//   1. User opens the app → connects to Socket.IO server
//   2. User joins a room  → socket.join(roomId)
//   3. User sends message → socket.emit('sendMessage', data)
//   4. Server saves to DB and broadcasts to everyone in room
//   5. All other users receive the message instantly
// ════════════════════════════════════════════════════════════

// NOTE: This content is in routes/chat.js for bundling, but
// the actual Socket module is at socket/chatSocket.js (see below)
