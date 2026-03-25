// ════════════════════════════════════════════════════════════
// routes/files.js — FILE UPLOAD / DOWNLOAD / BROWSE ROUTES
// ════════════════════════════════════════════════════════════
// This file handles everything related to notes/PYQs/files:
//
// POST   /api/files/upload         — Upload a new file
// GET    /api/files                — Get all files (with filters)
// GET    /api/files/:id            — Get single file details
// GET    /api/files/download/:id   — Download a file (increments counter)
// POST   /api/files/like/:id       — Like or unlike a file
// DELETE /api/files/:id            — Delete a file (owner or admin)
//
// WHY MULTER?
//   Express by default can't handle file uploads.
//   Multer is middleware that processes multipart/form-data
//   (the format browsers use for file uploads).
//   It saves the file to disk and gives us info about it.
// ════════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const multer  = require('multer');   // File upload handler
const path    = require('path');
const fs      = require('fs');       // Node's file system module

const File = require('../models/File');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// ════════════════════════════════════
// MULTER CONFIGURATION
// Tells multer WHERE to save files and HOW to name them
// ════════════════════════════════════

// ── Storage engine ──
// diskStorage saves files to the local file system
const storage = multer.diskStorage({

  // destination: which folder to save uploaded files into
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');

    // Create the uploads directory if it doesn't exist yet
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir); // null = no error, uploadDir = folder to use
  },

  // filename: what to name the saved file
  // We use timestamp + original name to avoid name conflicts
  filename: (req, file, cb) => {
    const timestamp  = Date.now();
    const safeName   = file.originalname.replace(/\s+/g, '_'); // Replace spaces
    cb(null, `${timestamp}_${safeName}`);
    // Example result: 1704123456789_DBMS_Unit3.pdf
  }
});

// ── File type filter ──
// Only allow certain file types for security
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',                    // PDF
    'application/msword',                 // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-powerpoint',      // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'image/jpeg',                         // JPG
    'image/png',                          // PNG
    'application/zip'                     // ZIP
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);  // Accept the file
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, ZIP allowed.'), false);
  }
};

// ── Multer instance ──
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB max file size
});

