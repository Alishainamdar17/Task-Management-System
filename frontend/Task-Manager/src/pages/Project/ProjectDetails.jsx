// src/pages/Project/ProjectDetails.jsx
import React, { useEffect, useState, useCallback, useContext } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import TaskCard from "../../components/Task/TaskCard";
import toast from "react-hot-toast";
import { UserContext } from "../../context/userContext";

const normId = (v) => (v === undefined || v === null ? "" : String(v));

/**
 * Status detector:
 * - Done if explicit flags/dates or progress >=100 or status words ("done", "completed"...)
 * - In Progress only with explicit signals (progress 1-99 or status words like "in progress")
 * - OTHERWISE To Do (no more fallback on assignees/start date)
 */
const detectStatusInfo = (t) => {
  const s = (v) =>
    v === undefined || v === null ? "" : String(v).toLowerCase().trim();
  const idOf = (a) => {
    if (!a) return "";
    if (typeof a === "object") return a._id ?? a.id ?? "";
    return String(a);
  };

  const info = {
    id: idOf(t._id ?? t.id),
    rawStatusFields: {
      status: t.status,
      state: t.state,
      stage: t.stage,
      statusCode:
        t.statusCode ?? t.status_id ?? t.code ?? t.status_code,
      progress:
        t.progress ??
        t.percent ??
        t.completionPercent ??
        t.progressPercent ??
        t.percentage,
      completedFlag:
        t.completed ??
        t.isCompleted ??
        t.isDone ??
        t.done ??
        t.is_complete,
      completedAt:
        t.completedAt ??
        t.closedAt ??
        t.finishedAt ??
        t.completed_at ??
        t.closed_at,
    },
    checklistSummary: null,
    resolvedBucket: "To Do",
    reasons: [],
  };

  const isItemChecked = (it) => {
    if (!it) return false;
    if (typeof it === "boolean") return it;
    if (typeof it === "string") {
      const vs = s(it);
      return [
        "true",
        "done",
        "checked",
        "complete",
        "completed",
        "1",
      ].includes(vs);
    }
    if (typeof it === "object") {
      if (
        it.completed ||
        it.done ||
        it.checked ||
        it.isChecked ||
        it.isCompleted ||
        it.isComplete
      )
        return true;
      if (
        it.status &&
        typeof it.status === "string" &&
        s(it.status).includes("done")
      )
        return true;
      if (
        it.state &&
        typeof it.state === "string" &&
        s(it.state).includes("done")
      )
        return true;
      if (
        it.checkedAt ||
        it.completedAt ||
        it.finishedAt ||
        it.checked_at ||
        it.completed_at
      )
        return true;
      if (
        typeof it.status === "number" &&
        (it.status === 1 || it.status === 2)
      )
        return true;
    }
    return false;
  };

  // 1) Hard "Done" checks
  if (
    t.completed === true ||
    t.isCompleted === true ||
    t.isDone === true ||
    t.done === true ||
    t.is_complete === true
  ) {
    info.resolvedBucket = "Done";
    info.reasons.push("explicit boolean completed flag");
    return info;
  }
  if (
    t.completedAt ||
    t.closedAt ||
    t.finishedAt ||
    t.completed_at ||
    t.closed_at
  ) {
    info.resolvedBucket = "Done";
    info.reasons.push("completedAt/closedAt/finishedAt present");
    return info;
  }

  // 2) Numeric progress
  const prog =
    t.progress ??
    t.percent ??
    t.completionPercent ??
    t.progressPercent ??
    t.percentage;
  if (typeof prog === "number") {
    if (prog >= 100) {
      info.resolvedBucket = "Done";
      info.reasons.push(`numeric progress >=100 (${prog})`);
      return info;
    }
    if (prog > 0 && prog < 100) {
      info.resolvedBucket = "In Progress";
      info.reasons.push(`numeric progress between 1-99 (${prog})`);
      return info;
    }
  } else if (s(prog) && !Number.isNaN(Number(s(prog)))) {
    const nprog = Number(s(prog));
    if (nprog >= 100) {
      info.resolvedBucket = "Done";
      info.reasons.push(`numeric-progress-string >=100 (${nprog})`);
      return info;
    }
    if (nprog > 0 && nprog < 100) {
      info.resolvedBucket = "In Progress";
      info.reasons.push(`numeric-progress-string 1-99 (${nprog})`);
      return info;
    }
  }

  // 3) Status words/labels
  const candidates = [];
  ["status", "state", "stage", "workflowState", "taskStatus", "statusText", "label"].forEach(
    (k) => {
      if (typeof t[k] !== "undefined") candidates.push(t[k]);
    }
  );
  if (t.status && typeof t.status === "object")
    candidates.push(
      t.status.name ??
        t.status.label ??
        t.status.value ??
        t.status
    );
  if (t.state && typeof t.state === "object")
    candidates.push(
      t.state.name ?? t.state.label ?? t.state.value ?? t.state
    );
  for (const c of candidates) {
    const v = s(c);
    if (!v) continue;
    if (
      ["done", "completed", "complete", "closed", "finished"].some(
        (k) => v.includes(k)
      )
    ) {
      info.resolvedBucket = "Done";
      info.reasons.push(`string match done on "${v}"`);
      return info;
    }
    if (
      ["inprogress", "in-progress", "progress", "doing", "ongoing", "started", "active"].some(
        (k) => v.includes(k)
      )
    ) {
      info.resolvedBucket = "In Progress";
      info.reasons.push(`string match inprogress on "${v}"`);
      return info;
    }
    if (
      ["todo", "to do", "backlog", "open", "new", "pending"].some(
        (k) => v.includes(k)
      )
    ) {
      info.resolvedBucket = "To Do";
      info.reasons.push(`string match todo on "${v}"`);
      return info;
    }
  }

  // 4) Numeric codes
  const numericFields = [
    t.statusCode,
    t.status_id,
    t.stateCode,
    t.code,
    t.status,
    t.status_code,
  ];
  for (const n of numericFields) {
    if (n === undefined || n === null) continue;
    const num = Number(n);
    if (!Number.isFinite(num)) continue;
    if (num === 2 || num === 3) {
      info.resolvedBucket = "Done";
      info.reasons.push(`numeric code ${num} => done`);
      return info;
    }
    if (num === 1) {
      info.resolvedBucket = "In Progress";
      info.reasons.push(`numeric code ${num} => inprogress`);
      return info;
    }
    if (num === 0) {
      info.resolvedBucket = "To Do";
      info.reasons.push(`numeric code ${num} => todo`);
      return info;
    }
    if (num >= 100) {
      info.resolvedBucket = "Done";
      info.reasons.push(`numeric >=100 ${num} => done`);
      return info;
    }
  }

  // 5) Checklist heuristic
  const checklist = Array.isArray(t.todoChecklist)
    ? t.todoChecklist
    : Array.isArray(t.checklist)
    ? t.checklist
    : Array.isArray(t.todos)
    ? t.todos
    : [];
  if (checklist.length > 0) {
    let completed = 0;
    checklist.forEach((it) => {
      if (isItemChecked(it)) completed += 1;
    });
    info.checklistSummary = {
      total: checklist.length,
      completed,
    };
    if (completed > 0 && completed >= checklist.length) {
      info.resolvedBucket = "Done";
      info.reasons.push("all checklist items marked done");
      return info;
    }
    if (completed > 0 && completed < checklist.length) {
      info.resolvedBucket = "In Progress";
      info.reasons.push("partial checklist completion -> inprogress");
      return info;
    }
  }

  // Default -> To Do
  info.reasons.push("no explicit signals -> default To Do");
  return info;
};

