require("dotenv").config();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;

if (!ADMIN_USERNAME) {
  throw new Error("ADMIN_USERNAME is not set.");
}

if (!ADMIN_PASSWORD_HASH) {
  throw new Error("ADMIN_PASSWORD_HASH is not set.");
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set.");
}

function login(username, password) {
  if (username !== ADMIN_USERNAME) {
    return null;
  }

  const passwordCorrect = bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);

  if (!passwordCorrect) {
    return null;
  }

  return jwt.sign(
    {
      username: ADMIN_USERNAME,
      role: "admin",
    },
    JWT_SECRET,
    {
      expiresIn: "8h",
    },
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    req.admin = decoded;

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired login session.",
    });
  }
}

module.exports = {
  login,
  authenticateToken,
};
