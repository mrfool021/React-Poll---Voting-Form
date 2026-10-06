'use strict';

const mysql = require('mysql2/promise');
const { createApp } = require('./app');

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
  database: required('DB_NAME'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  charset: 'utf8mb4',
});

const app = createApp(pool, {
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:8080')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  enforceOneVote: (process.env.ENFORCE_ONE_VOTE || 'true') !== 'false',
  voterSalt: required('VOTER_SALT'),
  jwtSecret: jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`poll-api listening on port ${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
