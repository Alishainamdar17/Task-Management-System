// src/pages/Workspaces.jsx
import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { UserContext } from "../../context/userContext";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import toast from "react-hot-toast";

const COLORS = [
  "#F97316", "#F59E0B", "#10B981", "#06B6D4", "#3B82F6",
  "#8B5CF6", "#EC4899", "#EF4444", "#334155", "#0F172A"
];

export default function Workspaces() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  // create modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // delete / duplicate states
  const [deletingId, setDeletingId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);

  // dropdown
  const [openDropdownId, setOpenDropdownId] = useState(null);
  // store refs per workspace id so outside-click detection is accurate
  const dropdownRefs = useRef({});

  // search
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const path =
        user?.role === "admin"
          ? (typeof API_PATHS.WORKSPACES.GET_ALL === "function" ? API_PATHS.WORKSPACES.GET_ALL() : API_PATHS.WORKSPACES.GET_ALL)
          : (typeof API_PATHS.WORKSPACES.GET_ME === "function" ? API_PATHS.WORKSPACES.GET_ME() : API_PATHS.WORKSPACES.GET_ME);

      const res = await axiosInstance.get(path);
      const data = Array.isArray(res.data) ? res.data : (res.data?.workspaces ?? res.data?.data ?? res.data);
      setWorkspaces(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[Workspaces] fetch error:", err?.response?.data || err);
      setWorkspaces([]);
      toast.error("Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // close dropdown on outside click or Escape — checks all dropdownRefs
  useEffect(() => {
    const handleClickOutside = (e) => {
      // if no dropdown open, nothing to do
      if (!openDropdownId) return;

      // get the ref for the currently open menu
      const menuEl = dropdownRefs.current[openDropdownId];
      if (menuEl && menuEl.contains(e.target)) {
        // click inside current menu -> do nothing
        return;
      }

      // click outside -> close
      setOpenDropdownId(null);
    };

    const handleEsc = (e) => {
      if (e.key === "Escape") setOpenDropdownId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [openDropdownId]);

  const formatDate = (raw) => {
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const openModal = () => {
    setName("");
    setDescription("");
    setColor(COLORS[0]);
    setError("");
    setShowModal(true);
  };
  const closeModal = () => setShowModal(false);

  // create
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Workspace name is required.");
      return;
    }
    setError("");
    setCreating(true);
    try {
      const payload = { name: name.trim(), description: description.trim(), color };
      const path = typeof API_PATHS.WORKSPACES.CREATE === "function" ? API_PATHS.WORKSPACES.CREATE() : API_PATHS.WORKSPACES.CREATE;
      const res = await axiosInstance.post(path, payload);
      const created = res.data?.workspace ?? res.data?.data ?? res.data;
      toast.success("Workspace created");
      closeModal();
      if (created && (created._id || created.id)) {
        const id = created._id ?? created.id;
        const basePath = user?.role === "admin" ? "/admin/workspaces" : "/workspaces";
        navigate(`${basePath}/${id}`);
      } else {
        await fetchWorkspaces();
      }
    } catch (err) {
      console.error("[Workspaces] create error:", err?.response?.data || err);
      setError(err?.response?.data?.message || "Failed to create workspace");
      toast.error("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  };

  // delete
  const handleDeleteWorkspace = async (id) => {
    if (!id) return;
    const ok = window.confirm("Are you sure you want to delete this workspace? This action cannot be undone.");
    if (!ok) return;
    setDeletingId(id);
    try {
      const path = typeof API_PATHS.WORKSPACES.DELETE === "function" ? API_PATHS.WORKSPACES.DELETE(id) : `/api/workspaces/${id}`;
      await axiosInstance.delete(path);
      toast.success("Workspace deleted");
      setWorkspaces((prev) => prev.filter((w) => (w._id ?? w.id) !== id));
    } catch (err) {
      console.error("[Workspaces] delete error:", err?.response?.data || err);
      toast.error("Failed to delete workspace");
    } finally {
      setDeletingId(null);
      setOpenDropdownId(null);
    }
  };

  // duplicate
  const handleDuplicate = async (ws, index) => {
    if (!ws) return;
    const id = ws._id ?? ws.id;
    setDuplicatingId(id);
    try {
      const payload = {
        name: `${ws.name ?? "Workspace"} (Copy)`,
        description: ws.description ?? "",
        color: ws.color || COLORS[index % COLORS.length],
      };
      const path = typeof API_PATHS.WORKSPACES.CREATE === "function" ? API_PATHS.WORKSPACES.CREATE() : API_PATHS.WORKSPACES.CREATE;
      await axiosInstance.post(path, payload);
      toast.success("Workspace duplicated");
      await fetchWorkspaces();
    } catch (err) {
      console.error("[Workspaces] duplicate error:", err?.response?.data || err);
      toast.error("Failed to duplicate workspace");
    } finally {
      setDuplicatingId(null);
      setOpenDropdownId(null);
    }
  };

  // share
  const handleShare = async (id) => {
    if (!id) return;
    const basePath = user?.role === "admin" ? "/admin/workspaces" : "/workspaces";
    const url = `${window.location.origin}${basePath}/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Workspace link copied to clipboard");
      setOpenDropdownId(null);
    } catch (err) {
      console.error("copy failed", err);
      toast.error("Failed to copy link");
    }
  };

  // edit
  const handleEditWorkspace = (id) => {
    const basePath = user?.role === "admin" ? "/admin/workspaces" : "/workspaces";
    navigate(`${basePath}/${id}/edit`);
  };

  const toggleDropdown = (id) => {
    setOpenDropdownId((prev) => (prev === id ? null : id));
  };

  const filtered = workspaces.filter((w) => {
    if (!debouncedQuery) return true;
    const name = (w.name ?? "").toString().toLowerCase();
    const desc = (w.description ?? "").toString().toLowerCase();
    return name.includes(debouncedQuery) || desc.includes(debouncedQuery);
  });

  const renderWorkspaceCard = (ws, index) => {
    const id = ws._id ?? ws.id;
    const wsColor = ws.color || COLORS[index % COLORS.length];
    const createdAt = ws.createdAt ?? ws.created_at ?? ws.created_on ?? ws.created;
    const formatted = formatDate(createdAt);

    let membersCount = 0;
    if (Array.isArray(ws.members)) membersCount = ws.members.length;
    else if (typeof ws.memberCount === "number") membersCount = ws.memberCount;
    else if (typeof ws.membersCount === "number") membersCount = ws.membersCount;
    else if (typeof ws.members === "number") membersCount = ws.members;

    return (
      <li key={id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg transform hover:-translate-y-1 transition overflow-visible">
        <div className="p-5 flex gap-4 items-start">
          <Link to={`${user?.role === "admin" ? "/admin/workspaces" : "/workspaces"}/${id}`} className="flex-1 flex gap-4 items-start no-underline">
            <div
              className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
              style={{ backgroundColor: wsColor }}
            >
              {ws.name ? String(ws.name).charAt(0).toUpperCase() : "W"}
            </div>

            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-800 truncate">{ws.name ?? "Untitled Workspace"}</h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ws.description ?? "No description"}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                {formatted && <span>Created: {formatted}</span>}
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {membersCount}
                </span>
              </div>
            </div>
          </Link>

          <div className="flex flex-col items-end justify-between ml-2 relative">
            <button
              type="button"
              onClick={() => toggleDropdown(id)}
              aria-haspopup="true"
              aria-expanded={openDropdownId === id}
              className="p-2 rounded-md hover:bg-gray-100"
              title="More options"
            >
              <svg className="w-5 h-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>

            {openDropdownId === id && (
              // assign the menu node to the dropdownRefs map for outside-click detection
              <div
                ref={(el) => { if (el) dropdownRefs.current[id] = el; else delete dropdownRefs.current[id]; }}
                className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 rounded-lg shadow-lg z-50 overflow-hidden"
              >
                <button
                  onClick={() => { setOpenDropdownId(null); navigate(`${user?.role === "admin" ? "/admin/workspaces" : "/workspaces"}/${id}`); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Open
                </button>

                <button
                  onClick={() => { handleEditWorkspace(id); setOpenDropdownId(null); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDuplicate(ws, index)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {duplicatingId === id ? "Duplicating..." : "Duplicate"}
                </button>

                <button
                  onClick={() => handleShare(id)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Share
                </button>

                <button
                  onClick={() => handleDeleteWorkspace(id)}
                  disabled={deletingId === id}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingId === id ? "Deleting..." : "Delete"}
                </button>
              </div>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <DashboardLayout activeMenu="Workspaces">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-sky-700">Workspaces</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your projects, teams and spaces</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border rounded-lg px-3 py-1 shadow-sm">
              <input
                type="search"
                placeholder="Search workspaces by name or description..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="outline-none w-80 text-sm text-gray-700"
                aria-label="Search workspaces"
              />
              {query && (
                <button onClick={() => setQuery("")} className="ml-2 px-2 py-1 rounded text-gray-500 hover:bg-gray-100">
                  Clear
                </button>
              )}
            </div>

            <button onClick={openModal} className="bg-sky-600 text-white px-4 py-2 rounded-lg shadow hover:bg-sky-700">
              New Workspace
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 rounded-lg bg-white border border-gray-100">Loading workspaces...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 rounded-lg bg-white border border-gray-100 text-center">
            <p className="text-gray-600 mb-4">{workspaces.length === 0 ? "No workspaces yet." : "No workspaces match your search."}</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={openModal} className="bg-sky-600 text-white px-4 py-2 rounded-lg">Create workspace</button>
              <button onClick={() => { setQuery(""); fetchWorkspaces(); }} className="px-4 py-2 rounded-lg border">Reset</button>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((ws, i) => renderWorkspaceCard(ws, i))}
          </ul>
        )}

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
              <h3 className="text-lg font-semibold mb-3">Create New Workspace</h3>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3 text-sm">{error}</div>}

              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Workspace Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="e.g. Marketing Team" required />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Workspace Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-3 py-2" rows={3} />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Workspace Color</label>
                  <div className="flex gap-2 items-center flex-wrap">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-8 h-8 rounded-full border-2 ${color === c ? "ring-2 ring-offset-2 ring-sky-300" : ""}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Select color ${c}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button type="button" onClick={closeModal} className="px-4 py-2 rounded border text-gray-700">Cancel</button>
                  <button type="submit" disabled={creating} className="px-4 py-2 rounded bg-sky-600 text-white disabled:opacity-60">{creating ? "Creating..." : "Create"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
