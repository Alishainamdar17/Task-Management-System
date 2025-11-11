import React, { useEffect, useMemo, useState, useContext, useCallback } from "react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { BiDownload } from "react-icons/bi";
import { UserContext } from "../../context/userContext";

/* --- Checklist helpers --- */
const normalizeChecklistItem = (it) => {
  if (it == null) return { text: "", completed: false, raw: it };
  if (typeof it === "string") return { text: it, completed: false, raw: it };
  const text = it.text ?? it.title ?? it.name ?? it.label ?? "";
  const completed = !!(it.isDone || it.done || it.completed || it.checked || it.is_completed);
  return { ...it, text, completed, raw: it };
};

const findChecklist = (raw) => {
  if (!raw || typeof raw !== "object") return [];
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
  return [];
};

const computeFromChecklist = (raw) => {
  const arr = findChecklist(raw) || [];
  const normalized = arr.map(normalizeChecklistItem);
  const total = normalized.length;
  const done = normalized.filter((i) => i.completed).length;
  const progress = total === 0 ? (typeof raw.progress === "number" ? raw.progress : 0) : Math.round((done / total) * 100);
  const completed = total > 0 ? done === total : !!(raw.completed || raw.isCompleted || raw.is_completed);
  return { checklist: normalized, checklistCount: total, checklistDone: done, progress, completed };
};

/* --- UI helpers --- */
const priorityClass = (p) => {
  const v = String(p || "").toLowerCase();
  if (v === "high") return "bg-red-100 text-red-700";
  if (v === "medium") return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
};

/* Avatar (safe) */
const Avatar = ({ user, className = "w-8 h-8" }) => {
  const name = user?.name || user?.fullName || user?.email || "U";
  const initials = name
    .split(" ")
    .map((s) => (s ? s[0] : ""))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const src = String(user?.profileImageUrl || user?.avatarUrl || user?.avatar || "").trim();
  if (src) return <img src={src} alt={name} title={name} className={`${className} rounded-full object-cover`} />;
  return (
    <div title={name} className={`${className} rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-700`}>
      {initials}
    </div>
  );
};

