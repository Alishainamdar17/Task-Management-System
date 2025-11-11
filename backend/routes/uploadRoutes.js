// backend/routes/uploadRoutes.js
const express = require('express');
const path = require('path');
const upload = require('../middlewares/uploadMiddleware'); // adjust path if different
const router = express.Router();

// POST /api/upload
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const filename = req.file.filename;
  // return full public URL the frontend can use directly
  const publicUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;

  return res.json({ imageUrl: publicUrl });
});

module.exports = router;
