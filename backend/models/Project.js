const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['Planning','In Progress','Completed'], default: 'Planning' },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  tags: [String],
  startDate: Date,
  dueDate: Date,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);
