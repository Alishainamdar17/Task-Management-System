// backend/controllers/userController.js
const Task = require('../models/Task');
const User = require('../models/User');
const Workspace = require('../models/Workspace'); // <-- ensure this exists
const bcrypt = require('bcryptjs');

/**
 * GET /api/users
 * Admin-only: return members and task counts
 * Supports query params:
 *  - department (string)
 *  - ids (comma-separated IDs)
 *  - search (name or email, fuzzy)
 */
const getUsers = async (req, res) => {
  try {
    const { department, ids, search } = req.query;

    // base filter: only members (same as before)
    const filter = { role: 'member' };

    // filter by ids (if provided)
    if (ids) {
      const arr = String(ids)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (arr.length) filter._id = { $in: arr };
    }

    // filter by department (if provided)
    if (department) {
      filter.department = department;
    }

    // search by name or email
    if (search) {
      const re = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ name: re }, { email: re }];
    }

    // fetch users
    const users = await User.find(filter).select('-password').lean();
    console.log('getUsers -> matched users:', users.length);

    // Add task counts for each user (parallel)
    const usersWithTaskCount = await Promise.all(
      users.map(async (user) => {
        const uid = user._id;

        // Count documents where user is assigned.
        // Support both possible field names used in tasks ('assignedTo' or 'assignees').
        const pendingTask = await Task.countDocuments({
          $and: [{ status: 'pending' }, { $or: [{ assignedTo: uid }, { assignees: uid }] }],
        });
        const inProgressTask = await Task.countDocuments({
          $and: [{ status: 'in-progress' }, { $or: [{ assignedTo: uid }, { assignees: uid }] }],
        });
        const completedTask = await Task.countDocuments({
          $and: [{ status: 'completed' }, { $or: [{ assignedTo: uid }, { assignees: uid }] }],
        });

        return {
          ...user,
          pendingTask,
          inProgressTask,
          completedTask,
        };
      })
    );

    // return consistent object shape
    return res.json({ users: usersWithTaskCount });
  } catch (error) {
    console.error('getUsers error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/users/:id
 * Admin-only: return a single user
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({ user });
  } catch (error) {
    console.error('getUserById error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * PUT /api/users/current-workspace
 * Protected route: set current workspace for authenticated user
 * Body: { workspaceId: string }
 */
const setCurrentWorkspace = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { workspaceId } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    // optional: check user is a member or owner (adjust depending on your workspace schema)
    let isMember = false;
    if (Array.isArray(workspace.members) && workspace.members.length) {
      isMember = workspace.members.some((m) => {
        // members could be stored as ObjectId or object { user: ObjectId }
        if (typeof m === 'object' && (m.user || m.userId)) {
          const uid = m.user || m.userId;
          return String(uid) === String(userId);
        }
        return String(m) === String(userId);
      });
    }
    // allow owner or admin too
    if (!isMember && String(workspace.owner) !== String(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You are not a member of this workspace' });
    }

    // Update user document
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { currentWorkspace: workspaceId },
      { new: true }
    )
      .select('-password')
      .populate('currentWorkspace');

    return res.json({
      message: 'Current workspace updated',
      currentWorkspace: updatedUser.currentWorkspace,
      user: updatedUser,
    });
  } catch (error) {
    console.error('setCurrentWorkspace error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getUsers,
  getUserById,
  setCurrentWorkspace,
};
