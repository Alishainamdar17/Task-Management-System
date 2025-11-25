const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { exportTasksReport, exportUsersReport } = require('../controllers/reportcontroller');
const router = express.Router();

router.get("/export/tasks",protect, exportTasksReport);
router.get("/export/users",protect, exportUsersReport);

module.exports = router;