import React, { useEffect, useState, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUserAuth } from "../../hooks/useUserAuth";
import { UserContext } from "../../context/userContext";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import moment from "moment";
import toast from "react-hot-toast";

/* Safe Avatar */
const Avatar = ({ user, className = "w-8 h-8" }) => {
  const name = user?.name || user?.fullName || user?.email || "U";
  const initials = name
    .split(" ")
    .map((p) => (p ? p[0] : ""))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const src = (user?.profileImageUrl || user?.avatarUrl || user?.avatar || "").trim();
  if (src) return <img src={src} alt={name} title={name} className={`${className} rounded-full object-cover`} />;
  return (
    <div title={name} className={`${className} rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-700`}>
      {initials}
    </div>
  );
};

/* Checklist helpers */
const normalizeChecklistItem = (it) => {
  if (it == null) return { text: "", completed: false, raw: it };
  if (typeof it === "string") return { text: it, completed: false, raw: it };
  const text = it.text ?? it.title ?? it.name ?? it.label ?? it.description ?? "";
  const completed = !!(it.isDone || it.done || it.completed || it.checked || it.is_completed);
  return { ...it, text, completed, raw: it };
};

const findChecklistArray = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const keys = [
    "todoChecklist",
    "subtasks",
    "subTasks",
    "sub_tasks",
    "checklist",
    "todos",
    "items",
    "tasks",
    "check_items",
    "todo_items",
    "taskItems",
    "data",
    "list",
  ];
  for (const k of keys) {
    const v = raw[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object" && Array.isArray(v.data)) return v.data;
  }
  return null;
};

const normalizeChecklist = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(normalizeChecklistItem);
  const arr = findChecklistArray(raw);
  if (arr) return arr.map(normalizeChecklistItem);
  for (const v of Object.values(raw || {})) {
    const nested = findChecklistArray(v);
    if (nested) return nested.map(normalizeChecklistItem);
  }
  return [];
};

const statusFromChecklist = (list) => {
  if (!list || list.length === 0) return "To Do";
  const done = list.filter((i) => i.completed).length;
  if (done === list.length) return "Done";
  if (done > 0) return "In Progress";
  return "To Do";
};

const getStatusBadgeClass = (status) => {
  const s = String(status || "").toLowerCase();
  if (s.includes("done") || s.includes("completed")) return "text-lime-500 bg-lime-50 border border-lime-500/20";
  if (s.includes("progress")) return "text-cyan-500 bg-cyan-50 border border-cyan-500/10";
  return "text-violet-500 bg-violet-50 border border-violet-500/10";
};

