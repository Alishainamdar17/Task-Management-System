// src/pages/Admin/ManageUsers.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS, BASE_URL } from "../../utils/apiPaths";
import toast from "react-hot-toast";
import { BiDownload } from "react-icons/bi";
import { LuList, LuLayoutGrid, LuX, LuSearch } from "react-icons/lu";

const LS_VIEW_KEY = "manage_users_view";

/* -------------------- Helpers -------------------- */

const normId = (v) => (v === undefined || v === null ? "" : String(v));

const resolveAvatar = (avatar) => {
  if (!avatar) return null;
  const str = String(avatar);
  if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:")) return str;
  const path = str.startsWith("/") ? str : `/${str}`;
  try {
    const base = axiosInstance?.defaults?.baseURL || BASE_URL || "";
    const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
    return `${normalizedBase}${path}`;
  } catch {
    return path;
  }
};

/* ---------- Unified task status detector (matches cards) ---------- */
// Returns: "Pending" | "In Progress" | "Completed"
const detectBucket = (t) => {
  const s = (v) => (v === undefined || v === null ? "" : String(v).toLowerCase().trim());

  // explicit completion flags
  if (t.completed === true || t.isCompleted === true || t.done === true || t.isDone === true) return "Completed";
  if (t.completedAt || t.closedAt || t.finishedAt || t.completed_at || t.closed_at) return "Completed";

  // numeric progress
  const prog = t.progress ?? t.percent ?? t.completionPercent ?? t.progressPercent ?? t.percentage;
  if (typeof prog === "number") {
    if (prog >= 100) return "Completed";
    if (prog > 0) return "In Progress";
  } else if (s(prog) && !Number.isNaN(Number(s(prog)))) {
    const n = Number(s(prog));
    if (n >= 100) return "Completed";
    if (n > 0) return "In Progress";
  }

  // status/state text
  const candidates = [];
  const pushIf = (v) => {
    if (v !== undefined && v !== null && v !== "") candidates.push(v);
  };
  pushIf(t.status);
  pushIf(t.state);
  pushIf(t.stage);
  if (t.status && typeof t.status === "object") pushIf(t.status.name ?? t.status.label ?? t.status.value);
  if (t.state && typeof t.state === "object") pushIf(t.state.name ?? t.state.label ?? t.state.value);

  for (const c of candidates) {
    const v = s(c);
    if (!v) continue;
    if (["done", "complete", "completed", "closed", "finished"].some((k) => v.includes(k))) return "Completed";
    if (["in progress", "in-progress", "progress", "doing", "ongoing", "active", "started"].some((k) => v.includes(k)))
      return "In Progress";
    if (["pending", "todo", "to do", "open", "new", "backlog"].some((k) => v.includes(k))) return "Pending";
  }

  // checklist heuristic
  const checklist = Array.isArray(t.todoChecklist)
    ? t.todoChecklist
    : Array.isArray(t.checklist)
    ? t.checklist
    : Array.isArray(t.todos)
    ? t.todos
    : [];
  if (checklist.length > 0) {
    const isItemDone = (it) => {
      if (!it) return false;
      if (typeof it === "boolean") return it;
      if (typeof it === "string") {
        const vs = s(it);
        return ["true", "done", "checked", "complete", "completed", "1"].includes(vs);
      }
      if (typeof it === "object") {
        if (it.completed || it.done || it.checked || it.isChecked || it.isCompleted || it.isComplete) return true;
        if (typeof it.status === "string" && s(it.status).includes("done")) return true;
        if (typeof it.state === "string" && s(it.state).includes("done")) return true;
        if (it.checkedAt || it.completedAt || it.finishedAt || it.checked_at || it.completed_at) return true;
      }
      return false;
    };
    let completed = 0;
    checklist.forEach((it) => {
      if (isItemDone(it)) completed += 1;
    });
    if (completed >= checklist.length) return "Completed";
    if (completed > 0) return "In Progress";
  }

  return "Pending";
};

