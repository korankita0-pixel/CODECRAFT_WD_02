const express = require("express");
const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth);

function validateEmployee(body) {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const department = String(body.department || "").trim();
  const position = String(body.position || "").trim();
  const salary = Number(body.salary);

  if (
    name.length < 2 ||
    name.length > 80 ||
    !/^[A-Za-z][A-Za-z .'-]*$/.test(name)
  ) {
    return { error: "Enter a valid employee name." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) {
    return { error: "Enter a valid phone number." };
  }

  if (!department || !position) {
    return { error: "Department and position are required." };
  }

  if (
    body.salary === "" ||
    body.salary === undefined ||
    !Number.isFinite(salary) ||
    salary < 0
  ) {
    return { error: "Enter a valid salary." };
  }

  return {
    value: { name, email, phone, department, position, salary },
  };
}

// READ: Get all employees
router.get("/", async (req, res, next) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    next(error);
  }
});

// CREATE: Add employee
router.post("/", async (req, res, next) => {
  try {
    const result = validateEmployee(req.body);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const employee = await Employee.create(result.value);

    res.status(201).json({
      message: "Employee added successfully.",
      employee,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An employee with this email already exists.",
      });
    }

    next(error);
  }
});

// UPDATE: Edit employee
router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid employee ID." });
    }

    const result = validateEmployee(req.body);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      result.value,
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.json({
      message: "Employee updated successfully.",
      employee,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An employee with this email already exists.",
      });
    }

    next(error);
  }
});

// DELETE: Remove employee
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid employee ID." });
    }

    const employee = await Employee.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.json({ message: "Employee deleted successfully." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;