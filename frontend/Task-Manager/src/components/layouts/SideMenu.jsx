import React, { useContext, useEffect, useState } from "react";
import { UserContext } from "../../context/userContext";
import { SIDE_MENU_DATA, SIDE_MENU_USER_DATA } from "../../utils/data";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";

const contains = (txt, sub) =>
  typeof txt === "string" && typeof sub === "string"
    ? txt.toLowerCase().includes(sub.toLowerCase())
    : false;

// Detect menu items related to "Create Task"
const isCreateTaskItem = (item) => {
  const id = item?.id || "";
  const path = item?.path || "";
  const label = item?.label || "";

  if (id === "createTask") return true;
  if (contains(path, "/create-task")) return true;
  if (contains(label, "create") && contains(label, "task")) return true;
  if (contains(id, "create") && contains(id, "task")) return true;

  return false;
};

const SideMenu = ({ activeMenu }) => {
  const { user, clearUser } = useContext(UserContext);
  const [sideMenuData, setSideMenuData] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const navigate = useNavigate();

  const handleClick = (route) => {
    if (!route) return;

    if (route === "logout") {
      localStorage.clear();
      clearUser();
      navigate("/login");
      return;
    }

    navigate(route);
  };

  useEffect(() => {
    if (!user) {
      setSideMenuData([]);
      setWorkspaces([]);
      return;
    }

    const role = String(user.role || "").toLowerCase();
    const isAdmin = role === "admin";

    // GET BASE MENU
    const baseMenu = isAdmin ? SIDE_MENU_DATA : SIDE_MENU_USER_DATA;

    // ⭐ ALLOW Create Task for USERS also — no more hiding it
    const filteredMenu = Array.isArray(baseMenu)
      ? baseMenu.filter((item) => item) // only remove invalid items
      : [];

    setSideMenuData(filteredMenu);

    // ⭐ LOAD WORKSPACES FOR BOTH ADMIN & USER
    const fetchWs = async () => {
      try {
        setWorkspacesLoading(true);

        const path =
          typeof API_PATHS.WORKSPACES.GET_ALL === "function"
            ? API_PATHS.WORKSPACES.GET_ALL()
            : API_PATHS.WORKSPACES.GET_ALL;

        if (!path) return;

        const res = await axiosInstance.get(path);
        const payload = res?.data ?? {};

        const arr = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.workspaces)
          ? payload.workspaces
          : Array.isArray(payload.data)
          ? payload.data
          : [];

        setWorkspaces(arr);
      } catch (err) {
        console.error("Failed to fetch workspaces", err);
        setWorkspaces([]);
      } finally {
        setWorkspacesLoading(false);
      }
    };

    fetchWs();
  }, [user]);

  // ⭐ Admin = /admin/workspaces , User = /workspaces
  const workspaceBasePath =
    String(user?.role).toLowerCase() === "admin"
      ? "/admin/workspaces"
      : "/workspaces";

  return (
    <div className="w-64 h-[calc(100vh-61px)] bg-white border-r border-gray-200 sticky top-[61px] z-20 overflow-auto">
      {/* USER PROFILE */}
      <div className="flex flex-col items-center mb-7 pt-5">
        <div className="w-20 h-20 rounded-full overflow-hidden border mb-2">
          <img
            src={user?.profileImageUrl || ""}
            alt="profile"
            className="w-full h-full object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>

        {String(user?.role) === "admin" && (
          <div className="text-[10px] font-medium text-white bg-primary px-3 py-0.5 rounded mt-1">
            Admin
          </div>
        )}

        <h5 className="text-md font-semibold">
          {user?.name || user?.fullName || "User"}
        </h5>
        <p className="text-sm text-gray-500">{user?.email || ""}</p>
      </div>

      {/* MENU ITEMS */}
      <nav>
        {sideMenuData.length > 0 ? (
          sideMenuData.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.path || activeMenu === item.id;
            const path = item.path || item.id || null;

            return (
              <button
                key={item.id || item.label}
                className={`w-full flex items-center gap-4 text-[15px] py-3 px-6 mb-3 rounded text-left ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => handleClick(path)}
              >
                {Icon && <Icon className="text-lg" />}
                <span>{item.label}</span>
              </button>
            );
          })
        ) : (
          <div className="px-6 text-sm text-gray-400">No menu items</div>
        )}

        {/* ⭐ WORKSPACE LIST (Admin + User both) */}
        {workspaces.length > 0 && (
          <div className="mt-4 px-6">
            <h6 className="text-xs text-gray-400 uppercase mb-2">
              Workspaces
            </h6>

            {workspaces.map((ws) => {
              const id = ws._id;

              const isActive =
                activeMenu === `${workspaceBasePath}/${id}` ||
                activeMenu === id;

              return (
                <button
                  key={id}
                  className={`block w-full text-left text-sm py-2 px-3 mb-1 rounded ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  onClick={() => handleClick(`${workspaceBasePath}/${id}`)}
                >
                  {ws.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Loading workspaces */}
        {workspacesLoading && (
          <div className="px-6 text-sm text-gray-400 mt-2">
            Loading workspaces...
          </div>
        )}
      </nav>
    </div>
  );
};

export default SideMenu;
