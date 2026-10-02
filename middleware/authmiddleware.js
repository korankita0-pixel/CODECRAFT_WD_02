function requireAuth(req, res, next) {
  if (!req.session.adminId) {
    if (req.originalUrl.startsWith("/api/")) {
      return res.status(401).json({
        message: "Please log in to continue.",
      });
    }

    return res.redirect("/login");
  }

  next();
}

module.exports = requireAuth;