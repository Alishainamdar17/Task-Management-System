const mongoose = require('mongoose');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const User = require('../models/User'); // optional: used to validate user existence

// helpers
const isWorkspaceOwner = (workspace, userId) => {
  if (!workspace || !workspace.owner) return false;
  return String(workspace.owner) === String(userId);
};
const workspaceHasMember = (workspace, userId) => {
  if (!workspace) return false;
  return Array.isArray(workspace.members) && workspace.members.some(m => String(m.user) === String(userId) || String(m) === String(userId));
};
const isWorkspaceAdmin = (workspace, userId) => {
  if (!workspace) return false;
  if (isWorkspaceOwner(workspace, userId)) return true;
  if (!Array.isArray(workspace.members)) return false;
  const mem = workspace.members.find(m => String(m.user) === String(userId) || String(m) === String(userId));
  return !!mem && mem.role === 'admin';
};
const isProjectMember = (project, userId) => {
  if (!project) return false;
  return Array.isArray(project.members) && project.members.some(m => String(m) === String(userId));
};

// validate status against schema enum
const VALID_STATUSES = new Set(['Planning', 'In Progress', 'Completed']);

// ----------------------
// POST /api/projects
// Create a project — only allowed if workspace exists and user is member/admin of workspace
// ----------------------
const createProject = async (req, res) => {
  try {
    const { title, description = '', status, workspace, tags = [], startDate, dueDate, members = [] } = req.body;

    if (!title) return res.status(400).json({ message: 'Project title is required' });
    if (!workspace || !mongoose.Types.ObjectId.isValid(workspace)) return res.status(400).json({ message: 'Valid workspace id is required' });

    const ws = await Workspace.findById(workspace);
    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    // authorization: user must be workspace member/admin/owner or global admin
    const isAllowed = req.user && (req.user.role === 'admin' || isWorkspaceOwner(ws, req.user._id) || workspaceHasMember(ws, req.user._id));
    if (!isAllowed) return res.status(403).json({ message: 'You are not a member of the workspace' });

    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ message: `Invalid status: ${status}. Allowed: ${Array.from(VALID_STATUSES).join(', ')}` });
    }

    // validate members array (optional)
    const normalizedMembers = Array.isArray(members) ? members.filter(m => mongoose.Types.ObjectId.isValid(m)) : [];

    const project = await Project.create({
      title,
      description,
      status: status || undefined,
      workspace,
      tags: Array.isArray(tags) ? tags : [],
      startDate,
      dueDate,
      members: normalizedMembers,
    });

    const populated = await Project.findById(project._id).populate('workspace', 'name').populate('members', 'name email');
    return res.status(201).json({ message: 'Project created', project: populated });
  } catch (err) {
    console.error('createProject error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// GET /api/projects
// Query: ?status=&tag=&workspace=&page=&limit=&q=
// Returns projects user can see: admins see all, otherwise projects in user's workspaces or where user is a project member
// ----------------------
const getProjects = async (req, res) => {
  try {
    const { status, tag, workspace: workspaceQuery, q, page = 1, limit = 25 } = req.query;
    const skip = (Math.max(parseInt(page, 10), 1) - 1) * Math.max(parseInt(limit, 10), 1);
    const filter = {};

    if (status) {
      if (!VALID_STATUSES.has(status)) return res.status(400).json({ message: `Invalid status: ${status}` });
      filter.status = status;
    }

    if (tag) filter.tags = tag;
    if (workspaceQuery) {
      if (!mongoose.Types.ObjectId.isValid(workspaceQuery)) return res.status(400).json({ message: 'Invalid workspace id' });
      filter.workspace = workspaceQuery;
    }

    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { tags: new RegExp(q, 'i') }
      ];
    }

    // authorization scope
    if (!(req.user && req.user.role === 'admin')) {
      // projects where user is a member OR project belongs to a workspace where user is a member/owner
      // find workspace ids where user is owner or member
      const userId = req.user._id;
      const workspaces = await Workspace.find({
        $or: [{ owner: userId }, { 'members.user': userId }, { members: userId }]
      }).select('_id');
      const wsIds = workspaces.map(w => w._id);
      filter.$or = filter.$or || [];
      filter.$or.push({ members: userId }, { workspace: { $in: wsIds } });
    }

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate('workspace', 'name')
        .populate('members', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.max(parseInt(limit, 10), 1)),
      Project.countDocuments(filter),
    ]);

    return res.json({ projects, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    console.error('getProjects error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// GET /api/projects/me
// ----------------------
const getMyProjects = async (req, res) => {
  try {
    const userId = req.user._id;
    const projects = await Project.find({ members: userId })
      .populate('workspace', 'name')
      .populate('members', 'name email')
      .sort({ createdAt: -1 });

    return res.json({ projects });
  } catch (err) {
    console.error('getMyProjects error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// GET /api/projects/workspace/:workspaceId
// Returns projects in a workspace if user has access
// ----------------------
const getProjectsByWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) return res.status(400).json({ message: 'Invalid workspace id' });

    const ws = await Workspace.findById(workspaceId);
    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    // check visibility
    const allowed = req.user && (req.user.role === 'admin' || isWorkspaceOwner(ws, req.user._id) || workspaceHasMember(ws, req.user._id));
    if (!allowed) return res.status(403).json({ message: 'You are not a member of this workspace' });

    const projects = await Project.find({ workspace: workspaceId })
      .populate('members', 'name email')
      .sort({ createdAt: -1 });

    return res.json({ projects });
  } catch (err) {
    console.error('getProjectsByWorkspace error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// GET /api/projects/:id
// ----------------------
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('workspace', 'name owner')
      .populate('members', 'name email');

    if (!project) return res.status(404).json({ message: 'Project not found' });

    // check access: admin, project member, or workspace member/owner
    const ws = await Workspace.findById(project.workspace);
    const allowed = req.user && (req.user.role === 'admin' || isProjectMember(project, req.user._id) || isWorkspaceOwner(ws, req.user._id) || workspaceHasMember(ws, req.user._id));
    if (!allowed) return res.status(403).json({ message: 'You are not authorized to view this project' });

    return res.json({ project });
  } catch (err) {
    console.error('getProjectById error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// PUT /api/projects/:id
// Update project details. Allowed: workspace owner/admin or project member or global admin
// ----------------------
const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const ws = await Workspace.findById(project.workspace);
    const userId = req.user._id;
    const allowed = req.user.role === 'admin' || isWorkspaceOwner(ws, userId) || isWorkspaceAdmin(ws, userId) || isProjectMember(project, userId);

    if (!allowed) return res.status(403).json({ message: 'You are not authorized to update this project' });

    const { title, description, status, tags, startDate, dueDate } = req.body;

    if (title !== undefined) project.title = title;
    if (description !== undefined) project.description = description;
    if (status !== undefined) {
      if (!VALID_STATUSES.has(status)) return res.status(400).json({ message: `Invalid status: ${status}` });
      project.status = status;
    }
    if (tags !== undefined) project.tags = Array.isArray(tags) ? tags : project.tags;
    if (startDate !== undefined) project.startDate = startDate;
    if (dueDate !== undefined) project.dueDate = dueDate;

    await project.save();
    const populated = await Project.findById(project._id).populate('workspace', 'name').populate('members', 'name email');
    return res.json({ message: 'Project updated', project: populated });
  } catch (err) {
    console.error('updateProject error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// DELETE /api/projects/:id
// Delete project — allowed for workspace owner, workspace admin, or global admin
// ----------------------
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const ws = await Workspace.findById(project.workspace);
    const userId = req.user._id;
    const allowed = req.user.role === 'admin' || isWorkspaceOwner(ws, userId) || isWorkspaceAdmin(ws, userId);
    if (!allowed) return res.status(403).json({ message: 'You are not authorized to delete this project' });

    await project.deleteOne();
    return res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('deleteProject error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// POST /api/projects/:id/members
// body: { userId }  -> add user to project members
// Allowed: workspace owner/admin or existing project member or global admin
// ----------------------
const addMemberToProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ message: 'Valid userId is required' });

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const ws = await Workspace.findById(project.workspace);
    const userIdReq = req.user._id;
    const allowed = req.user.role === 'admin' || isWorkspaceOwner(ws, userIdReq) || isWorkspaceAdmin(ws, userIdReq) || isProjectMember(project, userIdReq);
    if (!allowed) return res.status(403).json({ message: 'You are not authorized to add members to this project' });

    // validate target user exists
    if (User) {
      const u = await User.findById(userId).select('_id name email');
      if (!u) return res.status(404).json({ message: 'User not found' });
    }

    if (project.members.some(m => String(m) === String(userId))) {
      return res.status(400).json({ message: 'User is already a member of the project' });
    }

    project.members.push(userId);
    await project.save();

    const populated = await Project.findById(project._id).populate('members', 'name email').populate('workspace', 'name');
    return res.status(201).json({ message: 'Member added to project', project: populated });
  } catch (err) {
    console.error('addMemberToProject error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// PUT /api/projects/:id/members
// Replace project.members array. Body: { members: [userId,...] }
// Allowed: workspace owner/admin or global admin
// ----------------------
const updateProjectMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { members } = req.body;
    if (!Array.isArray(members)) return res.status(400).json({ message: 'members must be an array of userIds' });

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const ws = await Workspace.findById(project.workspace);
    const userIdReq = req.user._id;
    const allowed = req.user.role === 'admin' || isWorkspaceOwner(ws, userIdReq) || isWorkspaceAdmin(ws, userIdReq);
    if (!allowed) return res.status(403).json({ message: 'You are not authorized to update project members' });

    const validMembers = members.filter(m => mongoose.Types.ObjectId.isValid(m));
    project.members = validMembers;
    await project.save();

    const populated = await Project.findById(project._id).populate('members', 'name email');
    return res.json({ message: 'Project members updated', project: populated });
  } catch (err) {
    console.error('updateProjectMembers error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// DELETE /api/projects/:id/members/:memberId
// Remove a member from project
// Allowed: workspace owner/admin or project member or global admin
// ----------------------
const removeMemberFromProject = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(memberId)) return res.status(400).json({ message: 'Invalid member id' });

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const ws = await Workspace.findById(project.workspace);
    const userIdReq = req.user._id;
    const allowed = req.user.role === 'admin' || isWorkspaceOwner(ws, userIdReq) || isWorkspaceAdmin(ws, userIdReq) || isProjectMember(project, userIdReq);
    if (!allowed) return res.status(403).json({ message: 'You are not authorized to remove members from this project' });

    const before = project.members.length;
    project.members = project.members.filter(m => String(m) !== String(memberId));
    if (project.members.length === before) return res.status(404).json({ message: 'Member not found on project' });

    await project.save();
    const populated = await Project.findById(project._id).populate('members', 'name email');
    return res.json({ message: 'Member removed from project', project: populated });
  } catch (err) {
    console.error('removeMemberFromProject error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ----------------------
// PUT /api/projects/:id/status
// Body { status } — allowed values: Planning, In Progress, Completed
// Allowed: project member, workspace admin/owner, or global admin
// ----------------------
const updateProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !VALID_STATUSES.has(status)) return res.status(400).json({ message: `Invalid status. Allowed: ${Array.from(VALID_STATUSES).join(', ')}` });

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const ws = await Workspace.findById(project.workspace);
    const userIdReq = req.user._id;
    const allowed = req.user.role === 'admin' || isProjectMember(project, userIdReq) || isWorkspaceOwner(ws, userIdReq) || isWorkspaceAdmin(ws, userIdReq);
    if (!allowed) return res.status(403).json({ message: 'You are not authorized to update project status' });

    project.status = status;
    await project.save();

    const populated = await Project.findById(project._id).populate('members', 'name email').populate('workspace', 'name');
    return res.json({ message: 'Project status updated', project: populated });
  } catch (err) {
    console.error('updateProjectStatus error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addMemberToProject,
  removeMemberFromProject,
  updateProjectMembers,
  getProjectsByWorkspace,
  getMyProjects,
  updateProjectStatus
};
