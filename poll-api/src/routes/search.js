'use strict';

const express = require('express');
const { sanitizeText, parseId } = require('../validation');

const SEARCH_LIMITS = { QUERY_MIN: 2, QUERY_MAX: 50 };

// All statements are constant strings; the search text only ever travels in the
// parameter array. LIMIT is a literal because mysql2 prepared statements do not
// accept a placeholder there.
const SQL_SEARCH_POLLS = `
  SELECT p.id, p.question, p.created_at, p.created_by, u.username AS creator
  FROM polls p
  LEFT JOIN users u ON u.id = p.created_by
  WHERE p.is_active = 1 AND p.question LIKE ?
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT 20
`;
const SQL_SEARCH_USERS = `
  SELECT id, username, created_at
  FROM users
  WHERE username LIKE ?
  ORDER BY username ASC
  LIMIT 20
`;
const SQL_USER_BY_ID = 'SELECT id, username, created_at FROM users WHERE id = ?';
const SQL_USER_POLLS = `
  SELECT id, question, created_at
  FROM polls
  WHERE created_by = ? AND is_active = 1
  ORDER BY created_at DESC, id DESC
  LIMIT 50
`;

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Escapes LIKE wildcards so "100%" or "a_b" is matched literally. */
const likePattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

/** GET /api/search?q=... - polls by question text, profiles by username */
function createSearchRouter(pool, { requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      // `q` can be an array or object (?q[]=a) - only accept a plain string
      const q = typeof req.query.q === 'string' ? sanitizeText(req.query.q) : '';
      if (q.length < SEARCH_LIMITS.QUERY_MIN || q.length > SEARCH_LIMITS.QUERY_MAX) {
        return res.status(400).json({
          error: `Search text must be between ${SEARCH_LIMITS.QUERY_MIN} and ${SEARCH_LIMITS.QUERY_MAX} characters.`,
        });
      }

      const pattern = likePattern(q);
      const [[pollRows], [userRows]] = await Promise.all([
        pool.execute(SQL_SEARCH_POLLS, [pattern]),
        pool.execute(SQL_SEARCH_USERS, [pattern]),
      ]);

      res.json({
        query: q,
        polls: pollRows.map((r) => ({
          id: r.id,
          question: r.question,
          createdAt: r.created_at,
          creator: r.creator ? { id: r.created_by, username: r.creator } : null,
        })),
        // Public profile fields only - never the email or password hash
        users: userRows.map((r) => ({ id: r.id, username: r.username, createdAt: r.created_at })),
      });
    })
  );

  return router;
}

/** GET /api/users/:id - a public profile with the polls that user created */
function createUsersRouter(pool, { requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid user id.' });

      const [users] = await pool.execute(SQL_USER_BY_ID, [id]);
      if (users.length === 0) return res.status(404).json({ error: 'User not found.' });

      const [polls] = await pool.execute(SQL_USER_POLLS, [id]);
      res.json({
        id: users[0].id,
        username: users[0].username,
        createdAt: users[0].created_at,
        polls: polls.map((p) => ({ id: p.id, question: p.question, createdAt: p.created_at })),
      });
    })
  );

  return router;
}

module.exports = { createSearchRouter, createUsersRouter, likePattern };
