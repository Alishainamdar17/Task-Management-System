// src/pages/Workspace/WorkspaceDetails.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import CreateProjectModal from "../Project/CreateProject";
import { UserContext } from "../../context/userContext";

const buildPath = (pathOrFn, value, placeholder = ":id") => {
  if (!pathOrFn) return null;
  if (typeof pathOrFn === "function") return pathOrFn(value);
  return String(pathOrFn).replace(placeholder, value);
};

const formatDate = (raw) => {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export default function WorkspaceDetails() {
  const { user } = useContext(UserContext);
  const params = useParams();
  const navigate = useNavigate();
  const workspaceId = params.workspaceId || params.id || params?.workspace || null;

  const [workspace, setWorkspace] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Project modal control
  const [createOpen, setCreateOpen] = useState(false);

  const fetchWorkspace = async () => {
    if (!workspaceId) {
      setWorkspace(null);
      return;
    }
    try {
      const path =
        buildPath(API_PATHS.WORKSPACES?.GET_BY_ID, workspaceId, ":id") || `/api/workspaces/${workspaceId}`;
      const res = await axiosInstance.get(path);
      const data = res.data?.workspace ?? res.data?.data ?? res.data;
      setWorkspace(data || null);
    } catch (err) {
      console.error("[WorkspaceDetails] fetchWorkspace error:", err?.response?.data || err.message);
      setWorkspace(null);
    }
  };

  const fetchProjects = async () => {
    if (!workspaceId) {
      setProjects([]);
      return;
    }

    // Primary attempt: workspace-scoped endpoint
    let path = buildPath(API_PATHS.PROJECTS?.GET_BY_WORKSPACE, workspaceId, ":workspaceId")
      || `/api/workspaces/${workspaceId}/projects`;

    try {
      let res;
      try {
        res = await axiosInstance.get(path);
      } catch (err) {
        // fallback: general projects list filtered by workspace id
        if (err?.response?.status === 404 || err?.response?.status === 400) {
          res = await axiosInstance.get("/api/projects", { params: { workspace: workspaceId } });
        } else {
          throw err;
        }
      }
      const list = Array.isArray(res.data) ? res.data : res.data?.projects ?? res.data?.data ?? res.data ?? [];
      setProjects(list);
    } catch (err) {
      console.error("[WorkspaceDetails] fetchProjects error:", err?.response?.data || err.message);
      setProjects([]);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchWorkspace(), fetchProjects()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const openCreate = () => setCreateOpen(true);
  const closeCreate = () => setCreateOpen(false);
  const onProjectCreated = async (newProject) => {
    // If the CreateProjectModal returns the created project, navigate into it, otherwise refresh
    closeCreate();
    await fetchProjects();
    const id = newProject?._id ?? newProject?.id;
    if (id) {
      const base = user?.role === "admin" ? `/admin/workspaces/${workspaceId}` : `/workspaces/${workspaceId}`;
      navigate(`${base}/projects/${id}`);
    }
  };

  // membersCount and small avatar render
  const renderMembers = (ws) => {
    if (!ws) return null;
    const members = Array.isArray(ws.members) ? ws.members : (typeof ws.membersCount === "number" ? [] : []);
    // if members array contains objects with name or email, display initials
    return (
      <div className="flex items-center gap-2">
        {Array.isArray(members) && members.length > 0 ? (
          members.slice(0, 5).map((m, i) => {
            const name = m?.name ?? m?.fullName ?? m?.displayName ?? m?.email ?? (typeof m === "string" ? m : "");
            const initial = name ? String(name)[0].toUpperCase() : "U";
            return (
              <div key={i} title={name} className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-medium">
                {initial}
              </div>
            );
          })
        ) : (
          <div className="text-sm text-gray-500">No members</div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout activeMenu="Workspaces">
      <div className="p-6">
        <CreateProjectModal
          open={createOpen}
          workspaceId={workspaceId}
          onClose={closeCreate}
          onCreated={onProjectCreated}
        />

        {loading ? (
          <div className="p-6">Loading workspace...</div>
        ) : !workspace ? (
          <div className="p-6 text-gray-600">Workspace not found.</div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: workspace.color || "#F97316" }}>
                  {workspace.name ? String(workspace.name).charAt(0).toUpperCase() : "W"}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-sky-700">{workspace.name}</h1>
                  {workspace.description && <p className="text-gray-600 mt-1">{workspace.description}</p>}
                  <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
                    <span>Members:</span>
                    {renderMembers(workspace)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { /* you might implement invite flow */ }}
                  className="px-3 py-1 border rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Invite
                </button>
                <button
                  onClick={openCreate}
                  className="bg-sky-600 text-white px-4 py-2 rounded shadow hover:bg-sky-700"
                >
                  New Project
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Projects</h2>

              {projects.length === 0 ? (
                <div className="rounded-xl border border-gray-100 bg-white p-10 flex flex-col items-center justify-center text-center text-gray-500">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-4 opacity-60">
                    <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                  <p className="text-sm mb-4">Get started by creating your first project in this workspace</p>
                  <button onClick={openCreate} className="bg-sky-600 text-white px-4 py-2 rounded">Create Project</button>
                </div>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => {
                    const pid = project._id ?? project.id;
                    const title = project.title ?? project.name ?? "Untitled Project";
                    const desc = project.description ?? project.summary ?? "";
                    const base = user?.role === "admin" ? `/admin/workspaces/${workspaceId}` : `/workspaces/${workspaceId}`;
                    const projectUrl = `${base}/projects/${pid}`;

                    return (
                      <li key={pid} className="border rounded-lg p-4 bg-white hover:shadow transition">
                        <Link to={projectUrl} className="block">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{title}</h3>
                            <div className="text-xs text-gray-400">{project.priority ? project.priority : ""}</div>
                          </div>
                          <p className="text-sm text-gray-500 mt-2">{desc || "No description"}</p>
                          <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                            <div>{project.members ? (Array.isArray(project.members) ? project.members.length : project.membersCount || 0) : 0} members</div>
                            <div>{formatDate(project.createdAt) ?? ""}</div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
