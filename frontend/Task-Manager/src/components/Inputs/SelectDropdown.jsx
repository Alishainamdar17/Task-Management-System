import React from "react";

const SelectDropdown = ({ options = [], value, onChange }) => {
  return (
    <select className="w-full border rounded p-2" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt) =>
        typeof opt === "object" ? (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ) : (
          <option key={opt} value={opt}>{opt}</option>
        )
      )}
    </select>
  );
};

export default SelectDropdown;
