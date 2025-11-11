import React from "react";

const Model = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black opacity-30" onClick={onClose}></div>
      <div className="relative bg-white rounded shadow-lg w-full max-w-xl z-10">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-medium">{title}</h3>
          <button onClick={onClose} className="text-xl px-2" aria-label="Close">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

export default Model;
