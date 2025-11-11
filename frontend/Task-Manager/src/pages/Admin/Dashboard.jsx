// src/pages/Admin/Dashboard.jsx
import React, { useContext, useEffect, useState, useMemo, useCallback } from "react";
import { useUserAuth } from "../../hooks/useUserAuth";
import { UserContext } from "../../context/userContext";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import moment from "moment";
import Infocard from "../../components/Cards/Infocard";
import { LuArrowRight } from "react-icons/lu";
import TaskListTable from "../../components/TaskListTable";
import CustomPieChart from "../../components/Charts/CustomPieChart";
import CustomBarChart from "../../components/Charts/CustomBarChart";
import { addThousandsSeparator } from "../../utils/helper";
import Footer from "../../components/layouts/Footer";

const COLORS = ["#8D51FF", "#00B8DB", "#7BCE00"];

/* ---------- helpers (same spirit as user dashboard) ---------- */
const normalizeChecklistItem = (it) => {
  if (!it) return { text: "", completed: false, raw: it };
  if (typeof it === "string") return { text: it, completed: false, raw: it };
  const text = it.text ?? it.title ?? it.name ?? it.label ?? "";
  const completed = !!(it.isDone || it.done || it.completed || it.checked || it.is_completed);
  return { ...it, text, completed, raw: it };
};

const findChecklistArray = (raw) => {
  if (!raw || typeof raw !== "object") return [];
  const keys = [
    "todoChecklist","subtasks","subTasks","sub_tasks","checklist","todos",
    "items","tasks","check_items","todo_items","taskItems","data","list",
  ];
  for (const k of keys) {
    const v = raw[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object" && Array.isArray(v.data)) return v.data;
  }
  return [];
};

const computeProgressFromChecklist = (raw) => {
  const arr = findChecklistArray(raw) || [];
  const normalized = arr.map(normalizeChecklistItem);
  const total = normalized.length;
  const done = normalized.filter((i) => i.completed).length;
  const progress =
    total === 0
      ? typeof raw?.progress === "number"
        ? raw.progress
        : 0
      : Math.round((done / total) * 100);
  const completed =
    total > 0
      ? done === total
      : !!(raw?.completed || raw?.isCompleted || raw?.is_completed || progress >= 100);
  return { progress, completed, total, done, checklist: normalized };
};

/* --- NEW: clean status label for table rows --- */
const deriveStatusLabel = (raw) => {
  const task = raw?.task ?? raw ?? {};
  const p = computeProgressFromChecklist(task);
  const prog = p.progress ?? (typeof task.progress === "number" ? task.progress : 0);
  const statusStr = String(task.status || task.state || "").toLowerCase();

  const done =
    p.completed ||
    !!(task.completed || task.isCompleted || task.is_completed) ||
    prog >= 100 ||
    statusStr.includes("done") ||
    statusStr.includes("complete");

  if (done) return "Completed";

  const inProg =
    prog > 0 ||
    statusStr.includes("progress") ||
    statusStr.includes("in-progress") ||
    statusStr.includes("ongoing");

  if (inProg) return "In Progress";

  return "Pending";
};

const deriveCountsFromTasks = (tasksArray = []) => {
  const counts = { total: tasksArray.length, pending: 0, inProgress: 0, completed: 0 };
  tasksArray.forEach((raw) => {
    const label = deriveStatusLabel(raw);
    if (label === "Completed") counts.completed++;
    else if (label === "In Progress") counts.inProgress++;
    else counts.pending++;
  });
  return counts;
};

const buildChartsFromServerOrTasks = (charts = {}, tasks = []) => {
  const taskDistribution = charts.taskDistribution || charts.task_distribution || charts.distribution || {};
  const taskPriorityLevels = charts.taskPriorityLevels || charts.task_priority_levels || {};

  const getCount = (obj, keys) => {
    for (const key of keys) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
        return Number(obj[key]) || 0;
      }
    }
    return 0;
  };

  const pie = [
    { status: "Pending",   count: getCount(taskDistribution, ["pending","Pending"]) },
    { status: "In Progress", count: getCount(taskDistribution, ["inProgress","in-progress","inprogress","In Progress"]) },
    { status: "Completed", count: getCount(taskDistribution, ["completed","Completed"]) },
  ];

  if (pie[0].count + pie[1].count + pie[2].count === 0 && Array.isArray(tasks) && tasks.length > 0) {
    const derived = deriveCountsFromTasks(tasks);
    pie[0].count = derived.pending;
    pie[1].count = derived.inProgress;
    pie[2].count = derived.completed;
  }

  const pieWithNames = pie.map((d) => ({ ...d, name: d.status, value: d.count }));

  const bar = [
    { priority: "Low",    count: getCount(taskPriorityLevels, ["low","Low"]),       name: "Low",    value: getCount(taskPriorityLevels, ["low","Low"]) },
    { priority: "Medium", count: getCount(taskPriorityLevels, ["medium","Medium"]), name: "Medium", value: getCount(taskPriorityLevels, ["medium","Medium"]) },
    { priority: "High",   count: getCount(taskPriorityLevels, ["high","High"]),     name: "High",   value: getCount(taskPriorityLevels, ["high","High"]) },
  ];

  if ((bar[0].value + bar[1].value + bar[2].value) === 0 && Array.isArray(tasks) && tasks.length > 0) {
    const pri = { Low: 0, Medium: 0, High: 0 };
    tasks.forEach((t) => {
      const task = t?.task ?? t ?? {};
      const p = String(task.priority || "").toLowerCase();
      if (p.includes("high")) pri.High++;
      else if (p.includes("med")) pri.Medium++;
      else pri.Low++;
    });
    bar[0].count = bar[0].value = pri.Low;
    bar[1].count = bar[1].value = pri.Medium;
    bar[2].count = bar[2].value = pri.High;
  }

  return { pie: pieWithNames, bar };
};

