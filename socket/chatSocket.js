// ════════════════════════════════════════════════════════════
// socket/chatSocket.js — SOCKET.IO REAL-TIME CHAT ENGINE
// ════════════════════════════════════════════════════════════
// This module is called from server.js with the io instance.
// It manages all real-time events for the chat feature.
//
// EVENTS (client → server):
//   join      — User joins a room
//   leave     — User leaves a room
//   sendMessage — User sends a message
//   typing    — User is typing (shows typing indicator)
//
// EVENTS (server → client):
//   message      — Broadcast new message to room
//   userJoined   — Notify room someone joined
//   userLeft     — Notify room someone left
//   typingStatus — Show/hide typing indicator
//   onlineCount  — Send updated online count for room
// ════════════════════════════════════════════════════════════

const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const Message = require('../models/Message');

// ── Track which users are in which rooms ──
// Structure: { roomId: Set of { socketId, userId, name, role } }
const roomUsers = {};

module.exports = (io) => {

  // ── Run on every new socket connection ──
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    let currentUser = null; // Will be set after auth
    let currentRoom = null; // Room user is currently in

    // ────────────────────────────────────────────────────────
    // EVENT: authenticate
    // Client sends their JWT token so we know who they are.
    // Called once right after connecting.
    // ────────────────────────────────────────────────────────
    socket.on('authenticate', async (token) => {
      try {
        // Verify the JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUser   = await User.findById(decoded.id).select('name role department');

        // Tell the client authentication succeeded
        socket.emit('authenticated', {
          user: { id: currentUser._id, name: currentUser.name, role: currentUser.role }
        });
      } catch (err) {
        socket.emit('authError', { message: 'Invalid token' });
      }
    });

    // ────────────────────────────────────────────────────────
    // EVENT: joinRoom
    // User wants to enter a chat room.
    // We add them to the Socket.IO room and track their presence.
    // ────────────────────────────────────────────────────────
    socket.on('joinRoom', async (roomId) => {
      // Leave the previous room first (if any)
      if (currentRoom) {
        socket.leave(currentRoom);
        removeFromRoom(currentRoom, socket.id);
        // Notify previous room that user left
        socket.to(currentRoom).emit('userLeft', {
          name: currentUser?.name || 'Someone',
          room: currentRoom
        });
      }

      // ── Join the new room ──
      socket.join(roomId);
      currentRoom = roomId;

      // ── Track this user in the room ──
      if (!roomUsers[roomId]) roomUsers[roomId] = new Map();
      if (currentUser) {
        roomUsers[roomId].set(socket.id, {
          name:       currentUser.name,
          role:       currentUser.role,
          department: currentUser.department
        });
      }

      // ── Send online count to everyone in room ──
      io.to(roomId).emit('onlineCount', {
        room:  roomId,
        count: roomUsers[roomId]?.size || 0
      });

      // ── Notify room that a new user joined ──
      if (currentUser) {
        socket.to(roomId).emit('userJoined', {
          name: currentUser.name,
          role: currentUser.role,
          room: roomId
        });
      }
    });

    // ────────────────────────────────────────────────────────
    // EVENT: sendMessage
    // User sends a chat message.
    // We save it to DB and broadcast it to everyone in the room.
    // ────────────────────────────────────────────────────────
    socket.on('sendMessage', async (data) => {
      // data = { room, text }

      // ── Basic validation ──
      if (!currentUser) {
        socket.emit('error', { message: 'Please login to send messages' });
        return;
      }
      if (!data.text || !data.text.trim()) return;
      if (data.text.length > 1000) {
        socket.emit('error', { message: 'Message too long (max 1000 characters)' });
        return;
      }

      try {
        // ── Save message to MongoDB ──
        const savedMessage = await Message.create({
          room:   data.room.toLowerCase(),
          sender: currentUser._id,
          text:   data.text.trim()
        });

        // ── Populate sender info for the broadcast ──
        await savedMessage.populate('sender', 'name role department');

        // ── Build the message payload to broadcast ──
        const messagePayload = {
          _id:       savedMessage._id,
          text:      savedMessage.text,
          room:      savedMessage.room,
          createdAt: savedMessage.createdAt,
          sender: {
            _id:        currentUser._id,
            name:       currentUser.name,
            role:       currentUser.role,
            department: currentUser.department
          }
        };

        // ── Broadcast to ALL users in the room (including sender) ──
        // io.to(room).emit() sends to everyone in the room
        io.to(data.room).emit('message', messagePayload);

      } catch (err) {
        console.error('Message save error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ────────────────────────────────────────────────────────
    // EVENT: typing
    // Broadcast typing indicator to other users in the room
    // ────────────────────────────────────────────────────────
    socket.on('typing', ({ room, isTyping }) => {
      if (!currentUser) return;
      // socket.to() sends to everyone in room EXCEPT the sender
      socket.to(room).emit('typingStatus', {
        name:     currentUser.name,
        isTyping
      });
    });

    // ────────────────────────────────────────────────────────
    // EVENT: disconnect
    // Clean up when a user disconnects (closes tab, loses internet)
    // ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);

      if (currentRoom) {
        removeFromRoom(currentRoom, socket.id);

        // Update online count for the room
        io.to(currentRoom).emit('onlineCount', {
          room:  currentRoom,
          count: roomUsers[currentRoom]?.size || 0
        });

        // Notify room
        if (currentUser) {
          socket.to(currentRoom).emit('userLeft', {
            name: currentUser.name,
            room: currentRoom
          });
        }
      }
    });

  }); // end io.on('connection')

  // ── Helper: remove user from room tracking ──
  function removeFromRoom(room, socketId) {
    if (roomUsers[room]) {
      roomUsers[room].delete(socketId);
      if (roomUsers[room].size === 0) {
        delete roomUsers[room]; // Clean up empty room
      }
    }
  }

}; // end module.exports
