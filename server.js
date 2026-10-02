require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const path = require("path");

const connectDB = require("./config/database");
const Admin = require("./models/Admin");
const requireAuth = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(helmet());

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "20kb" }));

app.use(
  session({
    name: "employee.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60,
    },
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  if (req.session.adminId) {
    return res.redirect("/dashboard");
  }

  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/dashboard", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/employees", require("./routes/employees"));

app.use((req, res) => {
  res.status(404).send("Page not found.");
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) return next(error);

  res.status(500).json({
    message: "Something went wrong. Please try again.",
  });
});

async function startServer() {
  if (!process.env.MONGODB_URI || !process.env.SESSION_SECRET) {
    throw new Error("MONGODB_URI and SESSION_SECRET must be set in .env");
  }

  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    throw new Error("Admin credentials must be set in .env");
  }

  if (process.env.ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  await connectDB();

  const existingAdmin = await Admin.findOne({
    username: process.env.ADMIN_USERNAME,
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD,
      12
    );

    await Admin.create({
      username: process.env.ADMIN_USERNAME,
      password: hashedPassword,
    });

    console.log("Initial admin account created.");
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start:", error.message);
  process.exit(1);
});