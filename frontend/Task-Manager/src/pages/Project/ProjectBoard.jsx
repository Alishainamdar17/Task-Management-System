// src/pages/Admin/ProjectBoard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import TaskCard from "../../components/TaskCard";

const normId = (v) => (v === undefined || v === null ? "" : String(v));

/**
 * Note: This file contains a robust status-detection routine and debug logs
 * to help you see exactly why each task is classified into To Do / In Progress / Done.
 *
 * If tasks that are actually "done" still appear under To Do, open the browser console
 * and look for the collapsed group "[ProjectBoard] Tasks fetched (N)". Expand it and inspect
 * `_statusInfo` for any task. Paste one `_statusInfo` here if you want me to further tune the logic.
 */

/** Detects and returns one of: 'todo' | 'inprogress' | 'done' along with reasons (debug). */
const detectStatusInfo = (t) => {
  const s = (v) => (v === undefined || v === null ? "" : String(v).toLowerCase().trim());
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
      statusCode: t.statusCode ?? t.status_id ?? t.code,
      progress: t.progress ?? t.percent ?? t.completionPercent ?? t.progressPercent,
      completedFlag: t.completed ?? t.isCompleted ?? t.isDone ?? t.done,
    },
    checklistSummary: null,
    resolvedBucket: "todo",
    reasons: [],
  };

  // 1) explicit boolean flags
  if (t.completed === true || t.isCompleted === true || t.isDone === true || t.done === true) {
    info.resolvedBucket = "done";
    info.reasons.push("boolean flag true (completed/isCompleted/isDone/done)");
    return info;
  }

  // 2) numeric progress / percent
  const prog = t.progress ?? t.percent ?? t.completionPercent ?? t.progressPercent;
  if (typeof prog === "number" && prog >= 100) {
    info.resolvedBucket = "done";
    info.reasons.push(`numeric progress >=100 (${prog})`);
    return info;
  }
  if (s(prog) && !Number.isNaN(Number(s(prog)))) {
    const nprog = Number(s(prog));
    if (nprog >= 100) {
      info.resolvedBucket = "done";
      info.reasons.push(`numeric progress string >=100 (${nprog})`);
      return info;
    }
  }

  // 3) common string fields (support object shapes too)
  const candidates = [];
  ["status", "state", "stage", "workflowState", "taskStatus", "statusText", "label"].forEach((k) => {
    if (typeof t[k] !== "undefined") candidates.push(t[k]);
  });
  // also check nested shapes: status.name, status.label, status.value, etc.
  if (t.status && typeof t.status === "object") {
    candidates.push(t.status.name ?? t.status.label ?? t.status.value ?? t.status);
  }
  if (t.state && typeof t.state === "object") {
    candidates.push(t.state.name ?? t.state.label ?? t.state.value ?? t.state);
  }
  for (const c of candidates) {
    const v = s(c);
    if (!v) continue;
    if (["done", "completed", "complete", "closed", "finished"].some((k) => v.includes(k))) {
      info.resolvedBucket = "done";
      info.reasons.push(`string match done on "${v}"`);
      return info;
    }
    if (["inprogress", "in-progress", "progress", "doing", "ongoing", "started", "active"].some((k) => v.includes(k))) {
      info.resolvedBucket = "inprogress";
      info.reasons.push(`string match inprogress on "${v}"`);
      return info;
    }
    if (["todo", "to do", "backlog", "open", "new", "pending"].some((k) => v.includes(k))) {
      info.resolvedBucket = "todo";
      info.reasons.push(`string match todo on "${v}"`);
      return info;
    }
  }

  // 4) numeric status codes heuristics
  const numericFields = [t.statusCode, t.status_id, t.stateCode, t.code, t.status];
  for (const n of numericFields) {
    if (n === undefined || n === null) continue;
    const num = Number(n);
    if (!Number.isFinite(num)) continue;
    if (num === 2 || num === 3) {
      info.resolvedBucket = "done";
      info.reasons.push(`numeric code ${num} => done`);
      return info;
    }
    if (num === 1) {
      info.resolvedBucket = "inprogress";
      info.reasons.push(`numeric code ${num} => inprogress`);
      return info;
    }
    if (num === 0) {
      info.resolvedBucket = "todo";
      info.reasons.push(`numeric code ${num} => todo`);
      return info;
    }
    if (num >= 100) {
      info.resolvedBucket = "done";
      info.reasons.push(`numeric >=100 ${num} => done`);
      return info;
    }
  }

  // 5) checklist heuristic
  const checklist =
    Array.isArray(t.todoChecklist) ? t.todoChecklist : Array.isArray(t.checklist) ? t.checklist : Array.isArray(t.todos) ? t.todos : [];
  if (checklist.length > 0) {
    let completed = 0;
    checklist.forEach((it) => {
      if (!it) return;
      if (it.completed === true || it.done === true || it.checked === true || it.isChecked === true) {
        completed += 1;
        return;
      }
      if (it.status && typeof it.status === "string" && s(it.status).includes("done")) {
        completed += 1;
      } else if (it.state && typeof it.state === "string" && s(it.state).includes("done")) {
        completed += 1;
      }
    });
    info.checklistSummary = { total: checklist.length, completed };
    if (completed > 0 && completed >= checklist.length) {
      info.resolvedBucket = "done";
      info.reasons.push("all checklist items marked done");
      return info;
    }
  }

  // 6) fallback: default to todo
  info.reasons.push("no explicit done/inprogress signal - default todo");
  return info;
};

