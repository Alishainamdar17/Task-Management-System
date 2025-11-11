// src/pages/Admin/CreateTask.jsx
import React, { useContext, useEffect, useState, useCallback } from "react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import toast from "react-hot-toast";
import uploadImage from "../../utils/uploadImage";
import { useLocation, useNavigate } from "react-router-dom";
import moment from "moment";
import SelectUsers from "../../components/Inputs/SelectUsers";
import AddAttachmentInput from "../../components/Inputs/AddAttachmentInput";
import { UserContext } from "../../context/userContext";

const normId = (v) => (v === undefined || v === null ? "" : String(v));

const mapToPriorityLabel = (p) => {
  if (!p) return "Medium";
  const s = typeof p === "string" ? p.toLowerCase() : (p.value || "").toLowerCase();
  if (s.includes("low")) return "Low";
  if (s.includes("high")) return "High";
  if (s.includes("critical")) return "Critical";
  return "Medium";
};

const PRIORITY_OPTIONS = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
];

export default function CreateTask() {
  const { user, workspaces = [] } = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();

  // also accept task in query so edit survives refresh
  const search = new URLSearchParams(location.search);
  const qsWorkspace = search.get("workspace");
  const qsProject   = search.get("project");
  const qsTask      = search.get("task");
  const { taskId: stateTaskId } = location.state || {};
  const taskId = qsTask || stateTaskId || null;

  const [taskData, setTaskData] = useState({
    title: "",
    subtitle: "",
    description: "",
    priority: "Medium",
    dueDate: "",
    assignedTo: [],         // array of userId strings
    todoChecklist: [],
    attachments: [],
    projectId: qsProject || "",
  });

  const [loading, setLoading] = useState(false);
  const [checklistInput, setChecklistInput] = useState("");
  const [projectsInWorkspace, setProjectsInWorkspace] = useState([]);
  const [usersCache, setUsersCache] = useState({}); // id -> user

  const currentWorkspaceId = (() => {
    if (qsWorkspace) return qsWorkspace;
    const cw = user?.currentWorkspace ?? workspaces?.[0];
    return typeof cw === "string" ? cw : cw?._id;
  })();

  // Seed current user in cache and preselect for new tasks
  useEffect(() => {
    if (user) {
      const uid = normId(user._id ?? user.id);
      if (uid) {
        setUsersCache((prev) => ({ ...prev, [uid]: user }));
        if (!taskId && (!taskData.assignedTo || taskData.assignedTo.length === 0)) {
          setTaskData((p) => ({ ...p, assignedTo: [uid] }));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, taskId]);

  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, currentWorkspaceId, qsProject]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Load projects for this workspace (so we can show project NAME)
      if (currentWorkspaceId) {
        try {
          const pPath =
            typeof API_PATHS.PROJECTS.GET_BY_WORKSPACE === "function"
              ? API_PATHS.PROJECTS.GET_BY_WORKSPACE(currentWorkspaceId)
              : `/api/projects/workspace/${currentWorkspaceId}`;
          const pres = await axiosInstance.get(pPath);
          const list = Array.isArray(pres.data) ? pres.data : pres.data?.projects || pres.data?.data || [];
          setProjectsInWorkspace(list);
        } catch {
          setProjectsInWorkspace([]);
        }
      }

      // If editing, fetch task and assigned users
      if (taskId) {
        try {
          const res = await axiosInstance.get(API_PATHS.TASKS.GET_TASK_BY_ID(taskId));
          const d = res?.data?.task ?? res?.data?.data ?? res?.data ?? {};

          const assignedIds = (d.assignees || d.assignedTo || []).map((u) =>
            typeof u === "object" ? normId(u._id ?? u.id) : normId(u)
          );

          setTaskData({
            title: d.title || "",
            subtitle: d.subtitle || "",
            description: d.description || "",
            priority: d.priority || "Medium",
            dueDate: d.dueDate
              ? moment(d.dueDate).format("YYYY-MM-DD")
              : d.duedate
              ? moment(d.duedate).format("YYYY-MM-DD")
              : "",
            assignedTo: assignedIds,
            todoChecklist: d.todoChecklist || [],
            attachments: d.attachments || [],
            projectId: d.project?._id || d.project || qsProject || "",
          });

          // hydrate usersCache for assigned IDs
          if (assignedIds.length > 0) {
            await fetchUsersIntoCache(assignedIds);
          }
        } catch (err) {
          console.warn("[CreateTask] Could not load task for edit", err?.response?.data || err);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // fetch users by ids and merge into usersCache
  const fetchUsersIntoCache = async (ids) => {
    const missing = (ids || [])
      .map(normId)
      .filter((id) => id && !usersCache[id]);

    if (missing.length === 0) return;

    try {
      const q = missing.join(",");
      const userFetchPath = API_PATHS?.USERS?.GET_BY_IDS
        ? API_PATHS.USERS.GET_BY_IDS(q)
        : `/api/users?ids=${q}`;
      const ures = await axiosInstance.get(userFetchPath);
      const list = Array.isArray(ures.data) ? ures.data : ures.data?.users ?? ures.data?.data ?? [];
      if (Array.isArray(list) && list.length) {
        setUsersCache((prev) => {
          const next = { ...prev };
          list.forEach((u) => {
            const id = normId(u._id ?? u.id);
            if (id) next[id] = u;
          });
          return next;
        });
      }
    } catch (err) {
      console.warn("[CreateTask] fetchUsersIntoCache failed:", err?.response?.data || err);
    }
  };

  const handleValueChange = (key, value) => {
    setTaskData((p) => ({ ...p, [key]: value }));
  };

  const addChecklistItem = () => {
    if (!checklistInput.trim()) return;
    setTaskData((p) => ({
      ...p,
      todoChecklist: [...p.todoChecklist, { text: checklistInput.trim(), completed: false }],
    }));
    setChecklistInput("");
  };

  const removeChecklistItem = (i) =>
    setTaskData((p) => ({ ...p, todoChecklist: p.todoChecklist.filter((_, idx) => idx !== i) }));

  // Called by SelectUsers — also hydrate cache for any unknown ids
  const onAssignedChange = useCallback(async (ids) => {
    const clean = Array.isArray(ids) ? ids.map(normId) : [];
    setTaskData((p) => ({ ...p, assignedTo: clean }));
    if (clean.length) await fetchUsersIntoCache(clean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveTask = async () => {
    if (!taskData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    const finalProject = qsProject || taskData.projectId;
    if (!finalProject) {
      toast.error("Please select a project (task must belong to a project).");
      return;
    }

    // upload any File objects, keep url/objects as-is
    const processedAttachments = [];
    for (const a of taskData.attachments || []) {
      if (typeof File !== "undefined" && a instanceof File) {
        try {
          const res = await uploadImage(a);
          processedAttachments.push({ url: res.imageUrl || res.url || res.image, name: a.name });
        } catch (err) {
          console.warn("[CreateTask] failed to upload attachment", a?.name, err);
        }
      } else if (a && typeof a === "object" && (a.url || a.path)) {
        processedAttachments.push({
          url: a.url || a.path,
          name: a.name || a.filename || (a.url || "").split("/").pop(),
        });
      } else if (typeof a === "string") {
        processedAttachments.push({ url: a, name: a.split("/").pop() });
      }
    }

    const payload = {
      title: taskData.title.trim(),
      subtitle: taskData.subtitle?.trim() || undefined,
      description: taskData.description?.trim() || undefined,
      priority: mapToPriorityLabel(taskData.priority),
      dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : undefined,
      assignees: Array.isArray(taskData.assignedTo) ? taskData.assignedTo.map(String) : [],
      todoChecklist: taskData.todoChecklist.map((c) => ({
        text: typeof c === "string" ? c : c.text,
        completed: !!c.completed,
      })),
      workspace: currentWorkspaceId,
      project: finalProject,
      attachments: processedAttachments,
    };

    setLoading(true);
    try {
      if (taskId) {
        await axiosInstance.put(API_PATHS.TASKS.UPDATE_TASK(taskId), payload);
        toast.success("Task updated");
      } else {
        await axiosInstance.post(API_PATHS.TASKS.CREATE_TASK, payload);
        toast.success("Task created");
      }
      if (finalProject && currentWorkspaceId) {
        navigate(`/admin/workspaces/${currentWorkspaceId}/projects/${finalProject}?r=${Date.now()}`);
      } else {
        navigate("/admin/tasks");
      }
    } catch (err) {
      console.error("[CreateTask] saveTask error:", err?.response?.data || err);
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to save task");
    } finally {
      setLoading(false);
    }
  };

  // helpers
  const findUser = (id) => usersCache[normId(id)] || null;

  // Resolve project name for display
  const currentProjectId = qsProject || taskData.projectId || "";
  const projectObj =
    projectsInWorkspace.find((p) => normId(p._id || p.id) === normId(currentProjectId)) || null;

  // If query has a project but it's not in the list yet, try a single fetch (silent)
  useEffect(() => {
    const needSingle = currentProjectId && !projectObj && API_PATHS?.PROJECTS?.GET_BY_ID;
    if (!needSingle) return;
    (async () => {
      try {
        const res = await axiosInstance.get(
          typeof API_PATHS.PROJECTS.GET_BY_ID === "function"
            ? API_PATHS.PROJECTS.GET_BY_ID(currentProjectId)
            : `${API_PATHS.PROJECTS.GET_BY_ID}${currentProjectId}`
        );
        const p = res?.data?.project ?? res?.data?.data ?? res?.data;
        if (p) {
          setProjectsInWorkspace((prev) => {
            const exists = prev.some((x) => normId(x._id || x.id) === normId(currentProjectId));
            return exists ? prev : [...prev, p];
          });
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, projectObj]);

  const projectLabel =
    projectObj?.title || projectObj?.name || (currentProjectId ? `Project ${currentProjectId}` : "—");

  return (
    <DashboardLayout activeMenu="Create Task">
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{taskId ? "Update Task" : "Create Task"}</h2>
              <p className="text-sm text-gray-500">Title is required, description optional.</p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              <button onClick={saveTask} disabled={loading} className="px-5 py-2 rounded text-sm text-white bg-sky-600">
                {loading ? "Saving..." : taskId ? "Update Task" : "Create Task"}
              </button>
            </div>
          </div>

          <div className="bg-white shadow rounded p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium">Title</label>
              <input
                value={taskData.title}
                onChange={(e) => handleValueChange("title", e.target.value)}
                className="w-full mt-2 border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Subtitle (optional)</label>
              <input
                value={taskData.subtitle}
                onChange={(e) => handleValueChange("subtitle", e.target.value)}
                className="w-full mt-2 border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Description (optional)</label>
              <textarea
                value={taskData.description}
                onChange={(e) => handleValueChange("description", e.target.value)}
                rows={4}
                className="w-full mt-2 border rounded px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Priority</label>
                <select
                  value={taskData.priority}
                  onChange={(e) => handleValueChange("priority", e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-2"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Due Date</label>
                <input
                  type="date"
                  value={taskData.dueDate}
                  onChange={(e) => handleValueChange("dueDate", e.target.value)}
                  className="w-full mt-2 border rounded px-3 py-2"
                />
              </div>
            </div>

            {/* Assignees */}
            <div>
              <label className="block text-sm font-medium">Assigned To</label>
              <SelectUsers
                selectedUsers={taskData.assignedTo.map(normId)}
                setSelectedUsers={onAssignedChange}
                workspaceId={currentWorkspaceId}
              />
            </div>

            {/* Assignee preview with names */}
            <div>
              <label className="block text-sm font-medium">Assigned Preview</label>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {taskData.assignedTo.length === 0 ? (
                  <span className="text-sm text-gray-500">No assignees</span>
                ) : (
                  taskData.assignedTo.map((id) => {
                    const u = findUser(id);
                    const label = u?.name || u?.fullName || u?.email || id;
                    const avatar =
                      u?.profileImageUrl || u?.avatarUrl || u?.avatar || u?.photo || "";
                    return (
                      <div key={id} className="flex items-center gap-2">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={label}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                            {String(label).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm">{label}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Checklist */}
            <div>
              <label className="block text-sm font-medium">Checklist</label>
              <div className="flex gap-2 mt-2">
                <input
                  value={checklistInput}
                  onChange={(e) => setChecklistInput(e.target.value)}
                  className="flex-1 border rounded px-3 py-2"
                  placeholder="Add checklist item"
                />
                <button onClick={addChecklistItem} type="button" className="px-3 py-2 bg-gray-100 rounded">
                  Add
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {taskData.todoChecklist.map((c, i) => (
                  <li key={i} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded">
                    <div>
                      <span>{typeof c === "string" ? c : c.text}</span>
                    </div>
                    <button onClick={() => removeChecklistItem(i)} className="text-red-500 text-xs">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Project (show name when locked via query) */}
            <div>
              <label className="block text-sm font-medium">Project</label>
              {qsProject ? (
                <div className="mt-2 text-sm text-gray-700">
                  Using project: <strong>{projectLabel}</strong>
                </div>
              ) : (
                <select
                  value={taskData.projectId || ""}
                  onChange={(e) => handleValueChange("projectId", e.target.value)}
                  className="w-full mt-2 border rounded px-3 py-2"
                >
                  <option value="">— Select project —</option>
                  {projectsInWorkspace.map((p) => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.title || p.name || `Project ${p._id || p.id}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-sm font-medium">Attachments</label>
              <AddAttachmentInput
                attachments={taskData.attachments}
                setAttachments={(v) => setTaskData((p) => ({ ...p, attachments: v }))}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
