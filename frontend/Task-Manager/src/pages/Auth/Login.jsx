import React, { useContext, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { UserContext } from "../../context/userContext";
import { validateEmail } from "../../utils/helper";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { updateUser } = useContext(UserContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await axiosInstance.post(API_PATHS.AUTH.LOGIN, { email, password });
      const { token, role } = res.data || {};

      if (token) {
        localStorage.setItem("token", token);
        updateUser(res.data);
        navigate(role === "admin" ? "/admin/dashboard" : "/user/dashboard");
      } else {
        setError("Login failed. Please check your credentials.");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 px-6 py-16">
        {/* Left hero section */}
        <div className="md:col-span-7 relative flex flex-col justify-center px-6">
          {/* Logo */}
          <div className="mb-8">
            <img src="/logo.jpg" alt="App Logo" className="w-90 h-auto" />
          </div>

          <div className="max-w-lg">
            <h1 className="text-5xl md:text-6xl font-extrabold text-sky-700 leading-tight mb-6">
              One Deo Leela<br />Task Manager<br/><br/>
            </h1>
            <p className="text-gray-600 text-lg leading-relaxed">
            
            </p>
          </div>

          {/* Decorative floating circle */}
          <div className="absolute left-10 md:left-32 bottom-9">
            <div className="floating-blob w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 shadow-xl flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-white/30" />
            </div>
          </div>
        </div>

        {/* Right login card */}
        <div className="md:col-span-5 flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-semibold text-sky-700 mb-1 text-center">Welcome back!</h2>
            <p className="text-sm text-gray-500 text-center mb-6">Log in to access your account</p>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email input */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Email Address</label>
                <div className="relative">
                  <FaEnvelope className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-3 py-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
                  />
                </div>
              </div>

              {/* Password input */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Password</label>
                <div className="relative">
                  <FaLock className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="password"
                    className="w-full pl-10 pr-10 py-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-3 text-gray-500"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {/* Links and buttons */}
              <div className="flex items-center justify-between text-sm">
                <Link to="/forgot-password" className="text-sky-600 hover:underline">
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-3 w-full text-white bg-sky-700 hover:bg-sky-800 rounded-full py-3 font-medium shadow"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>
            </form>

            {/* ✅ Signup link */}
            <p className="mt-6 text-sm text-center text-gray-600">
              Don’t have an account?{" "}
              <Link to="/signup" className="text-sky-600 font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Floating animation */}
      <style>{`
        .floating-blob {
          transform-origin: center;
          animation: floaty 3.8s ease-in-out infinite;
        }
        @keyframes floaty {
          0% { transform: translateY(0) scale(1); }
          35% { transform: translateY(-18px) scale(1.05); }
          70% { transform: translateY(4px) scale(1.02); }
          100% { transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default Login;
