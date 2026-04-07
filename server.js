// ════════════════════════════════════════════════════════════
// server.js — MAIN SERVER FILE (Entry Point)
// ════════════════════════════════════════════════════════════
// This is the HEART of the backend.
// When you run `node server.js`, this file:
//   1. Starts the Express web server
//   2. Connects to MongoDB database
//   3. Sets up all API routes (auth, files, chat, admin)
//   4. Starts Socket.IO for real-time chat
// ════════════════════════════════════════════════════════════

// ── Load environment variables from .env file ──
// Must be called FIRST before anything else uses process.env
require('dotenv').config();

// ── Core modules ──
const express = require('express');        // Web framework
//const http = require('http');           // Node's built-in HTTP module
//const { Server } = require('socket.io');      // Real-time websocket library
const mongoose = require('mongoose');       // MongoDB ODM (Object Document Mapper)
const cors = require('cors');           // Allows frontend to call our API
const path = require('path');           // Helps build file paths

// ── Create Express app and HTTP server ──
// We wrap Express inside http.Server so Socket.IO can share the same port
const app = express();
//const server = http.createServer(app);

// ── Attach Socket.IO to the HTTP server ──
// cors: '*' means any origin can connect (fine for development)
//const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ════════════════════════════════════
// MIDDLEWARE SETUP
// Middleware runs on EVERY request before routes handle it
// ════════════════════════════════════

// Allow cross-origin requests (so the HTML frontend can call the API)
app.use(cors());

// Parse incoming JSON request bodies (e.g., login form data sent as JSON)
app.use(express.json());

// Parse URL-encoded form data (e.g., HTML form POST submissions)
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files as static files from /uploads URL
// e.g., a file at ./uploads/abc.pdf is accessible at http://localhost:5000/uploads/abc.pdf
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the frontend HTML/CSS/JS files from the /public folder
// e.g., public/index.html is served at http://localhost:5000/
app.use(express.static(path.join(__dirname, 'public')));

// ════════════════════════════════════
// DATABASE CONNECTION
// Connect to MongoDB using Mongoose
// ════════════════════════════════════
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
 //   process.exit(1); // Stop server if DB fails — nothing works without it
  });

// ════════════════════════════════════
// ROUTE IMPORTS
// Each feature has its own route file to keep code organized
// ════════════════════════════════════
const authRoutes = require('./routes/auth');      // Login, Register
const fileRoutes = require('./routes/files');     // Upload, Download, Browse
const chatRoutes = require('./routes/chat');      // Chat history
const adminRoutes = require('./routes/admin');     // Admin controls
const deptRoutes = require('./routes/departments'); // Dynamic Departments

// ════════════════════════════════════
// REGISTER ROUTES
// All auth routes will be at /api/auth/...
// All file routes will be at /api/files/...
// etc.
// ════════════════════════════════════
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/departments', deptRoutes);

// ── Health check route ──
// Visit http://localhost:5000/api/health to confirm server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EduVault server is running 🚀' });
});

// ── Catch-all: Send the frontend index.html for any unmatched route ──
// This makes client-side navigation work (e.g., refreshing /notes still loads the app)
app.get('*', (req, res) => {
  // ❌ Skip API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API route not found' });
  }

  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ════════════════════════════════════
// SOCKET.IO — REAL-TIME CHAT
// Socket.IO lets users send/receive messages instantly
// without refreshing the page (uses WebSockets)
// ════════════════════════════════════
//require('./socket/chatSocket')(io);

// ════════════════════════════════════
// START THE SERVER
// Listen on the port defined in .env (default 5000)
// ════════════════════════════════════
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 EduVault server running at http://localhost:${PORT}`);
  console.log(`📂 Uploads folder: ${process.env.UPLOAD_PATH}`);
});
