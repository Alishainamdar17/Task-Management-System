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

// Correct import path & filename (no trailing dot)
import ProjectDetails from "./pages/Project/ProjectDetails";
import CreateProject from "./pages/Project/CreateProject";

/**
 * Root route that decides redirect based on auth/role.
 * Using function declaration so it's available before usage.
 */
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

  if (user.role === "admin") return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/user/dashboard" replace />;
}

const App = () => {
  return (
    <UserProvider>
      <div>
        <Router>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Admin Routes (protected) */}
            <Route element={<PrivateRoute allowedRoles={["admin"]} />}>
              <Route path="/admin/dashboard" element={<Dashboard />} />
              <Route path="/admin/tasks" element={<ManageTasks />} />
              <Route path="/admin/create-task" element={<CreateTask />} />
              <Route path="/admin/users" element={<ManageUsers />} />

              {/* Admin workspaces & project management */}
              <Route path="/admin/workspaces" element={<Workspaces />} />
              <Route path="/admin/workspaces/:workspaceId" element={<WorkspaceDetails />} />
              <Route path="/admin/workspaces/:workspaceId/create-project" element={<CreateProject />} />
              <Route path="/admin/workspaces/:workspaceId/projects/:projectId" element={<ProjectDetails />} />
            </Route>

            {/* User / Member Routes (protected) */}
            <Route element={<PrivateRoute allowedRoles={["user", "member"]} />}>
              <Route path="/user/dashboard" element={<Userdashboard />} />
              <Route path="/user/tasks" element={<MyTasks />} />
              <Route path="/user/task-details/:id" element={<ViewTaskDetails />} />

              {/* Public-to-authenticated workspace/project routes for members */}
              <Route path="/workspaces" element={<Workspaces />} />
              <Route path="/workspaces/:id" element={<WorkspaceDetails />} />
              <Route path="/workspaces/:id/projects/:projectId" element={<ProjectDetails />} />
            </Route>

            {/* Root redirect that decides based on user role */}
            <Route path="/" element={<Root />} />

            {/* Catch-all -> redirect to root */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </div>

      <Toaster
        toastOptions={{
          style: { fontSize: "13px" },
        }}
      />
    </UserProvider>
  );
};

export default App;
