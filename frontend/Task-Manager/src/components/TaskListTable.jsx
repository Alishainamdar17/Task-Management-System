// src/components/Tasks/TaskListTable.jsx
import React from "react";
import moment from "moment";

const TaskListTable = ({ tableData = [] }) => {
  // Solid badge color helpers (return literal tailwind classes)
  const getStatusBadgeColor = (status = "") => {
    switch (String(status).toLowerCase()) {
      case "completed":
        return "bg-green-500 text-white";
      case "pending":
        return "bg-purple-500 text-white";
      case "in progress":
      case "inprogress":
        return "bg-cyan-500 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  const getPriorityBadgeColor = (priority = "") => {
    switch (String(priority).toLowerCase()) {
      case "high":
        return "bg-red-500 text-white";
      case "medium":
        return "bg-orange-500 text-white";
      case "low":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  // Turn "pending" -> "Pending"
  const humanize = (str = "") =>
    String(str).length > 0 ? String(str).charAt(0).toUpperCase() + String(str).slice(1) : "-";

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left">
        <thead>
          <tr className="text-left">
            <th className="py-3 px-4 text-gray-800 font-medium text-[13px]">Name</th>
            <th className="py-3 px-4 text-gray-800 font-medium text-[13px]">Status</th>
            <th className="py-3 px-4 text-gray-800 font-medium text-[13px]">Priority</th>
            <th className="py-3 px-4 text-gray-800 font-medium text-[13px]">Created On</th>
          </tr>
        </thead>

        <tbody>
          {tableData.length === 0 ? (
            <tr>
              <td className="py-6 px-4 text-gray-500" colSpan={4}>
                No tasks found.
              </td>
            </tr>
          ) : (
            tableData.map((task) => (
              <tr key={task._id || task.id || JSON.stringify(task)} className="border-t border-gray-200">
                {/* Name */}
                <td className="py-3 px-4 text-gray-700 text-[13px] line-clamp-1">
                  {task.title || task.name || "-"}
                </td>

                {/* Status */}
                <td className="py-3 px-4">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full inline-block ${getStatusBadgeColor(
                      task.status
                    )}`}
                  >
                    {humanize(task.status)}
                  </span>
                </td>

                {/* Priority */}
                <td className="py-3 px-4">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full inline-block ${getPriorityBadgeColor(
                      task.priority
                    )}`}
                  >
                    {humanize(task.priority)}
                  </span>
                </td>

                {/* Created On */}
                <td className="py-3 px-4 text-gray-700 text-[13px] whitespace-nowrap">
                  {task.createdAt ? moment(task.createdAt).format("DD MMM YYYY") : "N/A"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TaskListTable;
