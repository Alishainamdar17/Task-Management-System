// backend/middlewares/uploadMiddleware.js
const path = require('path');
const multer = require('multer');

// storage to backend/uploads (robust absolute path)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // __dirname -> backend/middlewares, so go up one level to backend
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpeg, .jpg and .png formats are allowed'), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
