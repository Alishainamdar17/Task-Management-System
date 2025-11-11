// src/utils/apiPaths.js
// Vite-friendly base URL: prefer VITE_API_BASE from .env, fallback to http://localhost:8000
export const BASE_URL = import.meta?.env?.VITE_API_BASE || "http://localhost:8000";

export const API_PATHS = {
  AUTH: {
    REGISTER: "/api/auth/register",
    LOGIN: "/api/auth/login",
    GET_PROFILE: "/api/auth/profile",
  },

  USERS: {
    GET_ALL_USERS: "/api/users",
    GET_USER_BY_ID: (userId) => `/api/users/${userId}`,
    CREATE_USER: "/api/users",
    UPDATE_USER: (userId) => `/api/users/${userId}`,
    DELETE_USER: (userId) => `/api/users/${userId}`,
  },

  TASKS: {
  // Dashboard endpoints (match backend `taskRoutes`)
  GET_DASHBOARD_DATA: "/api/tasks/dashboard/admin",
  GET_USER_DASHBOARD_DATA: "/api/tasks/dashboard/user",
    GET_ALL_TASKS: "/api/tasks",
    GET_TASK_BY_ID: (taskId) => `/api/tasks/${taskId}`,
    CREATE_TASK: "/api/tasks",
    UPDATE_TASK: (taskId) => `/api/tasks/${taskId}`,
  // Subtasks (checklist) endpoints
  ADD_SUBTASK: (taskId) => `/api/tasks/${taskId}/subtasks`,
  UPDATE_SUBTASK: (taskId, subId) => `/api/tasks/${taskId}/subtasks/${subId}`,
  DELETE_SUBTASK: (taskId, subId) => `/api/tasks/${taskId}/subtasks/${subId}`,
    DELETE_TASK: (taskId) => `/api/tasks/${taskId}`,
    GET_BY_PROJECT: (projectId) => `/api/tasks/project/${projectId}`,
    UPDATE_TASK_STATUS: (taskId) => `/api/tasks/${taskId}/status`,
    UPDATE_TODO_CHECKLIST: (taskId) => `/api/tasks/${taskId}/todo`,
    ADD_DEPENDENCY: (taskId) => `/api/tasks/${taskId}/dependencies`,
    UPDATE_DEPENDENCY: (taskId, depId) => `/api/tasks/${taskId}/dependencies/${depId}`,
    UPLOAD_ATTACHMENTS: (taskId) => `/api/tasks/${taskId}/attachments`,
  },

  REPORTS: {
    EXPORT_TASKS: "/api/reports/export/tasks",
    EXPORT_USERS: "/api/reports/export/users",
  },

  IMAGE: {
    UPLOAD_IMAGE: "/api/auth/upload-image",
  },

  PROJECTS: {
    CREATE: "/api/projects",
    GET_BY_WORKSPACE: (workspaceId) => `/api/projects/workspace/${workspaceId}`,
    GET_BY_ID: (id) => `/api/projects/${id}`,
    GET_ALL: "/api/projects",
  },

  WORKSPACES: {
    CREATE: "/api/workspaces",
    GET_ALL: "/api/workspaces",
    GET_ME: "/api/workspaces/me",
    GET_BY_ID: (id) => `/api/workspaces/${id}`,
    UPDATE: (id) => `/api/workspaces/${id}`,
    DELETE: (id) => `/api/workspaces/${id}`,
    ADD_MEMBER: (id) => `/api/workspaces/${id}/members`,
    UPDATE_MEMBER_ROLE: (id, memberUserId) => `/api/workspaces/${id}/members/${memberUserId}`,
    REMOVE_MEMBER: (id, memberUserId) => `/api/workspaces/${id}/members/${memberUserId}`,
  },
};