const StatChip = ({ count = 0, label = "Pending", color = "purple" }) => {
  const bgClass =
    color === "purple"
      ? "bg-purple-50 text-purple-700"
      : color === "blue"
      ? "bg-sky-50 text-sky-700"
      : "bg-emerald-50 text-emerald-700";
  return (
    <div className="flex flex-col items-center text-center px-3 py-2 rounded bg-white shadow-sm">
      <div className={`text-sm font-bold ${bgClass}`}>{count}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
};

/* ---------- Counts now rely on detectBucket ---------- */
const calcCountsMap = (usersArr = [], tasksArr = []) => {
  const map = {};
  (usersArr || []).forEach((u) => {
    const id = normId(u._id ?? u.id ?? u.userId ?? u.email);
    if (id) map[id] = { pending: 0, inProgress: 0, completed: 0 };
  });

  (tasksArr || []).forEach((t) => {
    const bucket = detectBucket(t);
    const assigned = t.assignedTo ?? t.assigned ?? t.assignees ?? t.assignee ?? [];
    const assignedIds = Array.isArray(assigned)
      ? assigned.map((a) => (typeof a === "string" ? a : normId(a._id ?? a.id ?? a.value ?? a.email)))
      : [typeof assigned === "string" ? assigned : normId(assigned && (assigned._id ?? assigned.id ?? assigned.email))];

    assignedIds.forEach((uid) => {
      if (!uid) return;
      if (!map[uid]) map[uid] = { pending: 0, inProgress: 0, completed: 0 };
      if (bucket === "Completed") map[uid].completed += 1;
      else if (bucket === "In Progress") map[uid].inProgress += 1;
      else map[uid].pending += 1;
    });
  });

  return map;
};

/* -------------------- UI Pieces -------------------- */

const SkeletonCard = () => (
  <div className="animate-pulse bg-white rounded-lg shadow-sm p-4 border">
    <div className="flex items-center gap-4 mb-3">
      <div className="w-12 h-12 rounded-full bg-slate-200" />
    </div>
    <div className="grid grid-cols-3 gap-3 mt-3">
      <div className="h-12 bg-slate-200 rounded" />
      <div className="h-12 bg-slate-200 rounded" />
      <div className="h-12 bg-slate-200 rounded" />
    </div>
  </div>
);

const UserCard = ({ user, onView }) => {
  const avatarUrl = resolveAvatar(user?.avatarUrl || user?.profileImage || user?.avatar || user?.photo);
  const name = user?.name || user?.fullName || user?.username || user?.email || "Unknown";
  const email = user?.email || "";
  const counts = user?.taskCounts || { pending: 0, inProgress: 0, completed: 0 };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border h-full flex flex-col justify-between transition hover:shadow-md">
      <div className="flex items-center gap-4 mb-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-700">
            {String(name || "U").charAt(0).toUpperCase()}
          </div>
        )}

        <div>
          <div className="font-medium text-slate-800">{name}</div>
          <div className="text-sm text-slate-500">{email}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-2">
        <StatChip count={counts.pending ?? 0} label="Pending" color="purple" />
        <StatChip count={counts.inProgress ?? 0} label="In Progress" color="blue" />
        <StatChip count={counts.completed ?? 0} label="Completed" color="green" />
      </div>

      <div className="mt-4 flex justify-end">
        <button onClick={() => onView(user)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition">
          View
        </button>
      </div>
    </div>
  );
};

