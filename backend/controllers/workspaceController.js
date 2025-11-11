const mongoose = require('mongoose');
const Workspace = require('../models/Workspace');
const User = require('../models/User'); 

// Helper: check if a user is workspace owner
const isOwner = (workspace, userId) => {
  if (!workspace || !workspace.owner) return false;
  return String(workspace.owner) === String(userId);
};

// Helper: get member object if present
const getMemberObj = (workspace, userId) => {
  if (!Array.isArray(workspace.members)) return null;
  return workspace.members.find(m => String(m.user) === String(userId));
};

// Helper: check if user is workspace admin (owner OR member.role === 'admin')
const isWorkspaceAdmin = (workspace, userId) => {
  if (!workspace) return false;
  if (isOwner(workspace, userId)) return true;
  const member = getMemberObj(workspace, userId);
  return !!member && member.role === 'admin';
};

// ----------------------
// POST /api/workspaces
// ----------------------
const createWorkspace = async (req, res) => {
  try {
    const { name, description = '', members = [], projects = [], settings = {} } = req.body;
    if (!name) return res.status(400).json({ message: 'Workspace name is required' });

    // sanitize members input: accept array of { user, role } or array of userIds
    const normalizedMembers = Array.isArray(members) ? members.map(m => {
      if (typeof m === 'string' || mongoose.Types.ObjectId.isValid(m)) return { user: m, role: 'member' };
      if (m && m.user) return { user: m.user, role: m.role || 'member' };
      return null;
    }).filter(Boolean) : [];

    const workspaceData = {
      name,
      description,
      owner: req.user ? req.user._id : null,
      members: normalizedMembers,
      projects: Array.isArray(projects) ? projects : [],
      settings: settings || {},
    };

    const ws = await Workspace.create(workspaceData);
    const populated = await Workspace.findById(ws._id).populate('owner', 'name email').populate('members.user', 'name email');
    return res.status(201).json({ message: 'Workspace created', workspace: populated });
  } catch (err) {
    console.error('createWorkspace error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// GET /api/workspaces
// Admins: return all; otherwise return all workspaces where user is owner or member
// ----------------------
const getWorkspaces = async (req, res) => {
  try {
    // if user is admin role on req.user (your auth) — return all
    if (req.user && req.user.role === 'admin') {
      const all = await Workspace.find().populate('owner', 'name email').populate('members.user', 'name email');
      return res.json({ workspaces: all });
    }

    // else, find workspaces where owner === user OR members.user includes user
    const userId = req.user._id;
    const workspaces = await Workspace.find({
      $or: [{ owner: userId }, { 'members.user': userId }]
    }).populate('owner', 'name email').populate('members.user', 'name email');

    return res.json({ workspaces });
  } catch (err) {
    console.error('getWorkspaces error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// GET /api/workspaces/me
// Workspaces where current user is owner or member
// ----------------------
const getMyWorkspaces = async (req, res) => {
  try {
    const userId = req.user._id;
    const workspaces = await Workspace.find({
      $or: [{ owner: userId }, { 'members.user': userId }]
    }).populate('owner', 'name email').populate('members.user', 'name email');
    return res.json({ workspaces });
  } catch (err) {
    console.error('getMyWorkspaces error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// GET /api/workspaces/:id
// ----------------------
const getWorkspaceById = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .populate('projects'); // you can select fields from project if needed

    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    // authorization: allow if owner, member, or admin user
    const allowed = isOwner(ws, req.user._id) || getMemberObj(ws, req.user._id) || (req.user && req.user.role === 'admin');
    if (!allowed) return res.status(403).json({ message: 'You are not a member of this workspace' });

    return res.json({ workspace: ws });
  } catch (err) {
    console.error('getWorkspaceById error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// PUT /api/workspaces/:id
// Only owner or workspace admin can update workspace details
// ----------------------
const updateWorkspace = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    if (!isWorkspaceAdmin(ws, req.user._id) && !(req.user && req.user.role === 'admin')) {
      return res.status(403).json({ message: 'Only workspace owner or admin can update the workspace' });
    }

    const { name, description, settings, projects } = req.body;

    if (name !== undefined) ws.name = name;
    if (description !== undefined) ws.description = description;
    if (settings !== undefined) ws.settings = settings;
    if (projects !== undefined) ws.projects = Array.isArray(projects) ? projects : ws.projects;

    await ws.save();
    const populated = await Workspace.findById(ws._id).populate('owner', 'name email').populate('members.user', 'name email');
    return res.json({ message: 'Workspace updated', workspace: populated });
  } catch (err) {
    console.error('updateWorkspace error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// DELETE /api/workspaces/:id
// Only owner or global admin can delete. (Optional: allow workspace admin to delete — currently owner or admin)
// ----------------------
const deleteWorkspace = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    // allow owner or global admin to delete
    if (!isOwner(ws, req.user._id) && !(req.user && req.user.role === 'admin')) {
      return res.status(403).json({ message: 'Only workspace owner or admin can delete the workspace' });
    }

    await ws.deleteOne();
    return res.json({ message: 'Workspace deleted' });
  } catch (err) {
    console.error('deleteWorkspace error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// POST /api/workspaces/:id/members
// Body: { user: userId, role: 'member'|'admin' }
// Only workspace admin/owner or global admin can add members
// ----------------------
const addMember = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    if (!isWorkspaceAdmin(ws, req.user._id) && !(req.user && req.user.role === 'admin')) {
      return res.status(403).json({ message: 'Only workspace owner or admin can add members' });
    }

    const { user, role = 'member' } = req.body;
    if (!user || !mongoose.Types.ObjectId.isValid(user)) return res.status(400).json({ message: 'Valid user id is required' });
    if (!['member', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });

    // prevent duplicate
    const existing = getMemberObj(ws, user);
    if (existing) return res.status(400).json({ message: 'User is already a member of the workspace' });

    // optionally validate user exists
    if (User) {
      const u = await User.findById(user).select('_id name email');
      if (!u) return res.status(404).json({ message: 'User not found' });
    }

    ws.members.push({ user, role });
    await ws.save();

    const populated = await Workspace.findById(ws._id).populate('owner', 'name email').populate('members.user', 'name email');
    return res.status(201).json({ message: 'Member added', workspace: populated });
  } catch (err) {
    console.error('addMember error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// PUT /api/workspaces/:id/members/:memberUserId
// Body: { role: 'member'|'admin' }
// Only workspace owner or admin can change roles
// ----------------------
const updateMemberRole = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    if (!isWorkspaceAdmin(ws, req.user._id) && !(req.user && req.user.role === 'admin')) {
      return res.status(403).json({ message: 'Only workspace owner or admin can update member roles' });
    }

    const memberUserId = req.params.memberUserId;
    if (!mongoose.Types.ObjectId.isValid(memberUserId)) return res.status(400).json({ message: 'Invalid member user id' });

    // cannot change owner here
    if (isOwner(ws, memberUserId)) return res.status(400).json({ message: 'Cannot change role of workspace owner' });

    const member = getMemberObj(ws, memberUserId);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const { role } = req.body;
    if (!role || !['member', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });

    member.role = role;
    await ws.save();

    const populated = await Workspace.findById(ws._id).populate('owner', 'name email').populate('members.user', 'name email');
    return res.json({ message: 'Member role updated', workspace: populated });
  } catch (err) {
    console.error('updateMemberRole error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// DELETE /api/workspaces/:id/members/:memberUserId
// Only owner or workspace admin can remove members. Owner cannot remove themself (transfer ownership first).
// ----------------------
const removeMember = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    if (!isWorkspaceAdmin(ws, req.user._id) && !(req.user && req.user.role === 'admin')) {
      return res.status(403).json({ message: 'Only workspace owner or admin can remove members' });
    }

    const memberUserId = req.params.memberUserId;
    if (!mongoose.Types.ObjectId.isValid(memberUserId)) return res.status(400).json({ message: 'Invalid member user id' });

    if (isOwner(ws, memberUserId)) return res.status(400).json({ message: 'Cannot remove workspace owner. Transfer ownership first.' });

    const beforeCount = ws.members.length;
    ws.members = ws.members.filter(m => String(m.user) !== String(memberUserId));
    if (ws.members.length === beforeCount) return res.status(404).json({ message: 'Member not found' });

    await ws.save();
    const populated = await Workspace.findById(ws._id).populate('owner', 'name email').populate('members.user', 'name email');
    return res.json({ message: 'Member removed', workspace: populated });
  } catch (err) {
    console.error('removeMember error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  addMember,
  updateMemberRole,
  removeMember,
  getMyWorkspaces
};
