import React, {
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
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

const COLORS = ["#8D51FF", "#00B8DB", "#7BCE00"];

/* small helpers */
const normalizeChecklistItem = (it) => {
  if (!it) return { text: "", completed: false, raw: it };
  if (typeof it === "string") return { text: it, completed: false, raw: it };
  const text = it.text ?? it.title ?? it.name ?? it.label ?? "";
  const completed = !!(
    it.isDone ||
    it.done ||
    it.completed ||
    it.checked ||
    it.is_completed
  );
  return { ...it, text, completed, raw: it };
};

const findChecklistArray = (raw) => {
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

const computeProgressFromChecklist = (raw) => {
  const arr = findChecklistArray(raw) || [];
  const normalized = arr.map(normalizeChecklistItem);
  const total = normalized.length;
  const done = normalized.filter((i) => i.completed).length;
  const progress =
    total === 0
      ? typeof raw.progress === "number"
        ? raw.progress
        : 0
      : Math.round((done / total) * 100);
  const completed =
    total > 0
      ? done === total
      : !!(
          raw.completed ||
          raw.isCompleted ||
          raw.is_completed ||
          progress >= 100
        );
  return { progress, completed, total, done, checklist: normalized };
};

/** 👉 USER-FRIENDLY STATUS LABEL for each task */
const computeStatusLabel = (rawTask) => {
  const task = rawTask?.task ?? rawTask ?? {};
  const txt = String(task.status || task.state || "").toLowerCase();

  // first, trust explicit status text when it clearly says done/progress
  if (txt.includes("done") || txt.includes("complete")) return "Completed";
  if (txt.includes("in progress") || txt.includes("progress")) {
    return "In Progress";
  }

  const p = computeProgressFromChecklist(task);
  if (p.completed) return "Completed";
  if (p.progress > 0) return "In Progress";
  return "Pending";
};

const deriveCountsFromTasks = (tasksArray = []) => {
  const counts = {
    total: tasksArray.length,
    pending: 0,
    inProgress: 0,
    completed: 0,
  };
  tasksArray.forEach((raw) => {
    const task = raw?.task ?? raw ?? {};
    const p = computeProgressFromChecklist(task);
    const prog =
      p.progress ??
      (typeof task.progress === "number" ? task.progress : 0);
    const statusStr = String(task.status || task.state || "").toLowerCase();
    const done =
      p.completed ||
      !!(task.completed || task.isCompleted || task.is_completed) ||
      prog >= 100 ||
      statusStr.includes("done") ||
      statusStr.includes("complete");
    const inProg =
      !done &&
      (prog > 0 ||
        statusStr.includes("progress") ||
        statusStr.includes("in-progress"));
    if (done) counts.completed++;
    else if (inProg) counts.inProgress++;
    else counts.pending++;
  });
  return counts;
};

/* build pie and bar datasets either from server charts or from tasks array */
const buildChartsFromServerOrTasks = (charts = {}, tasks = []) => {
  const taskDistribution =
    charts.taskDistribution ||
    charts.task_distribution ||
    charts.distribution ||
    {};
  const taskPriorityLevels =
    charts.taskPriorityLevels || charts.task_priority_levels || {};

  const getCount = (obj, keys) => {
    for (const key of keys) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
        return Number(obj[key]) || 0;
      }
    }
    return 0;
  };

  const pie = [
    {
      status: "Pending",
      count: getCount(taskDistribution, ["pending", "Pending"]),
    },
    {
      status: "In Progress",
      count: getCount(taskDistribution, [
        "inProgress",
        "in-progress",
        "inprogress",
        "In Progress",
      ]),
    },
    {
      status: "Completed",
      count: getCount(taskDistribution, ["completed", "Completed"]),
    },
  ];

  // if server didn't provide pie counts, derive them from tasks
  if (
    pie[0].count + pie[1].count + pie[2].count === 0 &&
    Array.isArray(tasks) &&
    tasks.length > 0
  ) {
    const derived = deriveCountsFromTasks(tasks);
    pie[0].count = derived.pending;
    pie[1].count = derived.inProgress;
    pie[2].count = derived.completed;
  }

  const bar = [
    { priority: "Low", count: getCount(taskPriorityLevels, ["low", "Low"]) },
    {
      priority: "Medium",
      count: getCount(taskPriorityLevels, ["medium", "Medium"]),
    },
    { priority: "High", count: getCount(taskPriorityLevels, ["high", "High"]) },
  ];

  if (
    bar[0].count + bar[1].count + bar[2].count === 0 &&
    Array.isArray(tasks) &&
    tasks.length > 0
  ) {
    const pri = { Low: 0, Medium: 0, High: 0 };
    tasks.forEach((t) => {
      const task = t?.task ?? t ?? {};
      const p = String(task.priority || "").toLowerCase();
      if (p.includes("high")) pri.High++;
      else if (p.includes("med")) pri.Medium++;
      else pri.Low++;
    });
    bar[0].count = pri.Low;
    bar[1].count = pri.Medium;
    bar[2].count = pri.High;
  }

  return { pie, bar };
};