const UserRow = ({ user, onView }) => {
  const avatarUrl = resolveAvatar(user?.avatarUrl || user?.profileImage || user?.avatar || user?.photo);
  const name = user?.name || user?.fullName || user?.username || user?.email || "Unknown";
  const email = user?.email || "";
  const counts = user?.taskCounts || { pending: 0, inProgress: 0, completed: 0 };
  const total = (counts.pending || 0) + (counts.inProgress || 0) + (counts.completed || 0);

  return (
    <div
      className="grid items-center gap-4 px-4 py-3 hover:bg-slate-50 bg-white border-b"
      style={{ gridTemplateColumns: "64px 1fr 110px 110px 110px 120px" }}
    >
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-700">
            {String(name || "U").charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
        <div className="text-xs text-slate-500 truncate">{email}</div>
      </div>

      <div className="text-sm text-slate-700">
        <div className="font-semibold">{counts.pending ?? 0}</div>
        <div className="text-xs text-slate-400">Pending</div>
      </div>

      <div className="text-sm text-slate-700">
        <div className="font-semibold">{counts.inProgress ?? 0}</div>
        <div className="text-xs text-slate-400">In Progress</div>
      </div>

      <div className="text-sm text-slate-700">
        <div className="font-semibold">{counts.completed ?? 0}</div>
        <div className="text-xs text-slate-400">Completed</div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <div className="text-sm text-slate-600">{total}</div>
        <button onClick={() => onView(user)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition">
          View
        </button>
      </div>
    </div>
  );
};

/* -------------------- Modal -------------------- */

const UserModal = ({ open, onClose, user, tasksForUser, loading }) => {
  if (!open || !user) return null;
  const avatarUrl = resolveAvatar(user?.avatarUrl || user?.profileImage || user?.avatar || user?.photo);
  const name = user?.name || user?.fullName || user?.username || user?.email || "Unknown";
  const email = user?.email || "";
  const role = user?.role ?? user?.roleName ?? "";
  const counts = user?.taskCounts || { pending: 0, inProgress: 0, completed: 0 };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-lg shadow-lg overflow-auto max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <div className="text-lg font-semibold">User Details</div>
            <div className="text-sm text-slate-500">Profile & assigned tasks</div>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-800 p-2 rounded" aria-label="Close">
            <LuX />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="flex gap-6 items-start">
            <div>
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-28 h-28 rounded-full object-cover" />
              ) : (
                <div className="w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-semibold text-slate-700">
                  {String(name || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="text-xl font-semibold">{name}</div>
              <div className="text-sm text-slate-500 mb-2">{email}</div>
              {role && <div className="text-sm text-slate-600 mb-2">Role: {role}</div>}

              <div className="flex gap-3 mt-3">
                <StatChip count={counts.pending ?? 0} label="Pending" color="purple" />
                <StatChip count={counts.inProgress ?? 0} label="In Progress" color="blue" />
                <StatChip count={counts.completed ?? 0} label="Completed" color="green" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Assigned Tasks</h3>
              <div className="text-sm text-slate-500">{loading ? "Loading..." : `${tasksForUser.length} tasks`}</div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="animate-pulse border rounded p-3">
                    <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-1/4" />
                  </div>
                ))}
              </div>
            ) : tasksForUser.length === 0 ? (
              <div className="text-sm text-slate-500">No tasks assigned to this user.</div>
            ) : (
              <div className="space-y-3">
                {tasksForUser.map((t) => {
                  const due = t.duedate ?? t.dueDate ?? t.due ?? null;
                  const label = detectBucket(t); // use unified label in modal too
                  return (
                    <div key={t._id || t.id} className="border rounded p-3 flex items-start justify-between">
                      <div className="min-w-0 pr-4">
                        <div className="font-medium text-slate-800 truncate">{t.title ?? t.name ?? "Untitled"}</div>
                        <div className="text-xs text-slate-500 truncate mt-1">{t.description ?? ""}</div>
                        <div className="text-xs text-slate-500 mt-2">Due: {due ? new Date(due).toLocaleDateString() : "-"}</div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{label}</div>
                        <div className="text-xs text-slate-500">{(t.todoChecklist || t.checklist || []).length} subtasks</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded text-sm">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------- Main Page -------------------- */

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(() => localStorage.getItem(LS_VIEW_KEY) || "grid");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserTasks, setSelectedUserTasks] = useState([]);
  const [loadingUserTasks, setLoadingUserTasks] = useState(false);

  const fetchUsers = useCallback(async () => {
    const path = API_PATHS?.USERS?.GET_ALL_USERS ?? "/api/users";
    const res = await axiosInstance.get(path);
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : data?.users ?? data?.data ?? [];
  }, []);

  const fetchTasks = useCallback(async () => {
    const path = API_PATHS?.TASKS?.GET_ALL_TASKS ?? "/api/tasks";
    const res = await axiosInstance.get(path);
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : data?.tasks ?? data?.data ?? [];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersArr, tasksArr] = await Promise.all([fetchUsers(), fetchTasks()]);
      setTasks(tasksArr || []);
      const countsMap = calcCountsMap(usersArr || [], tasksArr || []);
      const usersWithCounts = (usersArr || []).map((u) => {
        const id = normId(u._id ?? u.id ?? u.userId ?? u.email);
        return { ...u, taskCounts: countsMap[id] || { pending: 0, inProgress: 0, completed: 0 } };
      });
      setUsers(usersWithCounts);
    } catch (err) {
      console.error("[ManageUsers] load error", err);
      toast.error("Failed to fetch team data");
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, fetchTasks]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    localStorage.setItem(LS_VIEW_KEY, view);
  }, [view]);

  /* -------------------- Download Report -------------------- */

  const makeUsersCSV = (list) => {
    const rows = [
      ["Name", "Email", "Pending", "In Progress", "Completed", "Total"],
      ...list.map((u) => {
        const name = u?.name || u?.fullName || u?.username || u?.email || "Unknown";
        const email = u?.email || "";
        const p = u?.taskCounts?.pending ?? 0;
        const ip = u?.taskCounts?.inProgress ?? 0;
        const c = u?.taskCounts?.completed ?? 0;
        const total = p + ip + c;
        return [name, email, String(p), String(ip), String(c), String(total)];
      }),
    ];
    return rows.map((r) => r.map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
  };

  const getFilenameFromContentDisposition = (headerValue) => {
    if (!headerValue) return null;
    const m = /filename\*?=(?:UTF-8'')?["']?([^;"']+)["']?/i.exec(headerValue);
    if (m && m[1]) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return m[1];
      }
    }
    return null;
  };

  const handleDownload = async () => {
    const toastId = "download-report";
    const endpoint = API_PATHS?.REPORTS?.EXPORT_USERS;

    // Try server export first
    if (endpoint) {
      try {
        toast.loading("Preparing report…", { id: toastId });
        const res = await axiosInstance.get(endpoint, { responseType: "arraybuffer" });
        const ct = (res.headers?.["content-type"] || res.headers?.["Content-Type"] || "").toLowerCase();
        if (ct.includes("application/json")) throw new Error("Server returned JSON, not a file");

        const blob = new Blob([res.data], { type: ct || "application/octet-stream" });
        const disp = res.headers?.["content-disposition"] || res.headers?.["Content-Disposition"];
        const filename = getFilenameFromContentDisposition(disp) || "team_members_report.xlsx";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast.success("Report downloaded", { id: toastId });
        return;
      } catch (err) {
        console.warn("[ManageUsers] server export failed → fallback to CSV", err);
      }
    }

    // CSV fallback (uses current filtered set)
    try {
      const list = filteredUsers?.length ? filteredUsers : users;
      if (!list || list.length === 0) {
        toast.error("No users to export", { id: toastId });
        return;
      }
      const csv = makeUsersCSV(list);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `team_members_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("CSV exported", { id: toastId });
    } catch (e) {
      console.error("CSV export failed", e);
      toast.error("Failed to download report", { id: toastId });
    }
  };

  /* -------------------- Filter / Modal -------------------- */

  const filteredUsers = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u?.name || u?.fullName || u?.username || "").toLowerCase();
      const email = (u?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, query]);

  const handleViewUser = async (user) => {
    setSelectedUser(user);
    setModalOpen(true);
    setSelectedUserTasks([]);
    setLoadingUserTasks(true);

    const uid = normId(user._id ?? user.id ?? user.userId ?? user.email);
    const derived = (tasks || []).filter((t) => {
      const assigned = t.assignedTo ?? t.assigned ?? t.assignees ?? t.assignee ?? [];
      const ids = Array.isArray(assigned)
        ? assigned.map((a) => (typeof a === "string" ? a : normId(a._id ?? a.id ?? a.value ?? a.email)))
        : [typeof assigned === "string" ? assigned : normId(assigned && (assigned._id ?? assigned.id ?? assigned.email))];
      return ids.includes(uid);
    });

    try {
      if (API_PATHS?.USERS?.GET_USER_BY_ID) {
        const getUrl =
          typeof API_PATHS.USERS.GET_USER_BY_ID === "function"
            ? API_PATHS.USERS.GET_USER_BY_ID(uid)
            : `${API_PATHS.USERS.GET_USER_BY_ID}${uid}`;
        const res = await axiosInstance.get(getUrl);
        const data = res?.data ?? res;
        const serverTasks = data?.tasks ?? data?.assignedTasks ?? null;
        setSelectedUserTasks(Array.isArray(serverTasks) ? serverTasks : derived);
      } else {
        setSelectedUserTasks(derived);
      }
    } catch (err) {
      console.warn("fetch single user details failed", err);
      setSelectedUserTasks(derived);
    } finally {
      setLoadingUserTasks(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedUser(null);
    setSelectedUserTasks([]);
  };

  /* -------------------- Render -------------------- */

  return (
    <DashboardLayout activeMenu="Manage Users">
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Team Members</h1>
            <div className="text-sm text-slate-500 mt-1">Manage team and see assigned tasks</div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex items-center bg-white border rounded px-3 py-2 w-full md:w-80">
              <LuSearch className="text-slate-400 mr-2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email"
                className="outline-none w-full text-sm"
              />
            </div>

            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded"
            >
              <BiDownload /> Download Report
            </button>

            <div className="flex items-center gap-1 border rounded overflow-hidden">
              <button
                onClick={() => setView("grid")}
                className={`px-3 py-2 ${view === "grid" ? "bg-blue-600 text-white" : "bg-white text-slate-700"}`}
                title="Grid view"
              >
                <LuLayoutGrid />
              </button>
              <button
                onClick={() => setView("list")}
                className={`px-3 py-2 ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-slate-700"}`}
                title="List view"
              >
                <LuList />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No team members found</div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((u) => (
              <UserCard key={u._id || u.id || u.email} user={u} onView={handleViewUser} />
            ))}
          </div>
        ) : (
          <div className="border rounded overflow-hidden">
            <div className="bg-slate-100 border-b">
              <div
                className="grid items-center gap-4 px-4 py-2 text-xs text-slate-600 uppercase"
                style={{ gridTemplateColumns: "64px 1fr 110px 110px 110px 120px" }}
              >
                <div>Avatar</div>
                <div>Name / Email</div>
                <div>Pending</div>
                <div>In Progress</div>
                <div>Completed</div>
                <div className="text-right">Total / Actions</div>
              </div>
            </div>

            <div>
              {filteredUsers.map((u) => (
                <UserRow key={u._id || u.id || u.email} user={u} onView={handleViewUser} />
              ))}
            </div>
          </div>
        )}
      </div>

      <UserModal
        open={modalOpen}
        onClose={closeModal}
        user={selectedUser}
        tasksForUser={selectedUserTasks}
        loading={loadingUserTasks}
      />
    </DashboardLayout>
  );
}
