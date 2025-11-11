import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/layouts/AuthLayout";
import Input from "../../components/Inputs/Input";
import ProfilePhotoSelector from "../../components/Inputs/ProfilePhotoSelector";
import { UserContext } from "../../context/userContext";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import uploadImage from "../../utils/uploadImage";

const SignUp = () => {
  const [profilePic, setProfilePic] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(""); // ✅ new for WhatsApp
  const [adminInviteToken, setAdminInviteToken] = useState("");
  const [error, setError] = useState("");

  const { updateUser } = useContext(UserContext);
  const navigate = useNavigate();

  const handleProfileChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      setProfilePic(file);
      setProfilePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveProfile = () => {
    setProfilePic(null);
    setProfilePreview(null);
  };

  const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

  // ✅ E.164 format validation (+919876543210)
  const isValidPhone = (value) => /^\+[1-9]\d{7,14}$/.test(value.trim());

  const handleTokenChange = (e) => {
    const digitsOnly = (e.target.value || "").replace(/\D/g, "");
    setAdminInviteToken(digitsOnly.slice(0, 10));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const nameTrimmed = fullName.trim();
    const emailTrimmed = email.trim();
    const phoneTrimmed = phone.trim();

    if (!nameTrimmed) return setError("Please enter your full name.");
    if (!emailTrimmed) return setError("Please enter your email address.");
    if (!isValidEmail(emailTrimmed)) return setError("Please enter a valid email address.");
    if (!password) return setError("Please enter your password.");
    if (password.length < 8)
      return setError("Password must be at least 8 characters long.");

    // ✅ Phone validation (optional but recommended)
    if (phoneTrimmed && !isValidPhone(phoneTrimmed)) {
      return setError("Invalid phone format. Use +919876543210 format.");
    }

    if (adminInviteToken && !/^\d+$/.test(adminInviteToken)) {
      return setError("Admin invite token must contain only digits.");
    }

    try {
      let profileImageUrl = "";

      if (profilePic) {
        const imgUploadRes = await uploadImage(profilePic);
        profileImageUrl = imgUploadRes?.imageUrl ?? "";
      }

      const payload = {
        name: nameTrimmed,
        email: emailTrimmed,
        password,
        phone: phoneTrimmed || undefined, // ✅ added
        adminInviteToken: adminInviteToken || undefined,
        profileImageUrl, // corrected key to match backend
      };

      const response = await axiosInstance.post(API_PATHS.AUTH.REGISTER, payload);
      const { token, role } = response.data ?? {};

      if (token) {
        localStorage.setItem("token", token);
        updateUser(response.data);
        navigate(role === "admin" ? "/admin/dashboard" : "/user/dashboard");
      } else {
        setError("Registration succeeded but no token received. Please login.");
      }
    } catch (err) {
      const serverMessage = err?.response?.data?.message;
      setError(serverMessage || "Something went wrong. Please try again.");
    }
  };

  return (
    <AuthLayout>
      <div className="lg:w-[70%] h-full flex flex-col justify-start px-7 pt-10">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-black leading-tight mb-1">
            Create an Account
          </h3>
          <p className="text-sm text-slate-700">
            Join us today by entering your details below.
          </p>
        </div>

        <ProfilePhotoSelector
          profilePreview={profilePreview}
          onFileChange={handleProfileChange}
          onRemove={handleRemoveProfile}
        />

        <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-2xl" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              label="Full Name"
              placeholder="John"
              type="text"
              required
            />
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              label="Email Address"
              placeholder="john@example.com"
              type="email"
              required
            />
          </div>

          {/* ✅ Phone number field (for WhatsApp) */}
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            label="Phone Number (with country code)"
            placeholder="+919876543210"
            type="text"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label="Password"
              placeholder="Min 8 Characters"
              type="password"
              required
            />
            <Input
              value={adminInviteToken}
              onChange={handleTokenChange}
              label="Admin Invite Token"
              placeholder="Digits only (optional)"
              type="text"
              maxLength={10}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded mt-2 hover:bg-blue-700 transition"
          >
            SIGN UP
          </button>
        </form>

        <p className="text-sm text-slate-700 mt-4">
          Already have an account?{" "}
          <Link className="text-primary underline" to="/login">
            Login
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default SignUp;
