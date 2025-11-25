// src/App.jsx
import React, { useContext } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";

import Login from "./pages/Auth/Login";
import SignUp from "./pages/Auth/SignUp";

import Dashboard from "./pages/Admin/Dashboard";
import ManageTasks from "./pages/Admin/ManageTask";
import ManageUsers from "./pages/Admin/ManageUsers";
import CreateTask from "./pages/Admin/CreateTask";

import Userdashboard from "./pages/User/Userdashboard";
import MyTasks from "./pages/User/MyTasks";
import ViewTaskDetails from "./pages/User/ViewTaskDetails";

import PrivateRoute from "./routes/PrivateRoute";
import { UserProvider, UserContext } from "./context/userContext";
import { Toaster } from "react-hot-toast";

import Workspaces from "./pages/Workspace/Workspaces";
import WorkspaceDetails from "./pages/Workspace/WorkspaceDetails";

import ProjectDetails from "./pages/Project/ProjectDetails";
import CreateProject from "./pages/Project/CreateProject";

/* Redirect logic based on user role */
function Root() {
  const { user, loading } = useContext(UserContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-slate-600">Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return user.role === "admin"
    ? <Navigate to="/admin/dashboard" replace />
    : <Navigate to="/user/dashboard" replace />;
}

const App = () => {
  return (
    <UserProvider>
      <Router>
        <Routes>

          {/* PUBLIC ROUTES */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

          {/* ===========================
             ADMIN ROUTES
          ============================ */}
          <Route element={<PrivateRoute allowedRoles={["admin"]} />}>
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/tasks" element={<ManageTasks />} />
            <Route path="/admin/create-task" element={<CreateTask />} />
            <Route path="/admin/users" element={<ManageUsers />} />

            {/* Admin workspace/project routes */}
            <Route path="/admin/workspaces" element={<Workspaces />} />
            <Route path="/admin/workspaces/:workspaceId" element={<WorkspaceDetails />} />
            <Route path="/admin/workspaces/:workspaceId/create-project" element={<CreateProject />} />
            <Route path="/admin/workspaces/:workspaceId/projects/:projectId" element={<ProjectDetails />} />
          </Route>

          {/* ===========================
              USER ROUTES
          ============================ */}
          <Route element={<PrivateRoute allowedRoles={["user", "member"]} />}>
            <Route path="/user/dashboard" element={<Userdashboard />} />
            <Route path="/user/tasks" element={<MyTasks />} />
            <Route path="/user/task-details/:id" element={<ViewTaskDetails />} />

            {/* ⭐ User task create route (same CreateTask component) */}
            <Route path="/user/create-task" element={<CreateTask />} />

            {/* User access to workspaces & projects */}
            <Route path="/workspaces" element={<Workspaces />} />
            <Route path="/workspaces/:workspaceId" element={<WorkspaceDetails />} />
            <Route path="/workspaces/:workspaceId/projects/:projectId" element={<ProjectDetails />} />
          </Route>

          {/* ROOT / REDIRECT */}
          <Route path="/" element={<Root />} />

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>

      <Toaster toastOptions={{ style: { fontSize: "13px" } }} />
    </UserProvider>
  );
};

export default App;
