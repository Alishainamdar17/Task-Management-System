// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profileImageUrl: { type: String, default: null },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    // NEW: selected workspace
    phone: { type: String, default: null },
    currentWorkspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
    },
    department: { type: String, default: "Other" }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
