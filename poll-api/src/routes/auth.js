'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { validateRegister, validateLogin } = require('../validation');
const { signToken, createRequireAuth } = require('../middleware/auth');

// All statements are constant strings; user input only travels as parameters.
const SQL_INSERT_USER =
  'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
const SQL_FIND_FOR_LOGIN =
  'SELECT id, username, email, password_hash FROM users WHERE email = ? OR username = ? LIMIT 1';
const SQL_FIND_BY_ID = 'SELECT id, username, email, created_at FROM users WHERE id = ?';

const BCRYPT_COST = 12;

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const publicUser = (row) => ({ id: row.id, username: row.username, email: row.email });

function createAuthRouter(pool, { jwtSecret, jwtExpiresIn, bcryptCost = BCRYPT_COST, authRateLimit = 10 }) {
  const router = express.Router();
  const requireAuth = createRequireAuth(jwtSecret);
  const tokenOptions = { jwtSecret, jwtExpiresIn };

  // A real bcrypt hash of a throwaway string. Comparing against it when the
  // user does not exist keeps response time similar, so attackers cannot probe
  // which accounts exist by measuring latency.
  const dummyHash = bcrypt.hashSync('not-a-real-password', bcryptCost);

  // Stricter than the global limiter: slows down password guessing
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: authRateLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again in a minute.' },
  });

  // POST /api/auth/register - body: { username, email, password }
  router.post(
    '/register',
    authLimiter,
    asyncHandler(async (req, res) => {
      const result = validateRegister(req.body);
      if (!result.ok) {
        return res.status(400).json({ error: 'Validation failed.', details: result.errors });
      }
      const { username, email, password } = result.value;

      const passwordHash = await bcrypt.hash(password, bcryptCost);

      let insertId;
      try {
        const [inserted] = await pool.execute(SQL_INSERT_USER, [username, email, passwordHash]);
        insertId = inserted.insertId;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'That username or email is already in use.' });
        }
        throw err;
      }

      const user = { id: insertId, username, email };
      res.status(201).json({ token: signToken(user, tokenOptions), user });
    })
  );

  // POST /api/auth/login - body: { identifier, password }
  router.post(
    '/login',
    authLimiter,
    asyncHandler(async (req, res) => {
      const result = validateLogin(req.body);
      if (!result.ok) {
        return res.status(400).json({ error: 'Validation failed.', details: result.errors });
      }
      const { identifier, password } = result.value;

      const [rows] = await pool.execute(SQL_FIND_FOR_LOGIN, [
        identifier.toLowerCase(),
        identifier,
      ]);
      const row = rows[0];

      // Always run one bcrypt comparison, whether or not the user exists
      const matches = await bcrypt.compare(password, row ? row.password_hash : dummyHash);
      if (!row || !matches) {
        return res.status(401).json({ error: 'Invalid username/email or password.' });
      }

      res.json({ token: signToken(row, tokenOptions), user: publicUser(row) });
    })
  );

  // GET /api/auth/me - the logged-in user (also used by the frontend to
  // check that a stored token is still valid)
  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const [rows] = await pool.execute(SQL_FIND_BY_ID, [req.user.id]);
      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
      }
      res.json({ user: { ...publicUser(rows[0]), createdAt: rows[0].created_at } });
    })
  );

  return router;
}

module.exports = { createAuthRouter };
