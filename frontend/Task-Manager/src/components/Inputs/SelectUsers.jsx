import React, { useEffect, useMemo, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { LuUsers, LuSearch } from "react-icons/lu";
import Model from "../Model";
import AvatarGroup from "../layouts/AvatarGroup";

/**
 * SelectUsers - modal to pick users grouped/filtered by department
 *
 * Usage: <SelectUsers selectedUsers={[...] } setSelectedUsers={fn} />
 */
const SelectUsers = ({ selectedUsers = [], setSelectedUsers }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempSelectedUsers, setTempSelectedUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [activeDept, setActiveDept] = useState("All");
  const [loading, setLoading] = useState(false);

  // helpers
  const normId = (v) => (v === undefined || v === null ? "" : String(v));
  const normalizeUserId = (u) => normId(u._id ?? u.id);

  const normalizedParentSelectedIds = Array.isArray(selectedUsers)
    ? selectedUsers.map((s) =>
        typeof s === "object"
          ? normId(s._id ?? s.id ?? s.value ?? s.valueOf())
          : normId(s)
      )
    : [];

  // fetch users
  useEffect(() => {
    let mounted = true;
    const getAllUsers = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(API_PATHS.USERS.GET_ALL_USERS);
        const users = Array.isArray(res.data) ? res.data : res?.data?.users ?? [];
        if (mounted) setAllUsers(Array.isArray(users) ? users : []);
      } catch (err) {
        console.error("Error fetching users:", err);
        if (mounted) setAllUsers([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    getAllUsers();
    return () => (mounted = false);
  }, []);

  // group users by department name
  const grouped = useMemo(() => {
    return allUsers.reduce((acc, user) => {
      const raw = user.department;
      const dept =
        typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "No Department";
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(user);
      return acc;
    }, {});
  }, [allUsers]);

  // department list: All + sorted keys, "No Department" last
  const departments = useMemo(() => {
    const keys = Object.keys(grouped).sort((a, b) => {
      if (a === "No Department") return 1;
      if (b === "No Department") return -1;
      return a.localeCompare(b);
    });
    return ["All", ...keys];
  }, [grouped]);

  // visible users according to activeDept & search
  const visibleUsers = useMemo(() => {
    const deptUsers = activeDept === "All" ? allUsers : grouped[activeDept] ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return deptUsers;
    return deptUsers.filter((u) => {
      const name = (u.name || u.fullName || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [allUsers, grouped, activeDept, search]);

  // avatar preview from parent selection
  const selectedUserAvatars = allUsers
    .filter((u) => normalizedParentSelectedIds.includes(normalizeUserId(u)))
    .map((u) => u.profileImageUrl || u.avatar || null)
    .filter(Boolean);

  const openModal = () => {
    setTempSelectedUsers(normalizedParentSelectedIds.slice());
    setIsModalOpen(true);
    setSearch("");
    setActiveDept("All");
  };

  const toggleUserSelection = (userId) => {
    const id = normId(userId);
    setTempSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAssign = (e) => {
    e?.preventDefault?.();
    if (typeof setSelectedUsers === "function") {
      setSelectedUsers(tempSelectedUsers.slice());
    } else {
      console.warn("SelectUsers: parent did not pass setSelectedUsers function.");
    }
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleSelectAllVisible = () => {
    const ids = visibleUsers.map(normalizeUserId);
    // toggle: if all visible already selected -> remove them; else add them
    const allSelected = ids.every((id) => tempSelectedUsers.includes(id));
    setTempSelectedUsers((prev) =>
      allSelected ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
    );
  };

  // small avatar fallback: data URL (simple gray)
  const AVATAR_FALLBACK =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='%23E5E7EB'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%239CA3AF' font-size='20'>User</text></svg>";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {selectedUserAvatars.length > 0 ? (
          <>
            <AvatarGroup avatars={selectedUserAvatars} maxVisible={3} />
            <button
              type="button"
              className="ml-2 card-btn px-3 py-1.5 flex items-center gap-2"
              onClick={openModal}
            >
              <LuUsers className="text-sm" /> Edit Members
            </button>
          </>
        ) : (
          <button type="button" className="card-btn px-3 py-1.5" onClick={openModal}>
            <LuUsers className="text-sm" /> Add Members
          </button>
        )}
      </div>

      <Model isOpen={isModalOpen} onClose={handleCancel} title="Select Users">
        {/* Modal body: fixed max width and height so layout is stable */}
        <div className="w-[90vw] max-w-4xl h-[70vh] bg-white rounded-md overflow-hidden">
          <div className="flex h-full">
            {/* Left: Departments (fixed column) */}
            <aside className="w-64 min-w-[200px] border-r bg-gray-50 flex flex-col">
              <div className="px-4 py-3 border-b">
                <div className="text-sm font-semibold">Departments</div>
              </div>

              <div className="flex-1 overflow-auto">
                <ul className="p-2 space-y-1">
                  {departments.map((dept) => {
                    const count = dept === "All" ? allUsers.length : (grouped[dept]?.length || 0);
                    const active = dept === activeDept;
                    return (
                      <li key={dept}>
                        <button
                          type="button"
                          onClick={() => setActiveDept(dept)}
                          className={`w-full text-left px-3 py-2 rounded flex items-center justify-between transition-colors ${
                            active ? "bg-white shadow-sm border-l-4 border-blue-600" : "hover:bg-white/60"
                          }`}
                        >
                          <span className="text-sm">{dept}</span>
                          <span className="text-xs text-gray-500">{count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="p-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDept("All");
                    setSearch("");
                  }}
                  className="w-full text-sm px-3 py-2 rounded border hover:bg-gray-100"
                >
                  Reset Filter
                </button>
              </div>
            </aside>

            {/* Right: Users list */}
            <section className="flex-1 flex flex-col">
              {/* Top: search + controls */}
              <div className="flex items-center gap-3 px-4 py-3 border-b">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
                    />
                    <LuSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="px-3 py-2 border rounded text-sm"
                >
                  Toggle Select All Visible
                </button>

                <button
                  type="button"
                  onClick={() => setTempSelectedUsers([])}
                  className="px-3 py-2 border rounded text-sm"
                >
                  Clear
                </button>
              </div>

              {/* Users area: scrollable */}
              <div className="flex-1 overflow-auto p-2">
                {loading ? (
                  <div className="p-6 text-center text-sm">Loading users...</div>
                ) : visibleUsers.length === 0 ? (
                  <div className="p-6 text-sm">No users found.</div>
                ) : (
                  <div className="space-y-2">
                    {visibleUsers.map((user) => {
                      const id = normalizeUserId(user);
                      const checked = tempSelectedUsers.includes(id);
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between gap-4 p-3 bg-white rounded shadow-sm hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={user.profileImageUrl || user.avatar || AVATAR_FALLBACK}
                              alt={user.name || user.email}
                              onError={(e) => {
                                e.currentTarget.src = AVATAR_FALLBACK;
                              }}
                              className="w-10 h-10 rounded-full object-cover border"
                            />
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {user.name || user.fullName || user.email}
                              </span>
                              <span className="text-xs text-gray-500">{user.email}</span>
                              <span className="text-xs text-gray-400 mt-1">
                                {typeof user.department === "string" && user.department.trim()
                                  ? user.department.trim()
                                  : "No Department"}
                              </span>
                            </div>
                          </div>

                          <div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUserSelection(id)}
                              className="w-4 h-4"
                              aria-label={`Select ${user.name || user.email}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-4 py-3 border-t bg-gray-50">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded border bg-white hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssign}
                  className="px-4 py-2 rounded bg-blue-600 text-white shadow"
                >
                  Assign
                </button>
              </div>
            </section>
          </div>
        </div>
      </Model>
    </div>
  );
};

export default SelectUsers;
