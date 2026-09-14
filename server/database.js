require("dotenv").config();

const { Pool } = require("pg");

// ==================================================
// SUPABASE / POSTGRESQL CONNECTION
// ==================================================

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },
});

// ==================================================
// TEST DATABASE CONNECTION
// ==================================================

pool.on("connect", () => {
  console.log("Connected to Supabase PostgreSQL.");
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

// ==================================================
// EXPORT DATABASE POOL
// ==================================================

module.exports = pool;
