// src/pages/Project/CreateProject.jsx
import React, { useEffect, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import toast from "react-hot-toast";

/**
 * Compact & styled CreateProjectModal
 *
 * Keeps the same API payload: { title, description, status, startDate, dueDate, tags, members, workspace }
 */
export default function CreateProjectModal({ workspaceId, open, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Planning");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tagString, setTagString] = useState("");
  const [assignTo, setAssignTo] = useState([]); // array of userIds
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverErrorBody, setServerErrorBody] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const res = await axiosInstance.get(API_PATHS.USERS.GET_ALL_USERS);
        const payload = res?.data;
        const users =
          Array.isArray(payload) ? payload :
          Array.isArray(payload?.users) ? payload.users :
          Array.isArray(payload?.data) ? payload.data : [];
        if (!cancelled) setAllUsers(users);
      } catch (err) {
        if (!cancelled) setAllUsers([]);
        console.error("Failed to load users", err);
      }
    }
    if (open) loadUsers();
    return () => (cancelled = true);
  }, [open]);

  const toggleAssign = (userId) => {
    setAssignTo((prev) => (prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId]));
  };

  const normalizeStatus = (s) => {
    if (!s) return "Planning";
    const lower = String(s).toLowerCase();
    if (lower.includes("plan")) return "Planning";
    if (lower.includes("progress")) return "In Progress";
    if (lower.includes("complete") || lower === "done") return "Completed";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setServerErrorBody(null);

    if (!workspaceId) {
      setError("Workspace not selected");
      return;
    }
    if (!title.trim()) {
      setError("Project title is required");
      return;
    }

    setLoading(true);

    const start = startDate ? new Date(startDate).toISOString() : null;
    const due = dueDate ? new Date(dueDate).toISOString() : null;
    const tags = tagString.split(",").map((t) => t.trim()).filter(Boolean);

    const payload = {
      title: title.trim(),
      description: description || "",
      status: normalizeStatus(status),
      startDate: start,
      dueDate: due,
      tags,
      members: assignTo,
      workspace: workspaceId,
    };

    console.log("[CreateProject] payload:", payload);

    try {
      const path = API_PATHS.PROJECTS.CREATE || "/api/projects";
      const res = await axiosInstance.post(path, payload);

      const created = res?.data?.project || res?.data || null;
      if (typeof onCreated === "function") onCreated(created);

      // reset
      setTitle("");
      setDescription("");
      setStatus("Planning");
      setStartDate("");
      setDueDate("");
      setTagString("");
      setAssignTo([]);
      toast.success("Project created");
      if (typeof onClose === "function") onClose();
    } catch (err) {
      console.error("[CreateProjectModal] create error:", err);
      const serverBody = err?.response?.data ?? err?.response ?? err?.message;
      setServerErrorBody(serverBody);
      const msg = err?.response?.data?.message || err?.message || "Failed to create project";
      setError(msg);
      toast.error("Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose && onClose()} />

      {/* modal */}
      <div className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl z-10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-lg font-semibold">Create Project</h3>
          <button
            onClick={() => onClose && onClose()}
            className="text-gray-500 hover:text-gray-700 rounded p-1 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
          {serverErrorBody && (
            <pre className="mb-3 p-2 bg-red-50 text-xs text-red-700 rounded max-h-36 overflow-auto">{typeof serverErrorBody === "string" ? serverErrorBody : JSON.stringify(serverErrorBody, null, 2)}</pre>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600">Project title</label>
                <input
                  className="mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                  placeholder="Test Project"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">Description</label>
                <textarea
                  className="mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                  rows={3}
                  placeholder="Project description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="mt-1 block w-full border rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                  >
                    <option value="Planning">Planning</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600">Tags (comma separated)</label>
                  <input
                    className="mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                    placeholder="web, mobile, backend"
                    value={tagString}
                    onChange={(e) => setTagString(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 block w-full border rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 block w-full border rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-sky-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assign To</label>

                <div className="flex flex-wrap gap-2 items-center mb-2">
                  {/* selected chips */}
                  {assignTo.length === 0 ? (
                    <div className="text-xs text-gray-400">No assignees selected</div>
                  ) : (
                    assignTo.map((id) => {
                      const u = allUsers.find((x) => (x._id || x.id) === id);
                      const name = u?.name || u?.fullName || u?.email || id;
                      return (
                        <span key={id} className="inline-flex items-center gap-2 bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full text-xs">
                          <span>{name}</span>
                          <button
                            type="button"
                            onClick={() => toggleAssign(id)}
                            className="ml-1 text-sky-500 hover:text-sky-700"
                            aria-label={`remove ${name}`}
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>

                <div className="max-h-36 overflow-auto border rounded-md p-2 bg-gray-50">
                  {allUsers.length === 0 ? (
                    <div className="text-xs text-gray-500">No users to assign</div>
                  ) : (
                    allUsers.map((u) => {
                      const id = u._id || u.id;
                      const name = u.name || u.fullName || u.email || id;
                      return (
                        <label key={id} className="flex items-center gap-2 mb-2 text-sm">
                          <input
                            type="checkbox"
                            checked={assignTo.includes(id)}
                            onChange={() => toggleAssign(id)}
                            className="h-4 w-4 text-sky-600 border-gray-300 rounded"
                          />
                          <span className="truncate">{name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => onClose && onClose()}
                className="px-4 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50 transition"
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-sky-600 text-white text-sm shadow hover:shadow-md transition disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
