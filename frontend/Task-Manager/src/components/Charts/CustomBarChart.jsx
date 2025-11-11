// src/components/Charts/CustomBarChart.jsx
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

const CustomBarChart = ({ data }) => {
  // Function to alternate colors based on priority
  const getBarColor = (entry) => {
    switch (entry?.priority) {
      case "low":
        return "#00BC7D"; // green
      case "medium":
        return "#FE9900"; // orange
      case "high":
        return "#FF1F57"; // red
      default:
        return "#00BC7D"; // green fallback
    }
  };

  // Custom tooltip for the BarChart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white shadow-md rounded p-2 border border-gray-200 text-sm">
          <p className="font-medium text-gray-800 mb-1">
            {payload[0].payload.priority}
          </p>
          <p className="text-gray-600">
            Count:{" "}
            <span className="font-semibold text-gray-800">
              {payload[0].payload.count}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data}>
        <CartesianGrid stroke="none" />
        <XAxis dataKey="priority" tick={{ fontSize: 12, fill: "#555" }} stroke="none" />
        <YAxis tick={{ fontSize: 12, fill: "#555" }} stroke="none" />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />

        <Bar dataKey="count" nameKey="priority" fill="#FF8042" radius={[10, 10, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default CustomBarChart;
