// backend/routes/departmentRoutes.js
const express = require("express");
const router = express.Router();

// Example in-memory list (replace with MongoDB later)
let departments = [
  { _id: "1", name: "Sales" },
  { _id: "2", name: "Fabrication" },
];

// GET /api/departments
router.get("/", async (req, res) => {
  return res.json(departments);
});

// POST /api/departments
router.post("/", async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Department name is required" });
  }

  const newDepartment = {
    _id: String(Date.now()),
    name: name.trim(),
  };

  departments.push(newDepartment);

  return res.status(201).json(newDepartment);
});

module.exports = router;