const TaskCard = ({ task, onView }) => {
  const progress = task.progress ?? 0;
  const title = task.title || task.name || "Untitled";
  const description = task.description || task.subtitle || "";
  const assignees = task.assignees || task.assignedUsers || task.assignedTo || task.assigned || [];
  const s = String(task.status || task.state || "").toLowerCase();

  const isCompleted =
    !!(
      task.completed === true ||
      task.isCompleted === true ||
      task.is_completed === true ||
      (typeof progress === "number" && progress >= 100) ||
      s.includes("done") ||
      s.includes("complete")
    );

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border hover:shadow-lg transition">
      <div className="flex items-start justify-between mb-3">
        <div className="space-x-2 flex items-center">
          <span className={`px-2 py-1 rounded text-xs font-medium ${priorityClass(task.priority)}`}>
            {String(task.priority ?? "Low").replace(/^\w/, (c) => c.toUpperCase())}
          </span>
          {!isCompleted && s.includes("pend") && <span className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700">Pending</span>}
          {!isCompleted && (s.includes("progress") || s.includes("in-progress") || s.includes("inprogress")) && (
            <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">In Progress</span>
          )}
          {isCompleted && <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700">Completed</span>}
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2 cursor-pointer" onClick={() => onView(task)}>
        {title}
      </h3>

      <p className="text-sm text-slate-600 mb-3 line-clamp-3">{description}</p>

      <div className="flex items-center justify-between text-sm text-slate-600 mb-3">
        <div>
          <div className="text-xs text-slate-500">Start Date</div>
          <div className="font-medium">{task.startDate ? new Date(task.startDate).toLocaleDateString() : "-"}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Due Date</div>
          <div className="font-medium">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="h-2 w-full bg-slate-100 rounded overflow-hidden">
          <div style={{ width: `${progress}%` }} className="h-2 bg-blue-500" />
        </div>
        <div className="text-xs text-slate-500 mt-1">{progress}% done</div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex -space-x-2">
          {(assignees || []).slice(0, 4).map((u, i) => {
            const userObj = typeof u === "string" ? { name: u } : u || {};
            return (
              <div key={i} className="w-8 h-8">
                <Avatar user={userObj} />
              </div>
            );
          })}
        </div>
        <div className="text-xs text-slate-500">{task.checklistCount ?? 0} Tasks</div>
      </div>

      <div className="mt-2">
        <button onClick={() => onView(task)} className="px-3 py-1 rounded bg-slate-50 hover:bg-slate-100 text-sm">
          View
        </button>
      </div>
    </div>
  );
};

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "inProgress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({ all: 0, pending: 0, inProgress: 0, completed: 0 });
  const navigate = useNavigate();
  const { user } = useContext(UserContext);

  const isTaskCompleted = (t) => {
    if (!t) return false;
    if (t.completed === true || t.isCompleted === true || t.is_completed === true) return true;
    if ((typeof t.progress === "number" && t.progress >= 100) || (typeof t.percent === "number" && t.percent >= 100)) return true;
    const s = String(t.status || t.state || "").toLowerCase();
    if (s.includes("done") || s.includes("complete") || s.includes("completed")) return true;
    const raw = t.__raw ?? t;
    if (raw?.isDone === true || raw?.done === true) return true;
    return false;
  };

  const isTaskInProgress = (t) => {
    if (!t) return false;
    const s = String(t.status || t.state || "").toLowerCase();
    if (s.includes("progress") || s.includes("in-progress") || s.includes("inprogress")) return true;
    const prog = typeof t.progress === "number" ? t.progress : typeof t.percent === "number" ? t.percent : 0;
    if (prog > 0 && prog < 100) return true;
    return false;
  };

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(API_PATHS.TASKS.GET_ALL_TASKS);
      const payload = res?.data ?? res ?? {};
      const arr = Array.isArray(payload) ? payload : Array.isArray(payload.tasks) ? payload.tasks : Array.isArray(payload.data) ? payload.data : [];
      const normalized = (arr || []).map((item) => {
        const raw = item?.task ?? item ?? {};
        const id = raw._id ?? raw.id;
        const checklistInfo = computeFromChecklist(raw);
        return {
          ...raw,
          _id: id,
          id,
          status: raw.status ?? raw.state ?? raw.status_text ?? null,
          completed: checklistInfo.completed || raw.completed || raw.isCompleted || raw.is_completed || false,
          progress: checklistInfo.progress ?? (typeof raw.progress === "number" ? raw.progress : 0),
          checklist: checklistInfo.checklist,
          checklistCount: checklistInfo.checklistCount,
          checklistDone: checklistInfo.checklistDone,
          __raw: raw,
        };
      });
      setTasks(normalized);
    } catch (err) {
      console.error("[MyTasks] fetch error:", err);
      toast.error("Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();

    const onFocus = () => {
      fetchTasks();
    };
    window.addEventListener("focus", onFocus);

    const onStorage = (e) => {
      if (e.key === "tasks:updatedAt") fetchTasks();
    };
    window.addEventListener("storage", onStorage);

    const onTasksUpdated = () => {
      fetchTasks();
    };
    window.addEventListener("tasks:updated", onTasksUpdated);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tasks:updated", onTasksUpdated);
    };
  }, [fetchTasks]);

  useEffect(() => {
    const c = { all: tasks.length, pending: 0, inProgress: 0, completed: 0 };
    tasks.forEach((t) => {
      if (isTaskCompleted(t)) c.completed++;
      else if (isTaskInProgress(t)) c.inProgress++;
      else c.pending++;
    });
    setCounts(c);
  }, [tasks]);

  const filtered = useMemo(() => {
    if (filterStatus === "all") return tasks;
    return tasks.filter((t) => {
      if (filterStatus === "pending") return !isTaskCompleted(t) && !isTaskInProgress(t);
      if (filterStatus === "inProgress") return isTaskInProgress(t) && !isTaskCompleted(t);
      if (filterStatus === "completed") return isTaskCompleted(t);
      return true;
    });
  }, [tasks, filterStatus]);

  const handleView = (task) => {
    const id = task._id || task.id;
    navigate(`/user/task-details/${id}`);
  };

  const handleDownloadReport = async () => {
    try {
      const res = await axiosInstance.get(API_PATHS.REPORTS.EXPORT_TASKS, { responseType: "blob" });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tasks_report.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch (err) {
      console.error("Download report failed", err);
      toast.error("Failed to download report");
    }
  };

  return (
    <DashboardLayout activeMenu="My Tasks">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">My Tasks</h1>

          <div className="flex items-center gap-3">
            <button onClick={handleDownloadReport} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded">
              <BiDownload /> Download Report
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-2 rounded text-sm font-medium ${filterStatus === tab.key ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-700"}`}
            >
              {tab.label} {tab.key === "all" ? `(${counts.all})` : tab.key === "pending" ? `(${counts.pending})` : tab.key === "inProgress" ? `(${counts.inProgress})` : `(${counts.completed})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">Loading tasks...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No tasks to show</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((task) => (
              <TaskCard key={task._id || task.id} task={task} onView={handleView} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
