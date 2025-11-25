// routes/taskRoutes.js
const express = require('express');
const router = express.Router();

const {
  getDashboardData,
  getUserDashboardData,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  addDependency,
  updateDependency,
} = require('../controllers/taskController');

const { protect } = require('../middlewares/authMiddleware');

// Dashboard
router.get('/dashboard/admin', protect, getDashboardData);
router.get('/dashboard/user', protect, getUserDashboardData);

// Project-scoped
router.get('/project/:projectId', protect, getTasks);

// CRUD
router.get('/', protect, getTasks);
router.post('/', protect, createTask);
router.get('/:id', protect, getTaskById);
router.put('/:id', protect, updateTask);
router.delete('/:id', protect, deleteTask);

// dependencies
router.post('/:id/dependencies', protect, addDependency);
router.put('/:id/dependencies/:depId', protect, updateDependency);

// subtasks
router.post('/:id/subtasks', protect, addSubtask);
router.put('/:id/subtasks/:subId', protect, updateSubtask);
router.delete('/:id/subtasks/:subId', protect, deleteSubtask);

// status
router.put('/:id/status', protect, updateTaskStatus);

module.exports = router;