export default function ViewTaskDetails() {
  useUserAuth();
  const { user } = useContext(UserContext);
  const { id } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState("");
  const [localStatusOverride, setLocalStatusOverride] = useState(null);

  const fetchTask = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const path = typeof API_PATHS.TASKS.GET_TASK_BY_ID === "function" ? API_PATHS.TASKS.GET_TASK_BY_ID(id) : API_PATHS.TASKS.GET_TASK_BY_ID;
      const res = await axiosInstance.get(path);
      const data = res?.data ?? res;
      const maybeTask = data?.task ?? data;
      const todoChecklist = normalizeChecklist(maybeTask);
      const serverStatus = maybeTask?.status ?? maybeTask?.state ?? undefined;
      const finalStatus = serverStatus ?? localStatusOverride ?? statusFromChecklist(todoChecklist);
      if (serverStatus !== undefined && localStatusOverride) setLocalStatusOverride(null);

      setTask({
        _id: maybeTask?._id || maybeTask?.id,
        id: maybeTask?._id || maybeTask?.id,
        title: maybeTask?.title || maybeTask?.name || "-",
        description: maybeTask?.description || maybeTask?.notes || "",
        priority: maybeTask?.priority ?? "-",
        status: finalStatus,
        dueDate: maybeTask?.dueDate || maybeTask?.due_date || null,
        assignees: Array.isArray(maybeTask?.assignees) ? maybeTask.assignees : (maybeTask?.assignee ? [maybeTask.assignee] : []),
        attachments: Array.isArray(maybeTask?.attachments) ? maybeTask.attachments : [],
        progress: maybeTask?.progress ?? maybeTask?.percent ?? (todoChecklist.length ? Math.round((todoChecklist.filter(i => i.completed).length / todoChecklist.length) * 100) : 0),
        todoChecklist,
        raw: maybeTask,
        completed: maybeTask?.completed ?? maybeTask?.isCompleted ?? maybeTask?.is_completed ?? (todoChecklist.length ? todoChecklist.every(i => i.completed) : false),
      });
    } catch (err) {
      console.error("[ViewTaskDetails] fetch error:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to load task");
      toast.error("Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [id, localStatusOverride]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const meId = String(user?._id ?? user?.id ?? "");
  const isAssignedToMe = () =>
    (task?.assignees || []).some((u) => {
      if (!u) return false;
      if (typeof u === "string") return String(u) === meId;
      const uid = String(u._id ?? u.id ?? u.userId ?? "");
      return uid && uid === meId;
    });

  const isStatusDone = (s) => {
    if (!s) return false;
    const v = String(s).toLowerCase();
    return v.includes("done") || v.includes("completed");
  };

  /* Toggle checklist item */
  const handleToggleChecklist = async (index) => {
    if (!task) return;
    if (savingChecklist) return;

    const current = Array.isArray(task?.todoChecklist) ? task.todoChecklist : [];
    const updated = current.map((it, i) => (i === index ? { ...it, completed: !it.completed } : it));
    const newStatus = statusFromChecklist(updated);

    // optimistic update
    setTask((t) => ({
      ...t,
      todoChecklist: updated,
      status: newStatus,
      progress: updated.length ? Math.round((updated.filter((i) => i.completed).length / updated.length) * 100) : t.progress,
    }));

    setSavingChecklist(true);
    try {
      const taskId = task._id || task.id || id;
      const subtasksPayload = updated.map((it) => {
        const raw = it.raw && typeof it.raw === "object" ? it.raw : {};
        return {
          _id: it._id || raw._id || raw.id,
          id: it.id || raw.id,
          title: it.text,
          text: it.text,
          isDone: !!it.completed,
          completed: !!it.completed,
        };
      });

      const updatePath = typeof API_PATHS.TASKS.UPDATE_TASK === "function" ? API_PATHS.TASKS.UPDATE_TASK(taskId) : API_PATHS.TASKS.UPDATE_TASK;
      if (updatePath) {
        try {
          await axiosInstance.put(updatePath, { subtasks: subtasksPayload, todoChecklist: subtasksPayload });
        } catch (putErr) {
          try {
            await axiosInstance.patch(updatePath, { subtasks: subtasksPayload, todoChecklist: subtasksPayload });
          } catch (patchErr) {
            console.warn("[ViewTaskDetails] checklist update failed:", patchErr);
          }
        }
      } else {
        const fallback = (API_PATHS.TASKS?.BASE || API_PATHS.TASKS?.ROOT) ? `${API_PATHS.TASKS.BASE}/${taskId}` : `/tasks/${taskId}`;
        try {
          await axiosInstance.put(fallback, { subtasks: subtasksPayload, todoChecklist: subtasksPayload });
        } catch (_) {}
      }

      // try updating status endpoint (best-effort)
      try {
        const statusPath = typeof API_PATHS.TASKS.UPDATE_TASK_STATUS === "function" ? API_PATHS.TASKS.UPDATE_TASK_STATUS(taskId) : API_PATHS.TASKS.UPDATE_TASK_STATUS;
        if (statusPath) {
          try { await axiosInstance.put(statusPath, { status: newStatus }); } catch { try { await axiosInstance.patch(statusPath, { status: newStatus }); } catch {} }
        }
      } catch (e) {}

      // notify other pages
      try { localStorage.setItem("tasks:updatedAt", String(Date.now())); } catch (_) {}
      window.dispatchEvent(new Event("tasks:updated"));

      toast.success("Checklist updated");
      await fetchTask();
    } catch (err) {
      console.error("[handleToggleChecklist] save error:", err);
      toast.error("Failed to save checklist");
      await fetchTask();
    } finally {
      setSavingChecklist(false);
    }
  };

  const changeStatus = async (newStatusRaw) => {
    if (!task) return;
    const normalized = String(newStatusRaw).toLowerCase().includes("done") ? "Done" : String(newStatusRaw).toLowerCase().includes("progress") ? "In Progress" : "To Do";

    setSavingStatus(true);
    try {
      const taskId = task._id || task.id || id;
      const statusPath = typeof API_PATHS.TASKS.UPDATE_TASK_STATUS === "function" ? API_PATHS.TASKS.UPDATE_TASK_STATUS(taskId) : API_PATHS.TASKS.UPDATE_TASK_STATUS;

      let updated = false;
      if (statusPath) {
        try { await axiosInstance.put(statusPath, { status: normalized }); updated = true; }
        catch { try { await axiosInstance.patch(statusPath, { status: normalized }); updated = true; } catch {} }
      }

      if (!updated) {
        const updatePath = typeof API_PATHS.TASKS.UPDATE_TASK === "function" ? API_PATHS.TASKS.UPDATE_TASK(taskId) : API_PATHS.TASKS.UPDATE_TASK;
        if (updatePath) {
          try { await axiosInstance.put(updatePath, { status: normalized }); updated = true; }
          catch { try { await axiosInstance.patch(updatePath, { status: normalized }); updated = true; } catch {} }
        }
      }

      setLocalStatusOverride(normalized);
      setTask((t) => ({ ...t, status: normalized }));
      try { localStorage.setItem("tasks:updatedAt", String(Date.now())); } catch (_) {}
      window.dispatchEvent(new Event("tasks:updated"));
      toast.success("Status updated");
      await fetchTask();
    } catch (err) {
      console.error("[changeStatus] error:", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to update status");
      await fetchTask();
    } finally {
      setSavingStatus(false);
    }
  };

  const markCompleted = async () => {
    if (!task) return;
    const taskId = task._id || task.id || id;
    if (!taskId) return;
    if (!isAssignedToMe()) {
      toast.error("Only assigned users can mark completed");
      return;
    }
    setSavingStatus(true);
    try {
      const statusPath = typeof API_PATHS.TASKS.UPDATE_TASK_STATUS === "function" ? API_PATHS.TASKS.UPDATE_TASK_STATUS(taskId) : API_PATHS.TASKS.UPDATE_TASK_STATUS;
      let updated = false;
      if (statusPath) {
        try { await axiosInstance.put(statusPath, { status: "Done" }); updated = true; }
        catch { try { await axiosInstance.patch(statusPath, { status: "Done" }); updated = true; } catch {} }
      }
      if (!updated) {
        const updatePath = typeof API_PATHS.TASKS.UPDATE_TASK === "function" ? API_PATHS.TASKS.UPDATE_TASK(taskId) : API_PATHS.TASKS.UPDATE_TASK;
        if (updatePath) {
          try { await axiosInstance.put(updatePath, { status: "Done", completed: true }); updated = true; }
          catch { try { await axiosInstance.patch(updatePath, { status: "Done", completed: true }); updated = true; } catch {} }
        }
      }

      setLocalStatusOverride("Done");
      setTask((t) => ({ ...t, status: "Done", todoChecklist: (t.todoChecklist || []).map((it) => ({ ...it, completed: true })), progress: 100, completed: true }));

      try { localStorage.setItem("tasks:updatedAt", String(Date.now())); } catch (_) {}
      window.dispatchEvent(new Event("tasks:updated"));

      toast.success("Task marked completed");
      await fetchTask();
    } catch (err) {
      console.error("[markCompleted] error:", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to mark completed");
      await fetchTask();
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading && !task) {
    return (
      <DashboardLayout activeMenu="My Tasks">
        <div className="py-12 text-center text-slate-500">Loading task...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeMenu="My Tasks">
      <div className="p-6">
        <div className="max-w-4xl bg-white rounded-md shadow p-6 relative">
          <div style={{ position: "absolute", right: 18, top: 18 }}>
            <div className={`px-3 py-1 rounded text-[13px] font-medium ${getStatusBadgeClass(task?.status)}`}>
              {task?.status || "Pending"}
            </div>
          </div>

          <h2 className="text-2xl font-semibold mb-2">{task?.title || "-"}</h2>
          <p className="text-sm text-slate-600 mb-6">{task?.description || "-"}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <div className="text-xs text-slate-400">Priority</div>
              <div className="font-medium">{task?.priority ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Due Date</div>
              <div className="font-medium">{task?.dueDate ? moment(task.dueDate).format("Do MMM YYYY") : "-"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Assigned To</div>
              <div className="flex items-center gap-2 mt-2">{(task?.assignees || []).map((u, i) => <Avatar key={i} user={u} />)}</div>
            </div>
          </div>

          <h4 className="text-sm font-medium text-gray-700 mb-3">Todo Checklist ({(task?.todoChecklist || []).length})</h4>
          {(task?.todoChecklist || []).length ? (
            <div className="space-y-3">
              {task.todoChecklist.map((it, idx) => (
                <label key={idx} className="flex items-center gap-3 border rounded p-3">
                  <input type="checkbox" checked={!!it.completed} onChange={() => handleToggleChecklist(idx)} disabled={savingChecklist} />
                  <span className={`${it.completed ? "line-through text-slate-400" : ""} font-medium`}>{it.text || "Item"}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="py-6 text-sm text-slate-400">
              No checklist items
              {task?.progress > 0 && <div className="mt-2 text-xs text-slate-500">Progress: {Math.round(task.progress)}%</div>}
            </div>
          )}

          <h4 className="text-sm font-medium text-gray-700 mt-8 mb-3">Attachments</h4>
          {(task?.attachments || []).length ? (
            <ul className="list-disc ml-5 space-y-1">{task.attachments.map((a, i) => <li key={i}><a href={a.url || a.path} target="_blank" rel="noreferrer" className="underline text-slate-700">{a.name || a.filename || `Attachment ${i + 1}`}</a></li>)}</ul>
          ) : (
            <div className="py-2 text-sm text-slate-400">No attachments</div>
          )}

          <aside className="mt-6">
            <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded text-sm mr-3">Back</button>

            {isAssignedToMe() && (
              <select value={(task?.status || "To Do")} onChange={(e) => changeStatus(e.target.value)} disabled={savingStatus} className="border rounded px-2 py-1 mr-3">
                <option value="To Do">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
            )}

            {isAssignedToMe() && !isStatusDone(task?.status) && (
              <button onClick={markCompleted} disabled={savingStatus} className="bg-green-600 text-white px-3 py-2 rounded">{savingStatus ? "Saving..." : "Mark as Completed"}</button>
            )}
          </aside>

          {error && <div className="mt-4 text-rose-500">{error}</div>}
        </div>
      </div>
    </DashboardLayout>
  );
}
