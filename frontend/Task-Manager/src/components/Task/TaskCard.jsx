// src/components/Task/TaskCard.jsx
import React, { useState } from "react";

/**
 * TaskCard showing title, status, priority, assignees, attachments, checklist and an Update button.
 */
export default function TaskCard({ task = {}, usersCache = {}, onUpdate = () => {} }) {
  const [showChecklist, setShowChecklist] = useState(false);

  const todoChecklist = task.todoChecklist ?? task.checklist ?? task.todos ?? [];
  const checklistCount = Array.isArray(todoChecklist) ? todoChecklist.length : 0;

  const assigneesRaw = task.assignees ?? task.assignedTo ?? [];

  const normId = (v) => (v === undefined || v === null ? "" : String(v));
  const getUserFor = (a) => {
    if (typeof a === "object") return a;
    const id = normId(a);
    return usersCache[id] || { _id: id, name: id, profileImageUrl: null };
  };

  // normalize attachments (accept many backend shapes)
  const attachments = Array.isArray(task.attachments)
    ? task.attachments
        .map((a) => {
          if (!a) return null;
          if (typeof a === "string") return { url: a, name: a.split("/").pop() };
          return {
            url: a.url || a.path || a.imageUrl || a.fileUrl || a.location || "",
            name: a.name || a.filename || (a.url || a.path || "").split("/").pop() || "file",
          };
        })
        .filter(Boolean)
    : [];

  const isImage = (url = "") => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test((url || "").split("?")[0]);

  const title = task.title || task.name || "Untitled";
  const description = task.description || task.desc || "";
  const s = String(task.status || task.state || "").toLowerCase();

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border hover:shadow-lg transition">
      <div className="flex items-start justify-between mb-3">
        <div className="space-x-2 flex items-center">
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              String(task.priority || "").toLowerCase() === "high"
                ? "bg-red-100 text-red-700"
                : String(task.priority || "").toLowerCase() === "medium"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {String(task.priority ?? "Low").replace(/^\w/, (c) => c.toUpperCase())}
          </span>
          {!task.completed && (s.includes("progress") || s.includes("in-progress")) && (
            <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">In Progress</span>
          )}
          {task.completed && <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700">Completed</span>}
        </div>
      </div>

      {/* title (click to update) */}
      <h3
        className="text-lg font-semibold mb-2 cursor-pointer"
        onClick={() => onUpdate(task)}
        title="Update task"
      >
        {title}
      </h3>

      {description ? <p className="text-sm text-slate-600 mb-3 line-clamp-3">{description}</p> : null}

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

      {/* assignees */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex -space-x-2">
          {(assigneesRaw || []).slice(0, 4).map((u, i) => {
            const userObj = typeof u === "string" ? getUserFor(u) : u || {};
            const src = userObj?.profileImageUrl || userObj?.avatarUrl || userObj?.avatar || "";
            return src ? (
              <img key={i} src={src} alt={userObj?.name || "user"} className="w-8 h-8 rounded-full object-cover border" />
            ) : (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-700 border"
              >
                {(userObj?.name || userObj?._id || "U").toString().slice(0, 2).toUpperCase()}
              </div>
            );
          })}
        </div>

        <div className="text-xs text-slate-500">{task.checklistCount ?? checklistCount ?? 0} Tasks</div>
      </div>

      {/* attachments */}
      {attachments.length > 0 && (
        <div className="mb-3">
          <div className="text-sm text-slate-700 mb-1">Attachments</div>
          <div className="flex flex-wrap gap-2">
            {attachments.map((a, idx) => {
              if (!a.url) return null;
              const name = a.name || a.url.split("/").pop();
              return isImage(a.url) ? (
                <a
                  key={idx}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-16 h-16 bg-gray-100 rounded overflow-hidden border"
                >
                  <img src={a.url} alt={name} className="w-full h-full object-cover" />
                </a>
              ) : (
                <a
                  key={idx}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded border text-xs"
                >
                  📎 <span className="truncate max-w-[120px]">{name}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* checklist */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Checklist: {checklistCount}</span>
          {checklistCount > 0 && (
            <button onClick={() => setShowChecklist((s) => !s)} className="text-xs px-2 py-1 border rounded">
              {showChecklist ? "Hide" : "Show"}
            </button>
          )}
        </div>

        {showChecklist && checklistCount > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {todoChecklist.map((c, idx) => {
              const text = typeof c === "string" ? c : c?.text ?? "(empty)";
              const completed = typeof c === "string" ? false : !!c?.completed;
              return (
                <li key={idx} className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded">
                  <input type="checkbox" checked={completed} readOnly className="w-4 h-4" />
                  <span className={completed ? "line-through text-gray-500" : ""}>{text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* actions */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => onUpdate(task)}
          className="px-3 py-1 rounded bg-slate-50 hover:bg-slate-100 text-sm"
          title="Update task"
        >
          
        </button>
      </div>
    </div>
  );
}
