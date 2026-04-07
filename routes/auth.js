// ════════════════════════════════════════════════════════════
// routes/auth.js — AUTHENTICATION ROUTES
// ════════════════════════════════════════════════════════════
// Handles user registration and login.
//
// POST /api/auth/register — Create a new account
// POST /api/auth/login    — Log in and get a JWT token
// GET  /api/auth/me       — Get the currently logged-in user's info
// ════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Activity = require('../models/Activity');
const { protect, generateToken } = require('../middleware/auth');

// ────────────────────────────────────────────────────────────
// POST /api/auth/register
// ── REGISTER A NEW USER ──
// Accepts: { name, email, password, role, department, year, semester }
// Returns: { user info + JWT token }
// ────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, department, year, semester } = req.body;

    // ── Validate required fields ──
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    // ── Check if email is already registered ──
    // We don't want two accounts with the same email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered. Please login.' });
    }

    // ── Create the new user document ──
    // Password will be hashed automatically by the pre-save hook in User model
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'student',  // Default to student if not specified
      department: department || '',
      year: year || '',
      semester: semester || ''
    });

    // ── Generate a JWT token for this user ──
    // This token is what they'll use to authenticate future requests
    const token = generateToken(user._id);

    // ── Log this activity for admins ──
    await Activity.create({
      action: 'register',
      description: `New user registered: ${user.name} (${user.role})`,
      user: user._id
    });

    // ── Send back user info + token ──
    // Note: we never send the password back, even hashed
    res.status(201).json({
      message: 'Registration successful! Welcome to EduVault 🎓',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        year: user.year,
        semester: user.semester,
        points: user.points
      }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/auth/login
// ── LOG IN AN EXISTING USER ──
// Accepts: { email, password }
// Returns: { user info + JWT token }
// ────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Validate inputs ──
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // ── Find the user by email ──
    // We need to explicitly select password because in the schema we can hide it
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // ── Check if user is banned ──
    if (user.isBanned) {
      return res.status(403).json({ message: 'Your account has been suspended. Contact admin.' });
    }

    // ── Verify the password ──
    // matchPassword() uses bcrypt to compare entered password with the stored hash
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // ── Generate JWT token ──
    const token = generateToken(user._id);

    // ── Send back user info + token ──
    res.json({
      message: `Welcome back, ${user.name}! 👋`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        year: user.year,
        semester: user.semester,
        points: user.points
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/auth/me
// ── GET CURRENT USER PROFILE ──
// Requires: Authorization: Bearer <token> header
// Returns: logged-in user's full profile
// ────────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  // req.user is set by the protect middleware — no DB query needed again
  res.json({ user: req.user });
});

// ────────────────────────────────────────────────────────────
// PUT /api/auth/update-profile
// ── UPDATE USER PROFILE ──
// Allows logged-in user to update their name, department, etc.
// ────────────────────────────────────────────────────────────
router.put('/update-profile', protect, async (req, res) => {
  try {
    const { name, department, year, semester } = req.body;

    // Update only the fields that were provided
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,                         // Find user by their ID
      { name, department, year, semester }, // Fields to update
      { new: true, select: '-password' }    // Return updated doc, hide password
    );

    res.json({ message: 'Profile updated successfully!', user: updatedUser });

  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

module.exports = router;
