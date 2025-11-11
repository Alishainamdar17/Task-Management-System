import React from "react";

const AvatarGroup = ({ avatars = [], maxVisible = 3 }) => {
  const visible = avatars.slice(0, maxVisible);
  const extra = avatars.length - visible.length;
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((src, i) => (
        <img key={i} src={src} alt={`a-${i}`} className="w-8 h-8 rounded-full border-2 border-white object-cover" />
      ))}
      {extra > 0 && (
        <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs">
          +{extra}
        </div>
      )}
    </div>
  );
};

export default AvatarGroup;
