import React from "react";

const Model = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      ></div>

      {/* Modal Container */}
      <div className="relative bg-white rounded shadow-lg w-full max-w-5xl z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-white">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-xl leading-none px-2"
          >
            ×
          </button>
        </div>

        {/* Body (child controls full layout; NO padding) */}
        <div>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Model;
