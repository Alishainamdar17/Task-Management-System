// PrivateRoute.jsx
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { UserContext } from '../context/userContext';

const PrivateRoute = ({ allowedRoles = [] }) => {
  const { user, loading } = useContext(UserContext);
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

export default PrivateRoute;
