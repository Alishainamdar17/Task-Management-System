import React, { useEffect, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { LuUsers } from "react-icons/lu";
import Model from "../Model";
import AvatarGroup from "../layouts/AvatarGroup";

// Props: selectedUsers: array of IDs or array of user-like objects, setSelectedUsers: function
const SelectUsers = ({ selectedUsers = [], setSelectedUsers }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempSelectedUsers, setTempSelectedUsers] = useState([]);

  // normalize any ID-like value to string
  const normId = (v) => (v === undefined || v === null ? "" : String(v));

  // normalize the parent selectedUsers prop into an array of id-strings
  const normalizedParentSelectedIds = Array.isArray(selectedUsers)
    ? selectedUsers.map((s) =>
        typeof s === "object"
          ? normId(s._id ?? s.id ?? s.value ?? s.valueOf())
          : normId(s)
      )
    : [];

  useEffect(() => {
    let mounted = true;
    const getAllUsers = async () => {
      try {
        const res = await axiosInstance.get(API_PATHS.USERS.GET_ALL_USERS);
        const users = Array.isArray(res.data) ? res.data : res?.data?.users ?? [];
        if (mounted) setAllUsers(Array.isArray(users) ? users : []);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    getAllUsers();
    return () => (mounted = false);
  }, []);

  // open modal and seed temp from parent selection
  const openModal = () => {
    setTempSelectedUsers(normalizedParentSelectedIds.slice());
    setIsModalOpen(true);
  };

  const toggleUserSelection = (userId) => {
    const id = normId(userId);
    setTempSelectedUsers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleAssign = (e) => {
    e?.preventDefault?.();
    if (typeof setSelectedUsers === "function") {
      // send back ids (strings)
      setSelectedUsers(tempSelectedUsers.slice());
    } else {
      console.warn("SelectUsers: parent did not pass setSelectedUsers function.");
    }
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  // selected avatars (preview uses parent's selectedUsers normalized)
  const selectedUserAvatars = allUsers
    .filter((u) => normalizedParentSelectedIds.includes(normId(u._id ?? u.id)))
    .map((u) => u.profileImageUrl || u.avatar || null)
    .filter(Boolean); // drop nulls

  // small helpful logs (remove in production)
  useEffect(() => {
    console.debug("[SelectUsers] allUsers count:", allUsers.length);
  }, [allUsers.length]);

  useEffect(() => {
    console.debug("[SelectUsers] parent selected IDs:", normalizedParentSelectedIds);
  }, [selectedUsers]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {selectedUserAvatars.length > 0 ? (
          <>
            <AvatarGroup avatars={selectedUserAvatars} maxVisible={3} />
            <button type="button" className="ml-2 card-btn" onClick={openModal}>
              <LuUsers className="text-sm inline" /> Edit Members
            </button>
          </>
        ) : (
          <button type="button" className="card-btn" onClick={openModal}>
            <LuUsers className="text-sm" /> Add Members
          </button>
        )}
      </div>

      <Model isOpen={isModalOpen} onClose={handleCancel} title="Select Users">
        <div className="space-y-2 h-[60vh] overflow-auto">
          {allUsers.length === 0 ? (
            <p className="text-sm">No users available.</p>
          ) : (
            allUsers.map((user) => {
              const id = normId(user._id ?? user.id);
              const checked = tempSelectedUsers.includes(id);
              return (
                <div key={id} className="flex items-center justify-between gap-4 p-2 rounded hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.profileImageUrl || user.avatar}
                      alt={user.name || "avatar"}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{user.name || user.fullName || user.email}</span>
                      <span className="text-xs text-gray-500">{user.email}</span>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleUserSelection(id)}
                    className="w-4 h-4"
                    aria-label={`Select ${user.name}`}
                  />
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={handleCancel} className="px-4 py-2 rounded border">
            Cancel
          </button>
          <button type="button" onClick={handleAssign} className="px-4 py-2 rounded bg-blue-600 text-white">
            Assign
          </button>
        </div>
      </Model>
    </div>
  );
};

export default SelectUsers;