export default function UserDashboard() {
  useUserAuth();
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [pieChartData, setPieChartData] = useState([]);
  const [barChartData, setBarChartData] = useState([]);
  const [allTasksCache, setAllTasksCache] = useState([]);

  const getDashboardData = useCallback(async () => {
    try {
      if (!API_PATHS?.TASKS?.GET_USER_DASHBOARD_DATA) {
        console.warn("[UserDashboard] dashboard path not configured");
        return { ok: false, reason: "no-path" };
      }
      console.log(
        "[UserDashboard] GET DASHBOARD url:",
        API_PATHS.TASKS.GET_USER_DASHBOARD_DATA
      );
      const res = await axiosInstance.get(
        API_PATHS.TASKS.GET_USER_DASHBOARD_DATA
      );
      console.log(
        "[UserDashboard] GET DASHBOARD response:",
        res?.data ?? res
      );
      const data = res?.data ?? res ?? {};
      const payload = data?.data ?? data ?? {};
      const charts = payload?.charts ?? payload?.chart ?? {};
      const recentTasks = Array.isArray(payload?.recentTasks)
        ? payload.recentTasks
        : Array.isArray(payload?.tasks)
        ? payload.tasks
        : [];
      const normalizedRecent = recentTasks.map((r) =>
        r?.task ? r.task : r
      );
      return {
        ok: true,
        payload: { payload, charts, recentTasks: normalizedRecent },
      };
    } catch (err) {
      console.error("[UserDashboard] GET DASHBOARD failed:", err);
      return { ok: false, error: err };
    }
  }, []);

  const fetchAllTasks = useCallback(async () => {
    try {
      if (!API_PATHS?.TASKS?.GET_ALL_TASKS) {
        console.warn("[UserDashboard] GET_ALL_TASKS not configured");
        return [];
      }
      const url =
        API_PATHS.TASKS.GET_ALL_TASKS +
        (API_PATHS.TASKS.GET_ALL_TASKS.includes("?")
          ? `&t=${Date.now()}`
          : `?t=${Date.now()}`);
      console.log("[UserDashboard] GET ALL TASKS url:", url);
      const res = await axiosInstance.get(url);
      console.log(
        "[UserDashboard] GET ALL TASKS response:",
        res?.data ?? res
      );
      const payload = res?.data ?? res ?? {};
      const arr = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.tasks)
        ? payload.tasks
        : Array.isArray(payload.data)
        ? payload.data
        : [];
      return arr;
    } catch (err) {
      console.error("[UserDashboard] GET ALL TASKS failed:", err);
      return [];
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const dashRes = await getDashboardData(); // returns ok + payload
      const tasksArr = await fetchAllTasks();

      // if server dashboard returned counts, use them; otherwise derive from tasksArr
      if (dashRes.ok && dashRes.payload) {
        const { payload, charts, recentTasks } = dashRes.payload;
        // prefer server counters if available
        const tCnt =
          payload?.payload?.totalTasks ?? payload?.payload?.total ?? null;
        const pCnt =
          payload?.payload?.pendingTasks ??
          payload?.payload?.charts?.taskDistribution?.pending ??
          null;
        const inProgCnt =
          payload?.payload?.inProgressTasks ??
          payload?.payload?.charts?.taskDistribution?.inProgress ??
          null;
        const compCnt =
          payload?.payload?.completedTasks ??
          payload?.payload?.charts?.taskDistribution?.completed ??
          null;

        const serverHasCounts = [tCnt, pCnt, inProgCnt, compCnt].some(
          (v) => typeof v === "number" && !Number.isNaN(v)
        );

        if (serverHasCounts) {
          // Set dashboard state directly from server payload (safe mapping)
          setDashboardData((prev) => ({
            ...(prev || {}),
            ...payload.payload,
            charts: charts || payload.payload.charts || {},
            recentTasks:
              recentTasks || payload.payload.recentTasks || [],
            totalTasks: tCnt ?? payload.payload.totalTasks,
            pendingTasks: pCnt ?? payload.payload.pendingTasks,
            inProgressTasks:
              inProgCnt ?? payload.payload.inProgressTasks,
            completedTasks: compCnt ?? payload.payload.completedTasks,
          }));

          const { pie, bar } = buildChartsFromServerOrTasks(
            charts,
            recentTasks || tasksArr
          );
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
        charts: {
          taskDistribution: {
            pending: derived.pending,
            inProgress: derived.inProgress,
            completed: derived.completed,
            All: derived.total,
          },
        },
        recentTasks: tasksArr
          .slice(0, 10)
          .map((t) => (t?.task ? t.task : t)),
      });

      const { pie, bar } = buildChartsFromServerOrTasks(
        {},
        tasksArr
      );
      setPieChartData(pie);
      setBarChartData(bar);
      setAllTasksCache(tasksArr);
    } catch (err) {
      console.error("[UserDashboard] refreshAll error:", err);
      setErrorMsg("Failed to refresh dashboard");
    } finally {
      setLoading(false);
    }
  }, [getDashboardData, fetchAllTasks]);

  useEffect(() => {
    if (user) refreshAll();

    const onFocus = () => refreshAll();
    const onStorage = (e) => {
      if (e.key === "tasks:updatedAt") refreshAll();
    };
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

  const cardValues = useMemo(() => {
    const charts = dashboardData?.charts || {};
    const total =
      dashboardData?.totalTasks ??
      charts?.taskDistribution?.All ??
      allTasksCache.length;
    const pending =
      dashboardData?.pendingTasks ??
      charts?.taskDistribution?.pending ??
      deriveCountsFromTasks(allTasksCache).pending;
    const inProgress =
      dashboardData?.inProgressTasks ??
      charts?.taskDistribution?.inProgress ??
      deriveCountsFromTasks(allTasksCache).inProgress;
    const completed =
      dashboardData?.completedTasks ??
      charts?.taskDistribution?.completed ??
      deriveCountsFromTasks(allTasksCache).completed;
    return {
      total: Number(total || 0),
      pending: Number(pending || 0),
      inProgress: Number(inProgress || 0),
      completed: Number(completed || 0),
    };
  }, [dashboardData, allTasksCache]);

  /** 👉 Recent tasks with computed status for table */
  const recentTasksForTable = useMemo(() => {
    const src = dashboardData?.recentTasks || [];
    return src.map((t) => {
      const task = t?.task ?? t ?? {};
      return {
        ...task,
        status: computeStatusLabel(task),
      };
    });
  }, [dashboardData]);

  const onSeeMore = () => {
    if (String(user?.role || "").toLowerCase() === "admin") {
      navigate("/admin/tasks");
    } else {
      navigate("/user/tasks");
    }
  };

  return (
    <DashboardLayout activeMenu="Dashboard">
      <div className="card my-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl md:text-2xl">
              Good Morning! {user?.name ?? "User"}
            </h2>
            <p className="text-xs md:text-[13px] text-gray-400 mt-1.5">
              {moment().format("dddd Do MMM YYYY")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 border rounded"
              onClick={() => refreshAll()}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mt-5">
          <Infocard
            label="Total Tasks"
            value={addThousandsSeparator(cardValues.total)}
            color="bg-blue-600"
          />
          <Infocard
            label="Pending Tasks"
            value={addThousandsSeparator(cardValues.pending)}
            color="bg-violet-500"
          />
          <Infocard
            label="In Progress Tasks"
            value={addThousandsSeparator(cardValues.inProgress)}
            color="bg-cyan-500"
          />
          <Infocard
            label="Completed Tasks"
            value={addThousandsSeparator(cardValues.completed)}
            color="bg-lime-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4 md:my-6">
        <div>
          <div className="card">
            <h5>Task Distribution</h5>
            {loading ? (
              <div className="py-12 text-center text-slate-500">
                Loading chart...
              </div>
            ) : pieChartData.length ? (
              <CustomPieChart data={pieChartData} colors={COLORS} />
            ) : (
              <div className="py-8 text-center text-slate-400">
                {errorMsg || "No distribution data"}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="card">
            <h5>Task Priority Levels</h5>
            {loading ? (
              <div className="py-12 text-center text-slate-500">
                Loading chart...
              </div>
            ) : barChartData.length ? (
              <CustomBarChart data={barChartData} />
            ) : (
              <div className="py-8 text-center text-slate-400">
                {errorMsg || "No priority data"}
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
              <div className="py-12 text-center text-slate-500">
                Loading recent tasks...
              </div>
            ) : errorMsg ? (
              <div className="py-8 text-center text-rose-500">
                {errorMsg}
              </div>
            ) : recentTasksForTable.length ? (
              <TaskListTable tableData={recentTasksForTable} />
            ) : (
              <div className="py-8 text-center text-slate-400">
                No recent tasks available
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
