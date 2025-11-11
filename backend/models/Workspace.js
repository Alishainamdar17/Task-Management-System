// backend/models/Workspace.js
const mongoose = require('mongoose');

const WorkspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },

    // Owner (creator) of the workspace
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },

    // Members: array of user ObjectIds or objects { user: ObjectId, role: 'member' }
    members: [
      {
        // allow either direct ObjectId or object with user ref
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["member", "admin"], default: "member" },
      },
    ],

    // optional meta fields
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    settings: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Workspace", WorkspaceSchema);
