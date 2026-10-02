const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const Admin = require("../models/Admin");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again later.",
  },
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required.",
      });
    }

    const admin = await Admin.findOne({ username });

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.adminId = admin._id.toString();
      req.session.username = admin.username;

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);

        res.json({
          message: "Login successful.",
          username: admin.username,
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);

    res.clearCookie("employee.sid");
    res.json({ message: "Logged out successfully." });
  });
});

router.get("/me", (req, res) => {
  if (!req.session.adminId) {
    return res.status(401).json({ message: "Not logged in." });
  }

  res.json({ username: req.session.username });
});

module.exports = router;