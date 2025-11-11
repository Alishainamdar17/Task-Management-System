// backend/controllers/userController.js
const Task = require('../models/Task');
const User = require('../models/User');
const Workspace = require('../models/Workspace'); // <-- ensure this exists
const bcrypt = require('bcryptjs');

/**
 * GET /api/users
 * Admin-only: return members and task counts
 */
const getUsers = async (req, res) => {
  try {
    // get only members (no passwords)
    const users = await User.find({ role: 'member' }).select('-password');
    console.log('getUsers -> matched users:', users.length);

    // Add task counts for each user
    const usersWithTaskCount = await Promise.all(
      users.map(async (user) => {
        const pendingTask = await Task.countDocuments({ assignedTo: user._id, status: 'pending' });
        const inProgressTask = await Task.countDocuments({ assignedTo: user._id, status: 'in-progress' });
        const completedTask = await Task.countDocuments({ assignedTo: user._id, status: 'completed' });

        return {
          ...user._doc,
          pendingTask,
          inProgressTask,
          completedTask,
        };
      })
    );

    res.json(usersWithTaskCount);
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/users/:id
 * Admin-only: return a single user
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    console.error('getUserById error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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
    ).select('-password').populate('currentWorkspace');

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
