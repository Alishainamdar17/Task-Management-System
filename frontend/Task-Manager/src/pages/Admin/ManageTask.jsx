import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import DashboardLayout from "../../components/layouts/DashboardLayout";

/* ---------------- Helpers ---------------- */
const normId = (v) => (v === undefined || v === null ? "" : String(v));
const cap = (s) => (typeof s === "string" && s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// consistent detector
const detectStatus = (t) => {
  const s = (v) => (v === undefined || v === null ? "" : String(v).toLowerCase().trim());
  if (t.completed || t.isCompleted || t.done || t.isDone) return { bucket: "Completed", label: "Completed" };
  if (t.completedAt || t.closedAt || t.finishedAt || t.completed_at || t.closed_at) return { bucket: "Completed", label: "Completed" };
  const prog = t.progress ?? t.percent ?? t.completionPercent ?? t.progressPercent ?? t.percentage;
  if (typeof prog === "number") {
    if (prog >= 100) return { bucket: "Completed", label: "Completed" };
    if (prog > 0) return { bucket: "In Progress", label: "In Progress" };
  } else if (s(prog) && !Number.isNaN(Number(s(prog)))) {
    const n = Number(s(prog));
    if (n >= 100) return { bucket: "Completed", label: "Completed" };
    if (n > 0) return { bucket: "In Progress", label: "In Progress" };
  }
  const txt =
    (typeof t.status === "string" && t.status) ||
    (t.state && typeof t.state === "string" ? t.state : "") ||
    "";
  if (txt) {
    const v = txt.toLowerCase();
    if (v.includes("complete") || v.includes("done") || v.includes("closed") || v.includes("finished"))
      return { bucket: "Completed", label: cap(txt) };
    if (v.includes("progress") || v.includes("in-progress") || v.includes("doing") || v.includes("ongoing") || v.includes("active"))
      return { bucket: "In Progress", label: cap(txt) };
    if (v.includes("pending") || v.includes("todo") || v.includes("open") || v.includes("new") || v.includes("backlog"))
      return { bucket: "Pending", label: cap(txt) };
    return { bucket: "Pending", label: cap(txt) };
  }
  const list = Array.isArray(t.todoChecklist) ? t.todoChecklist
            : Array.isArray(t.checklist)     ? t.checklist
            : Array.isArray(t.todos)         ? t.todos : [];
  if (list.length > 0) {
    let done = 0;
    list.forEach((it) => {
      if (!it) return;
      if (typeof it === "boolean" && it) done++;
      else if (typeof it === "object" && (it.completed || it.checked || it.done)) done++;
      else if (typeof it === "string") {
        const vs = it.toLowerCase();
        if (["true", "done", "checked", "complete", "completed", "1"].includes(vs)) done++;
      }
    });
    if (done >= list.length) return { bucket: "Completed", label: "Completed (checklist)" };
    if (done > 0) return { bucket: "In Progress", label: "In Progress (checklist)" };
  }
  return { bucket: "Pending", label: "Pending" };
};

const getChecklistInfo = (task) => {
  const list = Array.isArray(task.todoChecklist) ? task.todoChecklist
            : Array.isArray(task.checklist)     ? task.checklist
            : Array.isArray(task.todos)         ? task.todos : [];
  const total = list.length;
  let completed = 0;
  list.forEach((it) => {
    if (!it) return;
    if (typeof it === "boolean" && it) completed++;
    else if (typeof it === "object" && (it.completed || it.checked || it.done)) completed++;
  });
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
};

const Avatar = ({ name, src }) => {
  const initials = (name || "")
    .trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";
  return src ? (
    <img src={src} alt={name || "user"} className="w-8 h-8 rounded-full object-cover border" />
  ) : (
    <div className="w-8 h-8 rounded-full bg-gray-200 border flex items-center justify-center text-xs font-medium text-gray-700">
      {initials}
    </div>
  );
};

const statusBadge = (label) => {
  const s = (label || "").toLowerCase();
  if (s.includes("complete") || s.includes("done")) return "bg-emerald-100 text-emerald-700";
  if (s.includes("progress") || s.includes("active")) return "bg-blue-100 text-blue-700";
  if (s.includes("pending") || s.includes("todo") || s.includes("open")) return "bg-gray-100 text-gray-700";
  return "bg-gray-100 text-gray-700";
};
const priorityBadge = (p) => {
  const s = (p || "").toLowerCase();
  if (s === "critical" || s === "high") return "bg-rose-100 text-rose-700";
  if (s === "medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
};

/* ---------------- Page ---------------- */
export default function ManageTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const GET_ALL = API_PATHS?.TASKS?.GET_ALL_TASKS ?? "/api/tasks";
      const res = await axiosInstance.get(GET_ALL);
      const payload = res?.data;
      const list =
        Array.isArray(payload?.tasks) ? payload.tasks :
        Array.isArray(payload?.data)  ? payload.data  :
        Array.isArray(payload)        ? payload      : [];

      const normalized = (list || []).map((t) => {
        const statusInfo = detectStatus(t);
        const checklist = getChecklistInfo(t);
        const assignees =
          Array.isArray(t.assignees) ? t.assignees :
          Array.isArray(t.assignedTo) ? t.assignedTo :
          t.assignee ? [t.assignee] : [];
        const attachments = Array.isArray(t.attachments) ? t.attachments.filter(Boolean) : [];

        const start = t.startDate ?? t.start_date ?? t.start ?? t.startAt ?? t.startedAt ?? t.started_at ?? t.createdAt ?? null;
        const due   = t.dueDate   ?? t.due_date   ?? t.due   ?? t.deadline ?? t.endDate   ?? t.end_date   ?? null;

        const projectId =
          (t.project && (t.project._id || t.project.id)) || t.projectId || t.project_id || t.project || "";
        const workspaceId =
          (t.workspace && (t.workspace._id || t.workspace.id)) || t.workspaceId || t.workspace_id || t.workspace || "";

        return {
          ...t,
          _statusBucket: statusInfo.bucket,
          _statusLabel: statusInfo.label,
          _checklist: checklist,
          _assignees: assignees,
          _attachmentsCount: attachments.length,
          _start: start,
          _due: due,
          _projectId: normId(projectId),
          _workspaceId: normId(workspaceId),
        };
      });

      setTasks(normalized);
    } catch (err) {
      console.error("[ManageTasks] fetchTasks error:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to load tasks");
      setTasks([]);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const onFocus = () => fetchTasks();
    window.addEventListener("focus", onFocus);
    const onStorage = (e) => e?.key === "tasks:updatedAt" && fetchTasks();
    window.addEventListener("storage", onStorage);
    const onTasksUpdated = () => fetchTasks();
    window.addEventListener("tasks:updated", onTasksUpdated);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tasks:updated", onTasksUpdated);
    };
  }, [fetchTasks]);

  // ⬇️ put task id in the URL (query) so it survives refresh
  const openEdit = (task) => {
    const id = task._id || task.id;
    if (!id) return;
    const ws = task._workspaceId || "";
    const pid = task._projectId || "";

    const qsParts = [];
    if (ws)  qsParts.push(`workspace=${encodeURIComponent(ws)}`);
    if (pid) qsParts.push(`project=${encodeURIComponent(pid)}`);
    qsParts.push(`task=${encodeURIComponent(id)}`);

    navigate(`/admin/create-task?${qsParts.join("&")}`);
  };

  const handleDelete = async (e, taskId) => {
    e?.stopPropagation?.();
    if (!taskId) return;
    if (!window.confirm("Delete this task?")) return;
    try {
      setDeletingId(taskId);
      const delFactory = API_PATHS?.TASKS?.DELETE_TASK;
      const url = typeof delFactory === "function" ? delFactory(taskId) : `${API_PATHS?.TASKS?.BASE ?? "/api/tasks"}/${taskId}`;
      await axiosInstance.delete(url);
      setTasks((prev) => prev.filter((t) => (t._id || t.id) !== taskId));
      toast.success("Task deleted");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(err?.response?.data?.message || "Failed to delete task");
    } finally {
      setDeletingId(null);
    }
  };

  const downloadCSV = () => {
    try {
      const rows = [
        ["Title","Status","Priority","Start Date","Due Date","Assignees","Checklist (done/total)","Attachments"],
        ...tasks.map((t) => {
          const title = t.title || t.name || "Untitled";
          const status = t._statusLabel || t.status || t.state || "";
          const priority = t.priority || t.level || "";
          const start = t._start ? new Date(t._start).toLocaleDateString() : "";
          const due = t._due ? new Date(t._due).toLocaleDateString() : "";
          const assignees = (t._assignees || [])
            .map((u) => (typeof u === "string" ? u : (u?.name || u?.fullName || u?.email || normId(u?._id || u?.id))))
            .filter(Boolean)
            .join("; ");
          const done = t._checklist?.completed ?? 0;
          const total = t._checklist?.total ?? 0;
          const attach = t._attachmentsCount ?? 0;
          return [title, status, priority, start, due, assignees, `${done}/${total}`, String(attach)];
        }),
      ];
      const csv = rows.map(r => r.map(c => `"${(c ?? "").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      toast.error("Could not generate report");
    }
  };

  const counts = tasks.reduce(
    (acc, t) => {
      acc.all += 1;
      if (t._statusBucket === "Pending") acc.pending += 1;
      else if (t._statusBucket === "In Progress") acc.inProgress += 1;
      else if (t._statusBucket === "Completed") acc.completed += 1;
      return acc;
    },
    { all: 0, pending: 0, inProgress: 0, completed: 0 }
  );

  return (
    <DashboardLayout activeMenu="manageTasks">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">My Tasks</h1>
          <button
            onClick={downloadCSV}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Download Report
          </button>
        </div>

        <div className="mb-5 flex items-center gap-6 text-sm">
          <span className="flex items-center gap-2"><b>All</b><span className="px-2 py-0.5 rounded bg-gray-100">{counts.all}</span></span>
          <span className="flex items-center gap-2"><b>Pending</b><span className="px-2 py-0.5 rounded bg-gray-100">{counts.pending}</span></span>
          <span className="flex items-center gap-2"><b>In Progress</b><span className="px-2 py-0.5 rounded bg-gray-100">{counts.inProgress}</span></span>
          <span className="flex items-center gap-2"><b>Completed</b><span className="px-2 py-0.5 rounded bg-gray-100">{counts.completed}</span></span>
        </div>

        {loading ? (
          <div>Loading tasks…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : tasks.length === 0 ? (
          <div>No tasks found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {tasks.map((t) => {
              const id = t._id || t.id;
              const title = t.title || t.name || "Untitled";
              const statusLabel = t._statusLabel || "Pending";
              const priority = t.priority || t.level || "Low";
              const { total, completed, percent } = t._checklist || { total: 0, completed: 0, percent: 0 };
              const dueStr = t._due ? new Date(t._due).toLocaleDateString() : "-";
              const startStr = t._start ? new Date(t._start).toLocaleDateString() : "-";

              return (
                <div
                  key={id}
                  className="relative bg-white rounded-xl border shadow-sm hover:shadow-md transition overflow-hidden cursor-pointer"
                  onClick={() => openEdit(t)}
                  title="Click to update task"
                >
                  <div className="flex items-center justify-between px-4 pt-4 text-xs text-gray-500">
                    <div>
                      <div className="uppercase tracking-wider">Start Date</div>
                      <div className="text-gray-800 font-medium">{startStr}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider">Due Date</div>
                      <div className="text-gray-800 font-medium">{dueStr}</div>
                    </div>
                  </div>

                  <div className="px-4 mt-3 flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(statusLabel)}`}>{statusLabel}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${priorityBadge(priority)}`}>{cap(priority)} Priority</span>
                  </div>

                  <div className="px-4 mt-2">
                    <h3 className="text-[15px] md:text-base font-semibold text-gray-900">{title}</h3>
                    {t.description && <p className="mt-1 text-sm text-gray-600 line-clamp-2">{t.description}</p>}
                  </div>

                  <div className="px-4 mt-3">
                    <div className="text-sm text-gray-700">
                      Task Done: <span className="font-medium">{completed}</span> / {total}
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-1.5 bg-sky-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>

                  <div className="px-4 py-3 mt-3 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {(t._assignees || []).slice(0, 3).map((u, i) => {
                        const obj = typeof u === "string" ? { name: u } : (u || {});
                        const src = obj.profileImageUrl || obj.avatarUrl || obj.avatar || "";
                        const nm = obj.name || obj.fullName || obj.email || normId(obj._id || obj.id) || "User";
                        return <Avatar key={`${id}-a-${i}`} name={nm} src={src} />;
                      })}
                      {(t._assignees || []).length > 3 && (
                        <div className="w-8 h-8 rounded-full bg-gray-100 border flex items-center justify-center text-xs text-gray-600">
                          +{(t._assignees || []).length - 3}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1" title="Attachments">
                        <span>📎</span>
                        <span>{t._attachmentsCount || 0}</span>
                      </div>

                      <button
                        onClick={(e) => handleDelete(e, id)}
                        disabled={deletingId === id}
                        className={`p-2 rounded-md border hover:bg-red-50 text-red-600 ${deletingId === id ? "opacity-50 cursor-not-allowed" : ""}`}
                        title="Delete task"
                        aria-label="Delete task"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 3a1 1 0 00-1 1v1H5a1 1 0 100 2h1v12a2 2 0 002 2h8a2 2 0 002-2V7h1a1 1 0 100-2h-3V4a1 1 0 00-1-1H9zm2 4a1 1 0 112 0v10a1 1 0 11-2 0V7zm-4 0a1 1 0 112 0v10a1 1 0 11-2 0V7zm8 0a1 1 0 112 0v10a1 1 0 11-2 0V7z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