export default function ProjectBoard() {
  const { id: wsId, projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]); // normalized tasks
  const [usersCache, setUsersCache] = useState({}); // id -> user object
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProject = useCallback(async () => {
    try {
      let path;
      if (API_PATHS.PROJECTS.GET_BY_WORKSPACE_PROJECT) {
        path =
          typeof API_PATHS.PROJECTS.GET_BY_WORKSPACE_PROJECT === "function"
            ? API_PATHS.PROJECTS.GET_BY_WORKSPACE_PROJECT(wsId, projectId)
            : API_PATHS.PROJECTS.GET_BY_WORKSPACE_PROJECT.replace(":workspaceId", wsId).replace(":projectId", projectId);
      } else {
        path = typeof API_PATHS.PROJECTS.GET_BY_ID === "function"
          ? API_PATHS.PROJECTS.GET_BY_ID(projectId)
          : API_PATHS.PROJECTS.GET_BY_ID.replace(":id", projectId);
      }

      const res = await axiosInstance.get(path);
      const data = res.data?.project ?? res.data?.data ?? res.data;
      setProject(data || null);
    } catch (e) {
      console.error("[ProjectBoard] fetchProject error:", e);
      setError("Failed to load project");
      setProject(null);
    }
  }, [wsId, projectId]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      let path;
      if (API_PATHS.TASKS && API_PATHS.TASKS.GET_BY_PROJECT) {
        path =
          typeof API_PATHS.TASKS.GET_BY_PROJECT === "function"
            ? API_PATHS.TASKS.GET_BY_PROJECT(projectId)
            : API_PATHS.TASKS.GET_BY_PROJECT.replace(":projectId", projectId);
      } else {
        path = `/api/tasks/project/${projectId}`;
      }

      const res = await axiosInstance.get(path);
      const raw = Array.isArray(res.data) ? res.data : res.data?.tasks ?? res.data?.data ?? [];

      // Normalize tasks and attach debug `_statusInfo`
      const normalized = raw.map((t) => {
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

        const info = detectStatusInfo(t);
        const statusBucket = info.resolvedBucket;

        return {
          ...t,
          todoChecklist,
          checklistCount: todoChecklist.length,
          assignees,
          _statusBucket: statusBucket,
          _statusInfo: info, // debug info available in console / React DevTools
        };
      });

      // DEBUG: print samples so you can see why tasks were classified
      // Open browser console and inspect these logs
      console.groupCollapsed(`[ProjectBoard] Tasks fetched (${normalized.length})`);
      normalized.slice(0, 15).forEach((nt) => {
        console.log("task id:", nt._id ?? nt.id, "-> bucket:", nt._statusBucket, nt._statusInfo);
      });
      console.groupEnd();

      setTasks(normalized);

      // attempt to fetch user objects for any assignee ids (if API supports batch fetch)
      const ids = new Set();
      normalized.forEach((t) => {
        (t.assignees || []).forEach((a) => {
          if (!a) return;
          const idVal = typeof a === "object" ? a._id ?? a.id : a;
          if (idVal) ids.add(normId(idVal));
        });
      });

      if (ids.size > 0) {
        try {
          const idList = Array.from(ids).join(",");
          const usersPath =
            API_PATHS.USERS && API_PATHS.USERS.GET_BY_IDS
              ? typeof API_PATHS.USERS.GET_BY_IDS === "function"
                ? API_PATHS.USERS.GET_BY_IDS(idList)
                : API_PATHS.USERS.GET_BY_IDS.replace(":ids", idList)
              : `/api/users?ids=${idList}`;

          const ures = await axiosInstance.get(usersPath);
          const list = Array.isArray(ures.data) ? ures.data : ures.data?.users ?? ures.data?.data ?? [];
          const cache = {};
          list.forEach((u) => {
            cache[normId(u._id ?? u.id)] = u;
          });
          setUsersCache((prev) => ({ ...prev, ...cache }));
        } catch (err) {
          console.warn("[ProjectBoard] Could not fetch users by ids:", err);
        }
      }
    } catch (err) {
      console.error("[ProjectBoard] fetchTasks error:", err);
      setError("Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    fetchTasks();
  }, [fetchProject, fetchTasks]);

  const handleAddTask = () => {
    navigate(`/admin/create-task?workspace=${wsId}&project=${projectId}`);
  };

  const onViewTask = (task) => {
    navigate(`/admin/workspaces/${wsId}/projects/${projectId}/tasks/${task._id || task.id}`);
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!project) return <div className="p-6">Project not found.</div>;

  // split tasks by bucket
  const todoTasks = tasks.filter((t) => t._statusBucket === "todo");
  const inProgressTasks = tasks.filter((t) => t._statusBucket === "inprogress");
  const doneTasks = tasks.filter((t) => t._statusBucket === "done");

  return (
    <div className="p-6">
      <div className="mb-4">
        <button onClick={() => navigate(-1)} className="text-sm text-sky-600 hover:underline">
          ← Back
        </button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{project.title || "Untitled Project"}</h1>
          {project.description && <p className="text-gray-600">{project.description}</p>}
          <div className="text-sm text-gray-500 mt-2">
            Members: {Array.isArray(project.members) ? project.members.length : project.membersCount ?? 0} &nbsp;•&nbsp; Tasks: {tasks.length}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleAddTask} className="px-4 py-2 rounded bg-sky-600 text-white hover:bg-sky-700">
            + Add Task
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded p-4 bg-white">
          <div className="font-semibold mb-2">To Do ({todoTasks.length})</div>
          <div className="space-y-4">
            {todoTasks.length === 0 ? (
              <div className="text-gray-500 text-sm">No tasks</div>
            ) : (
              todoTasks.map((t) => <TaskCard key={t._id || t.id} task={t} usersCache={usersCache} onView={onViewTask} />)
            )}
          </div>
        </div>

        <div className="border rounded p-4 bg-white">
          <div className="font-semibold mb-2">In Progress ({inProgressTasks.length})</div>
          <div className="space-y-4">
            {inProgressTasks.length === 0 ? (
              <div className="text-gray-500 text-sm">No tasks</div>
            ) : (
              inProgressTasks.map((t) => <TaskCard key={t._id || t.id} task={t} usersCache={usersCache} onView={onViewTask} />)
            )}
          </div>
        </div>

        <div className="border rounded p-4 bg-white">
          <div className="font-semibold mb-2">Done ({doneTasks.length})</div>
          <div className="space-y-4">
            {doneTasks.length === 0 ? (
              <div className="text-gray-500 text-sm">No tasks</div>
            ) : (
              doneTasks.map((t) => <TaskCard key={t._id || t.id} task={t} usersCache={usersCache} onView={onViewTask} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
