// backend/models/AuthDoc.js
const mongoose = require('mongoose');

const AuthDocSchema = new mongoose.Schema({
  filename: { type: String, required: true, unique: true },
  data: { type: Buffer, required: true },
  updatedAt: { type: Date, default: Date.now }
});

AuthDocSchema.index({ updatedAt: 1 });

module.exports = mongoose.model('AuthDoc', AuthDocSchema);
