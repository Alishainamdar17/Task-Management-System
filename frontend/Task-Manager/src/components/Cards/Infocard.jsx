// src/components/common/InfoCard.jsx
import React from "react";

const InfoCard = ({ icon: Icon, label, value, color = "bg-gray-400" }) => {
  const displayValue = value === null || value === undefined || value === "" ? 0 : value;
  return (
    <div className="flex items-center gap-3 bg-white p-3 rounded shadow-sm border">
      {Icon ? (
        <div className={`p-2 rounded-full ${color} text-white`}>
          <Icon className="w-4 h-4" />
        </div>
      ) : (
        <div className={`w-3 h-3 md:w-4 md:h-4 ${color} rounded-full`} />
      )}
      <div className="text-sm text-gray-600">
        <div className="text-sm font-semibold text-black">{displayValue}</div>
        <div className="text-xs">{label}</div>
      </div>
    </div>
  );
};

export default InfoCard;
