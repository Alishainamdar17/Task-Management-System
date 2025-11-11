// backend/controllers/authController.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

/* ---------------------------------------------------------
   🔐 JWT helper
--------------------------------------------------------- */
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) console.error('JWT_SECRET is not defined in .env!');
  return jwt.sign({ id: userId }, secret, { expiresIn: '7d' });
};

/* ---------------------------------------------------------
   ☎️ Phone normalization (store digits-only with country code)
   - Accepts: "+9198...", "9198...", "098...", "98..."
   - Stores: 9198XXXXXXXX (digits only, E.164 without '+')
--------------------------------------------------------- */
const DEFAULT_CC = process.env.DEFAULT_COUNTRY_CODE || '91';

function normalizePhone(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  s = s.replace(/\D/g, '');   // remove all non-digits
  s = s.replace(/^0+/, '');   // drop leading zeros

  // If 10–12 digits and no clear country code, prepend default
  if (s && s.length >= 10 && s.length <= 12 && !s.startsWith(DEFAULT_CC)) {
    s = DEFAULT_CC + s;
  }
  // basic length guard for E.164 digits (without '+')
  if (s.length < 8 || s.length > 15) return null;
  return s;
}

/* ---------------------------------------------------------
   🧱 Safe user shape
--------------------------------------------------------- */
const userResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || null,           // digits-only E.164 (no '+')
  role: user.role,
  profileImageUrl: user.profileImageUrl || '',
});

/* ---------------------------------------------------------
   🔹 Register
   POST /api/auth/register
--------------------------------------------------------- */
const registerUser = async (req, res) => {
  try {
    let { name, email, password, phone, profileImageUrl, adminInviteToken } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    email = String(email).trim().toLowerCase();

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    let role = 'member';
    if (adminInviteToken && adminInviteToken === process.env.ADMIN_INVITE_TOKEN) {
      role = 'admin';
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedPhone = normalizePhone(phone);
    if (phone && !normalizedPhone) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashed,
      phone: normalizedPhone || null,     // ✅ saved at signup
      profileImageUrl: profileImageUrl || '',
      role,
    });

    return res.status(201).json({
      message: 'User registered successfully',
      ...userResponse(user),
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error('registerUser error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ---------------------------------------------------------
   🔹 Login
   POST /api/auth/login
--------------------------------------------------------- */
const loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    email = String(email).trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    return res.json({
      message: 'Login successful',
      ...userResponse(user),
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error('loginUser error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ---------------------------------------------------------
   🔹 Get profile
   GET /api/auth/profile
--------------------------------------------------------- */
const getUserProfile = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (err) {
    console.error('getUserProfile error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ---------------------------------------------------------
   🔹 Update profile
   PUT /api/auth/profile
--------------------------------------------------------- */
const updateUserProfile = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (typeof req.body.name === 'string') user.name = req.body.name.trim();
    if (typeof req.body.email === 'string') user.email = String(req.body.email).trim().toLowerCase();
    if (typeof req.body.profileImageUrl === 'string') user.profileImageUrl = req.body.profileImageUrl;

    // ✅ phone update (normalized)
    if (typeof req.body.phone === 'string') {
      const p = normalizePhone(req.body.phone);
      if (!p) return res.status(400).json({ message: 'Invalid phone number' });
      user.phone = p;
    }

    // password update (optional)
    if (req.body.password) {
      if (String(req.body.password).length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updated = await user.save();

    return res.json({
      message: 'Profile updated successfully',
      ...userResponse(updated),
      token: generateToken(updated._id),
    });
  } catch (err) {
    console.error('updateUserProfile error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
};
