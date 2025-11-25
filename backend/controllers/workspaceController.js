const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const User = require("../models/User");

/* ---------------------------------------------
   HELPERS
------------------------------------------------*/

const isOwner = (workspace, userId) => {
  if (!workspace || !workspace.owner) return false;
  return String(workspace.owner) === String(userId);
};

const getMemberObj = (workspace, userId) => {
  if (!Array.isArray(workspace.members)) return null;
  return workspace.members.find((m) => String(m.user) === String(userId));
};

const isWorkspaceAdmin = (workspace, userId) => {
  if (!workspace) return false;
  if (isOwner(workspace, userId)) return true;
  const member = getMemberObj(workspace, userId);
  return !!member && member.role === "admin";
};

/* ---------------------------------------------
   CREATE WORKSPACE (owner = logged in user)
------------------------------------------------*/
const createWorkspace = async (req, res) => {
  try {
    const { name, description = "", members = [], projects = [], settings = {} } = req.body;

    if (!name) return res.status(400).json({ message: "Workspace name is required" });

    // normalize incoming members
    const normalizedMembers = Array.isArray(members)
      ? members
          .map((m) => {
            if (typeof m === "string" || mongoose.Types.ObjectId.isValid(m))
              return { user: m, role: "member" };
            if (m && m.user) return { user: m.user, role: m.role || "member" };
            return null;
          })
          .filter(Boolean)
      : [];

    const ws = await Workspace.create({
      name,
      description,
      owner: req.user._id,
      members: normalizedMembers,
      projects: Array.isArray(projects) ? projects : [],
      settings,
    });

    const populated = await Workspace.findById(ws._id)
      .populate("owner", "name email")
      .populate("members.user", "name email");

    return res.status(201).json({ message: "Workspace created", workspace: populated });
  } catch (err) {
    console.error("createWorkspace error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ---------------------------------------------
   GET ALL WORKSPACES
------------------------------------------------*/
const getWorkspaces = async (req, res) => {
  try {
    // admin → all workspaces
    if (req.user.role === "admin") {
      const all = await Workspace.find()
        .populate("owner", "name email")
        .populate("members.user", "name email");
      return res.json({ workspaces: all });
    }

    // user → only workspaces they belong to
    const ws = await Workspace.find({
      $or: [{ owner: req.user._id }, { "members.user": req.user._id }],
    })
      .populate("owner", "name email")
      .populate("members.user", "name email");

    return res.json({ workspaces: ws });
  } catch (err) {
    console.error("getWorkspaces error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ---------------------------------------------
   GET MY WORKSPACES
------------------------------------------------*/
const getMyWorkspaces = async (req, res) => {
  try {
    const userId = req.user._id;

    const workspaces = await Workspace.find({
      $or: [{ owner: userId }, { "members.user": userId }],
    })
      .populate("owner", "name email")
      .populate("members.user", "name email");

    return res.json({ workspaces });
  } catch (err) {
    console.error("getMyWorkspaces error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ---------------------------------------------
   GET WORKSPACE BY ID  (⭐ FIXED HERE)
   USER gets auto-added if not a member
------------------------------------------------*/
const getWorkspaceById = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id)
      .populate("owner", "name email")
      .populate("members.user", "name email")
      .populate("projects");

    if (!ws) return res.status(404).json({ message: "Workspace not found" });

    const userId = req.user._id;

    // ⭐ If user is not admin AND not member AND not owner → auto add user to workspace
    const isMember = getMemberObj(ws, userId);
    const isOwnerFlag = isOwner(ws, userId);

    if (!isMember && !isOwnerFlag && req.user.role !== "admin") {
      ws.members.push({ user: userId, role: "member" });
      await ws.save();
    }

    return res.json({ workspace: ws });
  } catch (err) {
    console.error("getWorkspaceById error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ---------------------------------------------
   UPDATE WORKSPACE
------------------------------------------------*/
const updateWorkspace = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id);

    if (!ws) return res.status(404).json({ message: "Workspace not found" });

    if (!isWorkspaceAdmin(ws, req.user._id) && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only workspace admin/owner can update the workspace" });
    }

    const { name, description, settings, projects } = req.body;

    if (name !== undefined) ws.name = name;
    if (description !== undefined) ws.description = description;
    if (settings !== undefined) ws.settings = settings;
    if (projects !== undefined) ws.projects = projects;

    await ws.save();

    const populated = await Workspace.findById(ws._id)
      .populate("owner", "name email")
      .populate("members.user", "name email");

    return res.json({ message: "Workspace updated", workspace: populated });
  } catch (err) {
    console.error("updateWorkspace error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ---------------------------------------------
   DELETE WORKSPACE
------------------------------------------------*/
const deleteWorkspace = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id);

    if (!ws) return res.status(404).json({ message: "Workspace not found" });

    if (!isOwner(ws, req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only workspace owner or global admin can delete" });
    }

    await ws.deleteOne();
    return res.json({ message: "Workspace deleted" });
  } catch (err) {
    console.error("deleteWorkspace error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ---------------------------------------------
   ADD MEMBER
------------------------------------------------*/
const addMember = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ message: "Workspace not found" });

    if (!isWorkspaceAdmin(ws, req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only workspace admin/owner can add members" });
    }

    const { user, role = "member" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(user))
      return res.status(400).json({ message: "Invalid user ID" });

    const already = getMemberObj(ws, user);
    if (already) return res.status(400).json({ message: "User already exists in workspace" });

    ws.members.push({ user, role });
    await ws.save();

    const populated = await Workspace.findById(ws._id).populate("members.user", "name email");
    return res.json({ message: "User added", workspace: populated });
  } catch (err) {
    console.error("addMember error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ---------------------------------------------
   UPDATE MEMBER ROLE
------------------------------------------------*/
const updateMemberRole = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ message: "Workspace not found" });

    if (!isWorkspaceAdmin(ws, req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only workspace admin/owner can update roles" });
    }

    const memberUserId = req.params.memberUserId;

    const member = getMemberObj(ws, memberUserId);
    if (!member) return res.status(404).json({ message: "Member not found" });

    const { role } = req.body;
    if (!["member", "admin"].includes(role))
      return res.status(400).json({ message: "Invalid role" });

    member.role = role;
    await ws.save();

    const populated = await Workspace.findById(ws._id).populate("members.user", "name email");
    return res.json({ message: "Role updated", workspace: populated });
  } catch (err) {
    console.error("updateMemberRole error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ---------------------------------------------
   REMOVE MEMBER
------------------------------------------------*/
const removeMember = async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ message: "Workspace not found" });

    if (!isWorkspaceAdmin(ws, req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin/owner can remove members" });
    }

    const memberUserId = req.params.memberUserId;

    ws.members = ws.members.filter((m) => String(m.user) !== String(memberUserId));
    await ws.save();

    const populated = await Workspace.findById(ws._id).populate("members.user", "name email");
    return res.json({ message: "Member removed", workspace: populated });
  } catch (err) {
    console.error("removeMember error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
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
  getMyWorkspaces,
};