export default function ProjectDetails() {
  const params = useParams();
  const workspaceId = params.workspaceId ?? params.id ?? params.wsId ?? null;
  const projectId = params.projectId ?? params.id ?? params.pid ?? null;
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useContext(UserContext);

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const buildPath = (templateOrFn, ...args) => {
    if (!templateOrFn) return null;
    if (typeof templateOrFn === "function") return templateOrFn(...args);
    return templateOrFn;
  };

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setError("Missing project id in URL");
      setProject(null);
      return;
    }

    setError(null);
    const attempts = [];

    if (API_PATHS?.PROJECTS?.GET_BY_WORKSPACE_PROJECT) {
      attempts.push(
        buildPath(
          API_PATHS.PROJECTS.GET_BY_WORKSPACE_PROJECT,
          workspaceId,
          projectId
        )
      );
    }
    if (API_PATHS?.PROJECTS?.GET_BY_ID) {
      attempts.push(buildPath(API_PATHS.PROJECTS.GET_BY_ID, projectId));
    }

    if (workspaceId)
      attempts.push(`/api/workspaces/${workspaceId}/projects/${projectId}`);
    attempts.push(`/api/projects/${projectId}`);

    for (const path of attempts) {
      if (!path) continue;
      try {
        const res = await axiosInstance.get(path);
        const p = res.data?.project ?? res.data?.data ?? res.data;
        if (p) {
          setProject(p);
          return;
        }
      } catch (err) {
        // try next endpoint
      }
    }

    setError("Failed to load project (no matching endpoint or server error).");
    setProject(null);
  }, [workspaceId, projectId]);

  const fetchTasks = useCallback(async () => {
    setError(null);

    if (!projectId) {
      setTasks([]);
      return;
    }

    const endpoints = [
      API_PATHS?.TASKS?.GET_BY_PROJECT &&
        buildPath(API_PATHS.TASKS.GET_BY_PROJECT, projectId),
      `/api/tasks?project=${projectId}`,
      `/api/projects/${projectId}/tasks`,
      `/api/tasks?projectId=${projectId}`,
      `/api/tasks`,
    ].filter(Boolean);

    const sameId = (a, b) => String(a ?? "") === String(b ?? "");
    const extractProjectId = (t) =>
      (t?.project && (t.project._id || t.project.id)) ||
      t?.project ||
      t?.projectId ||
      t?.project_id ||
      null;

    for (const url of endpoints) {
      try {
        const res = await axiosInstance.get(url);

        let list = Array.isArray(res.data)
          ? res.data
          : res.data?.tasks ?? res.data?.data ?? res.data;

        if (list && !Array.isArray(list) && typeof list === "object") {
          if (Array.isArray(res.data?.tasks)) list = res.data.tasks;
          else if (Array.isArray(res.data?.data)) list = res.data.data;
          else list = [list];
        }
        if (!Array.isArray(list)) continue;

        const filtered = list.filter((t) =>
          sameId(extractProjectId(t), projectId)
        );

        const normalized = filtered.map((t) => {
          const todoChecklist = Array.isArray(t.todoChecklist)
            ? t.todoChecklist
            : Array.isArray(t.checklist)
            ? t.checklist
            : Array.isArray(t.todos)
            ? t.todos
            : [];

          const assignees = Array.isArray(t.assignees)
            ? t.assignees
            : Array.isArray(t.assignedTo)
            ? t.assignedTo
            : [];

          const statusInfo = detectStatusInfo(t);
          return {
            ...t,
            todoChecklist,
            checklistCount: todoChecklist.length,
            assignees,
            _statusBucket: statusInfo.resolvedBucket,
            _statusInfo: statusInfo,
          };
        });

        console.groupCollapsed(
          `[ProjectDetails] Tasks (${normalized.length}) from ${url}`
        );
        normalized.slice(0, 20).forEach((nt) => {
          console.log(
            "task id:",
            nt._id ?? nt.id,
            "-> bucket:",
            nt._statusBucket,
            nt._statusInfo
          );
        });
        console.groupEnd();

        setTasks(normalized);
        return;
      } catch (err) {
        // try next endpoint
      }
    }

    setError("Failed to load tasks for this project.");
    setTasks([]);
  }, [projectId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchProject(), fetchTasks()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, location.search]);

  // ⭐ Decide base path for task create/edit based on role
  const taskBasePath =
    String(user?.role || "").toLowerCase() === "admin"
      ? "/admin/create-task"
      : "/user/create-task";

  const handleAddTask = (e) => {
    e?.stopPropagation?.();
    const ws = workspaceId ?? "";
    const pid = projectId ?? "";
    navigate(`${taskBasePath}?workspace=${ws}&project=${pid}`);
  };

  const onUpdateTask = (task) => {
    const tid = task._id ?? task.id;
    const ws = workspaceId ?? "";
    const pid = projectId ?? "";
    navigate(
      `${taskBasePath}?workspace=${ws}&project=${pid}&task=${tid}`
    );
  };

  if (loading) return <div className="p-6">Loading project…</div>;
  if (error && !project) return <div className="p-6 text-red-600">{error}</div>;
  if (!project) return <div className="p-6">Project not found</div>;

  // Group tasks
  const grouped = { "To Do": [], "In Progress": [], Done: [] };
  tasks.forEach((t) => {
    const b =
      t._statusBucket ??
      detectStatusInfo(t).resolvedBucket ??
      "To Do";
    grouped[b] = grouped[b] || [];
    grouped[b].push(t);
  });

  const total = tasks.length;
  const doneCount = grouped["Done"].length;
  const progressPercent =
    total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="p-6">
      {/* header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link
            to={-1}
            className="inline-flex items-center text-sm text-gray-600 mb-2"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: project.color ?? "#F97316" }}
            >
              {project.title
                ? String(project.title).charAt(0).toUpperCase()
                : "P"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-sky-700">
                {project.title ?? project.name}
              </h1>
              {project.description && (
                <p className="text-gray-600 mt-1">
                  {project.description}
                </p>
              )}
              <div className="mt-3 text-sm text-gray-600 flex items-center gap-4">
                <div>
                  Members:{" "}
                  {Array.isArray(project.members)
                    ? project.members.length
                    : project.membersCount ?? 0}
                </div>
                <div>Tasks: {total}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500 mr-2">
              Progress:
            </div>
            <div className="w-48 h-2 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-2 bg-sky-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-sm text-gray-600 ml-2">
              {progressPercent}%
            </div>
          </div>

          <button
            onClick={handleAddTask}
            className="px-4 py-2 bg-sky-600 text-white rounded shadow hover:bg-sky-700"
          >
            Add Task
          </button>
        </div>
      </div>

      {/* status pills */}
      <div className="mb-4 flex items-center gap-3">
        <StatusPills grouped={grouped} total={total} />
      </div>

      {/* kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["To Do", "In Progress", "Done"].map((col) => (
          <div
            key={col}
            className="min-h-[220px] bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{col}</h3>
              <span className="text-sm text-gray-400">
                {grouped[col].length}
              </span>
            </div>

            <div className="space-y-3">
              {grouped[col].length === 0 ? (
                <div className="text-sm text-gray-400 py-6 text-center">
                  No tasks
                </div>
              ) : (
                grouped[col].map((t) => (
                  <TaskCard
                    key={t._id ?? t.id}
                    task={t}
                    onUpdate={() => onUpdateTask(t)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPills({ grouped, total }) {
  return (
    <>
      <button className="px-3 py-1 rounded-md text-sm bg-white border text-gray-700">
        All ({total})
      </button>
      <button className="px-3 py-1 rounded-md text-sm bg-white border text-gray-700">
        To Do ({grouped["To Do"].length})
      </button>
      <button className="px-3 py-1 rounded-md text-sm bg-white border text-gray-700">
        In Progress ({grouped["In Progress"].length})
      </button>
      <button className="px-3 py-1 rounded-md text-sm bg-white border text-gray-700">
        Done ({grouped["Done"].length})
      </button>
    </>
  );
}