// ════════════════════════════════════════════════════════════
// POST /api/files/upload
// ── UPLOAD A NEW FILE ──
// Requires: Login (any role)
// Body (form-data): file + title + description + type + department + subject + year + semester
// ════════════════════════════════════════════════════════════
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  // upload.single('file') processes one file from the 'file' field in the form
  // After multer runs, req.file contains info about the uploaded file
  // req.body contains all the other form fields

  try {
    // ── Check that a file was actually attached ──
    if (!req.file) {
      return res.status(400).json({ message: 'Please select a file to upload' });
    }

    const { title, description, type, department, subject, year, semester, examYear } = req.body;

    // ── Validate required text fields ──
    if (!title || !type || !department || !subject || !year || !semester) {
      // Clean up the uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Title, type, department, subject, year and semester are all required' });
    }

    // ── Save file metadata to MongoDB ──
    const newFile = await File.create({
      title,
      description: description || '',
      type,
      department,
      subject,
      year,
      semester,
      examYear: examYear || '',

      // req.file is populated by multer
      fileName: req.file.originalname,
      filePath: `uploads/${req.file.filename}`,  // Relative path for serving
      fileSize: req.file.size,
      fileType: req.file.mimetype,

      // Link file to the logged-in user
      uploadedBy: req.user._id
    });

    // ── Award points to uploader for contributing ──
    // +10 points per upload to encourage sharing
    await User.findByIdAndUpdate(req.user._id, { $inc: { points: 10 } });
    // $inc is MongoDB's increment operator

    // ── Populate uploader info before sending response ──
    await newFile.populate('uploadedBy', 'name role department');

    res.status(201).json({
      message: '🎉 File uploaded successfully!',
      file: newFile
    });

  } catch (err) {
    console.error('Upload error:', err);
    // If something failed mid-way, delete the saved file to avoid orphaned files
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Upload failed: ' + err.message });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/files
// ── GET ALL FILES (with optional filters) ──
// Query params: type, department, year, semester, subject, search, page, limit
// Public — no login required (anyone can browse)
// ════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { type, department, year, semester, subject, search, page = 1, limit = 12 } = req.query;

    // ── Build a dynamic filter object ──
    // Only add fields to the filter if they were actually provided in the query
    const filter = { isApproved: true }; // Only show approved files

    if (type)       filter.type       = type;
    if (department) filter.department = department;
    if (year)       filter.year       = year;
    if (semester)   filter.semester   = semester;
    if (subject)    filter.subject    = new RegExp(subject, 'i'); // Case-insensitive partial match

    // ── Full-text search across title and description ──
    if (search) {
      filter.$or = [
        { title:       new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { subject:     new RegExp(search, 'i') }
      ];
    }

    // ── Pagination calculations ──
    const skip  = (page - 1) * limit; // How many docs to skip
    const total = await File.countDocuments(filter); // Total matching docs

    // ── Fetch files from DB ──
    const files = await File.find(filter)
      .populate('uploadedBy', 'name role department') // Replace ObjectId with user details
      .sort({ createdAt: -1 })                        // Newest first
      .skip(skip)
      .limit(Number(limit));

    res.json({
      files,
      pagination: {
        total,
        page:       Number(page),
        pages:      Math.ceil(total / limit), // Total number of pages
        hasMore:    skip + files.length < total
      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch files' });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/files/download/:id
// ── DOWNLOAD A FILE ──
// Increments the download counter and sends the file to the user
// ════════════════════════════════════════════════════════════
router.get('/download/:id', async (req, res) => {
  try {
    // ── Find the file record in DB ──
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // ── Build the full path to the file on disk ──
    const filePath = path.join(__dirname, '..', file.filePath);

    // ── Check the file actually exists on disk ──
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    // ── Increment download counter in DB ──
    // $inc: { downloadCount: 1 } adds 1 to the current value
    await File.findByIdAndUpdate(req.params.id, { $inc: { downloadCount: 1 } });

    // ── Award +2 points to uploader for each download ──
    await User.findByIdAndUpdate(file.uploadedBy, { $inc: { points: 2 } });

    // ── Send the file as a download ──
    // res.download() sets the right headers and streams the file
    res.download(filePath, file.fileName);

  } catch (err) {
    res.status(500).json({ message: 'Download failed' });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/files/like/:id
// ── LIKE or UNLIKE A FILE ──
// Requires login. Toggles like (like if not liked, unlike if already liked)
// ════════════════════════════════════════════════════════════
router.post('/like/:id', protect, async (req, res) => {
  try {
    const file   = await File.findById(req.params.id);
    const userId = req.user._id;

    if (!file) return res.status(404).json({ message: 'File not found' });

    // ── Check if user already liked this file ──
    const alreadyLiked = file.likedBy.some(id => id.toString() === userId.toString());

    if (alreadyLiked) {
      // Unlike: remove user from likedBy and decrement count
      await File.findByIdAndUpdate(req.params.id, {
        $pull: { likedBy: userId },  // $pull removes an element from array
        $inc:  { likes: -1 }
      });
      res.json({ message: 'Unliked', liked: false });
    } else {
      // Like: add user to likedBy and increment count
      await File.findByIdAndUpdate(req.params.id, {
        $addToSet: { likedBy: userId }, // $addToSet adds only if not already present
        $inc:      { likes: 1 }
      });
      // Award +1 point to uploader when someone likes their file
      await User.findByIdAndUpdate(file.uploadedBy, { $inc: { points: 1 } });
      res.json({ message: 'Liked!', liked: true });
    }

  } catch (err) {
    res.status(500).json({ message: 'Like action failed' });
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /api/files/:id
// ── DELETE A FILE ──
// Requires login. Only the uploader or admin can delete.
// ════════════════════════════════════════════════════════════
router.delete('/:id', protect, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    // ── Check ownership or admin role ──
    const isOwner = file.uploadedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this file' });
    }

    // ── Delete the actual file from disk ──
    const filePath = path.join(__dirname, '..', file.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Synchronously delete the file
    }

    // ── Delete the database record ──
    await File.findByIdAndDelete(req.params.id);

    res.json({ message: 'File deleted successfully' });

  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/files/:id
// ── GET SINGLE FILE DETAILS ──
// ════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id)
      .populate('uploadedBy', 'name role department avatar');
    if (!file) return res.status(404).json({ message: 'File not found' });
    res.json({ file });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get file' });
  }
});

module.exports = router;
