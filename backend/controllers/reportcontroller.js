const Task = require('../models/Task');
const User = require('../models/User');
const excelJS = require('exceljs');
 
// @desc    Export tasks report to Excel
// @route   GET /api/reports/export/tasks
// @access  Private/Admin
const exportTasksReport = async (req, res) => {
  try {
    const tasks = await Task.find().populate('assignedTo', 'name email');
    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tasks Report');

    worksheet.columns = [
      { header: "Task ID",key: "id", width: 25},
      { header: "Title", key: "title", width: 30 },
      { header: "Description", key: "description", width: 50 },
      { header: "Status", key: "status", width: 15 },
      { header: "Priority", key: "priority", width: 10 },
      { header: "Due Date", key: "dueDate", width: 20 },
      { header: "Assigned To", key: "assignedTo", width: 30 },
    ];

    tasks.forEach((task) => {
      const assignedToNames = task.assignedTo.map(user => user.name).join(', ');
      worksheet.addRow({
        id: task._id.toString(),
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : '',
        assignedTo: assignedToNames,
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "tasks_report.xlsx"
    );
    return workbook.xlsx.write(res).then(() => {
      res.status(200).end();
    });
  }
  catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Export users report to Excel
// @route   GET /api/reports/export/users
// @access  Private/Admin
const exportUsersReport = async (req, res) => {
  try {
    const users = await User.find().select("name email_id").lean();
    const userTasks = await Task.find().populate('assignedTo', 'name email_id');

    const userTaskMap = {};
    users.forEach(user => {
      userTaskMap[user._id] = { user:user.name, email: user.email_id, taskcount: 0,pendingTasks:0,inprogressTask:0,completedTasks:0 };
    });

    userTasks.forEach(task => {
      task.assignedTo.forEach(user => {
        if (userTaskMap[user._id]) {
          userTaskMap[user._id].taskcount += 1;
          if(task.status === 'Pending') userTaskMap[user._id].pendingTasks += 1;
          else if(task.status === 'In Progress') userTaskMap[user._id].inprogressTask += 1;
          else if(task.status === 'Completed') userTaskMap[user._id].completedTasks += 1;
        }
      });
    });
    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users Report');

    worksheet.columns = [
      { header: "User Name", key: "user", width: 30 },
      { header: "Email", key: "email", width: 30 },
      { header: "Total Tasks", key: "taskcount", width: 15 },
      { header: "Pending Tasks", key: "pendingTasks", width: 15 },
      { header: "In Progress Tasks", key: "inprogressTask", width: 20 },
      { header: "Completed Tasks", key: "completedTasks", width: 20 },
    ];
    Object.values(userTaskMap).forEach(user => {
      worksheet.addRow(user);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "users_report.xlsx"
    );
    return workbook.xlsx.write(res).then(() => {
      res.status(200).end();
    });
  }
  catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  exportTasksReport,
  exportUsersReport,
};
 