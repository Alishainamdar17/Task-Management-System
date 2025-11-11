// backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { getUsers, getUserById, setCurrentWorkspace } = require('../controllers/userController');
const { protect, adminOnly } = require('../middlewares/authMiddleware'); // adjust to your middleware

// Admin-only
router.get('/', protect, adminOnly, getUsers);
router.get('/:id', protect, adminOnly, getUserById);



module.exports = router;
