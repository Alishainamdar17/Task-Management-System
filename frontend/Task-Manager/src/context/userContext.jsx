// src/context/userContext.jsx
import React, { createContext, useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import { API_PATHS } from "../utils/apiPaths";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("tm_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const updateUser = (payload) => {
    const token = payload?.token || null;
    const userObj = payload?.user || payload;

    if (token) localStorage.setItem("token", token);
    if (userObj) {
      setUser(userObj);
      localStorage.setItem("tm_user", JSON.stringify(userObj));
    }
  };

  const clearUser = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("tm_user");
    setUser(null);
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(API_PATHS.AUTH.GET_PROFILE);
      setUser(res.data.user || res.data);
    } catch {
      clearUser();
    } finally {
      setLoading(false);
    }
  };

  return (
    <UserContext.Provider
      value={{ user, setUser, updateUser, clearUser, fetchProfile, loading }}
    >
      {children}
    </UserContext.Provider>
  );
};
