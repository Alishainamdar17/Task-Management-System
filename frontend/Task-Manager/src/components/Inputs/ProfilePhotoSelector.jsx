import React from "react";

const ProfilePhotoSelector = ({ profilePreview, onFileChange, onRemove }) => {
  return (
    <div className="flex flex-col items-center mb-6">
      <div className="relative w-20 h-20 rounded-full overflow-hidden border">
        {profilePreview ? (
          <img
            src={profilePreview}
            alt="Profile preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            +
          </div>
        )}

        {profilePreview && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute bottom-0 right-0 -translate-y-2 translate-x-2 bg-red-500 text-white rounded-full p-1"
            aria-label="Remove profile picture"
          >
            🗑
          </button>
        )}
      </div>

      <label className="text-sm text-primary underline cursor-pointer mt-2">
        <input
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="hidden"
        />
        Upload Profile Picture
      </label>
    </div>
  );
};

export default ProfilePhotoSelector;
