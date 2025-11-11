const mongoose = require('mongoose');
const { Schema } = mongoose;

const ChecklistItemSchema = new Schema({
  text: { type: String, required: true },
  completed: { type: Boolean, default: false },
}, { _id: false });

const TaskSchema = new Schema({
  title: { type: String, required: true },
  subtitle: String,
  description: String,
  priority: { type: String, default: 'Medium' },
  dueDate: Date,
  assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  todoChecklist: { type: [ChecklistItemSchema], default: [] }, // important
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace' },
  project: { type: Schema.Types.ObjectId, ref: 'Project' },
  attachments: { type: Array, default: [] },

  // 👇 NEW: WhatsApp reminder flag so we don't send twice
  reminderSent: { type: Boolean, default: false },
}, { timestamps: true, strict: true });

// helpful index for the cron query: due in 2 days & not sent yet
TaskSchema.index({ dueDate: 1, reminderSent: 1 });

// Optional: ensure toObject/toJSON includes everything
TaskSchema.set('toJSON', { virtuals: true });
TaskSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Task', TaskSchema);