/* -------------------- Admin Dashboard -------------------- */
export default function Dashboard() {
  useUserAuth();
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [pieChartData, setPieChartData] = useState([]);
  const [barChartData, setBarChartData] = useState([]);
  const [allTasksCache, setAllTasksCache] = useState([]);

  const adminDashboardPath =
    API_PATHS?.TASKS?.DASHBOARD_ADMIN || "/api/tasks/dashboard/admin";
  const adminAllTasksPath =
    API_PATHS?.TASKS?.GET_ALL_TASKS || "/api/tasks";

  const getDashboardData = useCallback(async () => {
    try {
      const res = await axiosInstance.get(adminDashboardPath);
      const data = res?.data ?? {};
      const payload = data?.data ?? data ?? {};
      const charts = payload?.charts ?? payload?.chart ?? {};
      const recentTasks = Array.isArray(payload?.recentTasks)
        ? payload.recentTasks
        : Array.isArray(payload?.tasks)
        ? payload.tasks
        : [];
      const normalizedRecent = recentTasks.map((r) => (r?.task ? r.task : r));
      return { ok: true, payload: { payload, charts, recentTasks: normalizedRecent } };
    } catch (err) {
      console.error("[AdminDashboard] GET DASHBOARD failed:", err);
      return { ok: false, error: err };
    }
  }, [adminDashboardPath]);

  const fetchAllTasks = useCallback(async () => {
    try {
      const url =
        adminAllTasksPath + (adminAllTasksPath.includes("?") ? `&t=${Date.now()}` : `?t=${Date.now()}`);
      const res = await axiosInstance.get(url);
      const body = res?.data ?? {};
      const arr = Array.isArray(body)
        ? body
        : Array.isArray(body.tasks)
        ? body.tasks
        : Array.isArray(body.data)
        ? body.data
        : [];
      return arr;
    } catch (err) {
      console.error("[AdminDashboard] GET ALL TASKS failed:", err);
      return [];
    }
  }, [adminAllTasksPath]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const dashRes = await getDashboardData();
      const tasksArr = await fetchAllTasks();

      if (dashRes.ok && dashRes.payload) {
        const { payload, charts, recentTasks } = dashRes.payload;

        const tCnt = payload?.payload?.totalTasks ?? payload?.payload?.total ?? payload?.totalTasks ?? payload?.total;
        const pCnt = payload?.payload?.pendingTasks ?? payload?.payload?.charts?.taskDistribution?.pending ?? payload?.pendingTasks;
        const iCnt = payload?.payload?.inProgressTasks ?? payload?.payload?.charts?.taskDistribution?.inProgress ?? payload?.inProgressTasks;
        const cCnt = payload?.payload?.completedTasks ?? payload?.payload?.charts?.taskDistribution?.completed ?? payload?.completedTasks;

        const serverHasCounts = [tCnt, pCnt, iCnt, cCnt].some((v) => typeof v === "number" && !Number.isNaN(v));

        if (serverHasCounts) {
          setDashboardData((prev) => ({
            ...(prev || {}),
            ...payload.payload,
            charts: charts || payload.payload?.charts || {},
            recentTasks: recentTasks || payload.payload?.recentTasks || [],
            totalTasks: tCnt,
            pendingTasks: pCnt,
            inProgressTasks: iCnt,
            completedTasks: cCnt,
          }));
          const { pie, bar } = buildChartsFromServerOrTasks(charts, recentTasks || tasksArr);
          setPieChartData(pie);
          setBarChartData(bar);
          setAllTasksCache(tasksArr);
          setLoading(false);
          return;
        }
      }

      // fallback: derive from tasksArr
      const derived = deriveCountsFromTasks(tasksArr);
      setDashboardData({
        totalTasks: derived.total,
        pendingTasks: derived.pending,
        inProgressTasks: derived.inProgress,
        completedTasks: derived.completed,
        charts: { taskDistribution: { pending: derived.pending, inProgress: derived.inProgress, completed: derived.completed, All: derived.total } },
        recentTasks: tasksArr.slice(0, 10).map((t) => (t?.task ? t.task : t)),
      });

      const { pie, bar } = buildChartsFromServerOrTasks({}, tasksArr);
      setPieChartData(pie);
      setBarChartData(bar);
      setAllTasksCache(tasksArr);
    } catch (err) {
      console.error("[AdminDashboard] refreshAll error:", err);
      setErrorMsg("Failed to refresh dashboard");
    } finally {
      setLoading(false);
    }
  }, [getDashboardData, fetchAllTasks]);

  useEffect(() => {
    if (user?.role === "admin") refreshAll();

    const onFocus = () => refreshAll();
    const onStorage = (e) => { if (e.key === "tasks:updatedAt") refreshAll(); };
    const onTasksUpdated = () => refreshAll();

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener("tasks:updated", onTasksUpdated);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tasks:updated", onTasksUpdated);
    };
  }, [user, refreshAll]);

  /* computed card values */
  const cardValues = useMemo(() => {
    const charts = dashboardData?.charts || {};
    const total =
      dashboardData?.totalTasks ??
      charts?.taskDistribution?.All ??
      allTasksCache.length;
    const derived = deriveCountsFromTasks(allTasksCache);
    const pending =
      dashboardData?.pendingTasks ??
      charts?.taskDistribution?.pending ??
      derived.pending;
    const inProgress =
      dashboardData?.inProgressTasks ??
      charts?.taskDistribution?.inProgress ??
      derived.inProgress;
    const completed =
      dashboardData?.completedTasks ??
      charts?.taskDistribution?.completed ??
      derived.completed;

    return {
      total: Number(total || 0),
      pending: Number(pending || 0),
      inProgress: Number(inProgress || 0),
      completed: Number(completed || 0),
    };
  }, [dashboardData, allTasksCache]);

  const onSeeMore = () => navigate("/admin/tasks");
  const pieHasData = pieChartData.some((d) => (Number(d.value) || 0) > 0);

  /* --- NEW: attach derived status for the table --- */
  const recentWithStatus = useMemo(() => {
    const arr = dashboardData?.recentTasks || [];
    return arr.map((r) => {
      const base = r?.task ? r.task : r;
      const status = base.status || deriveStatusLabel(base);
      return { ...base, status, statusText: status };
    });
  }, [dashboardData?.recentTasks]);

  return (
    <DashboardLayout activeMenu="Dashboard">
      <div className="card my-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl md:text-2xl">
              Hello! {user?.name ?? "Admin"}
            </h2>
            <p className="text-xs md:text-[13px] text-gray-400 mt-1.5">
              {moment().format("dddd Do MMM YYYY")}
            </p>
          </div>
          <button className="px-3 py-2 border rounded" onClick={refreshAll}>
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mt-5">
          <Infocard label="Total Tasks" value={addThousandsSeparator(cardValues.total)} color="bg-blue-600" />
          <Infocard label="Pending Tasks" value={addThousandsSeparator(cardValues.pending)} color="bg-violet-500" />
          <Infocard label="In Progress Tasks" value={addThousandsSeparator(cardValues.inProgress)} color="bg-cyan-500" />
          <Infocard label="Completed Tasks" value={addThousandsSeparator(cardValues.completed)} color="bg-lime-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4 md:my-6">
        <div>
          <div className="card">
            <h5>Task Distribution</h5>
            {loading ? (
              <div className="py-12 text-center text-slate-500">Loading chart...</div>
            ) : pieHasData ? (
              <div className="h-64">
                <CustomPieChart data={pieChartData} colors={COLORS} />
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">{errorMsg || "No distribution data"}</div>
            )}
          </div>
        </div>

        <div>
          <div className="card">
            <h5>Task Priority Levels</h5>
            {loading ? (
              <div className="py-12 text-center text-slate-500">Loading chart...</div>
            ) : (
              <div className="h-64">
                <CustomBarChart data={barChartData} />
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between">
              <h5 className="text-lg">Recent Tasks</h5>
              <button className="card-btn" onClick={onSeeMore}>
                See All <LuArrowRight className="text-base" />
              </button>
            </div>
            {loading ? (
              <div className="py-12 text-center text-slate-500">Loading recent tasks...</div>
            ) : errorMsg ? (
              <div className="py-8 text-center text-rose-500">{errorMsg}</div>
            ) : recentWithStatus.length ? (
              <TaskListTable tableData={recentWithStatus} />
            ) : (
              <div className="py-8 text-center text-slate-400">No recent tasks available</div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </DashboardLayout>
  );
}
