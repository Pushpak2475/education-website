// ════════════════════════════════════════════════════════════
// middleware/auth.js — JWT AUTHENTICATION MIDDLEWARE
// ════════════════════════════════════════════════════════════
// WHAT IS MIDDLEWARE?
//   Middleware is a function that runs BETWEEN receiving a
//   request and sending a response.
//
// WHAT IS JWT?
//   JSON Web Token — a signed string that proves who the user is.
//   When a user logs in, we give them a JWT.
//   On every protected API call, they send that JWT back.
//   We verify it here to know who is making the request.
//
// WHY IS THIS NEEDED?
//   Without this, anyone could upload files, delete data, etc.
//   This file protects routes so only logged-in users can use them.
// ════════════════════════════════════════════════════════════

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── protect ──────────────────────────────────────────────────
// Use this on any route that requires login.
// It reads the JWT from the Authorization header,
// verifies it, finds the user, and attaches them to req.user
// so the route handler knows who is making the request.
const protect = async (req, res, next) => {
  let token;

  // JWT is sent in the Authorization header as: "Bearer <token>"
  if (req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]; // Extract just the token part
  }

  // If no token provided, reject the request
  if (!token) {
    return res.status(401).json({ message: 'Not authorized — no token provided' });
  }

  try {
    // Verify the token using our secret key
    // If the token is tampered with or expired, this throws an error
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded.id is the user's MongoDB _id that we put in the token during login
    // Fetch the user from DB (excluding the password field)
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if user is banned
    if (req.user.isBanned) {
      return res.status(403).json({ message: 'Your account has been suspended' });
    }

    // All good — call next() to proceed to the actual route handler
    next();

  } catch (err) {
    return res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

// ── authorize(...roles) ────────────────────────────────────
// Use this AFTER protect to restrict routes to specific roles.
// e.g., authorize('admin') — only admin can access
// e.g., authorize('faculty', 'admin') — faculty or admin only
//
// It's a factory function that returns a middleware function.
const authorize = (...roles) => {
  return (req, res, next) => {
    // req.user is set by the protect middleware above
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    next(); // Role is allowed — continue
  };
};

// ── generateToken ─────────────────────────────────────────
// Helper function to create a JWT for a user.
// Called during login and registration.
// The token contains the user's ID and expires in 7 days.
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },              // Payload: what we store inside the token
    process.env.JWT_SECRET,      // Secret key to sign with
    { expiresIn: '7d' }          // Token expires after 7 days
  );
};

module.exports = { protect, authorize, generateToken };
