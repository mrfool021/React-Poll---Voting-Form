'use strict';

const express = require('express');
const { sanitizeText } = require('../validation');
const { joinAvatar, publicUserFromRow, asyncHandler } = require('../lib/users');

const SEARCH_LIMITS = { QUERY_MIN: 2, QUERY_MAX: 50 };

// All statements are constant strings; the search text only ever travels in the
// parameter array. LIMIT is a literal because mysql2 prepared statements do not
// accept a placeholder there.
const SQL_SEARCH_POLLS = `
  SELECT p.id, p.question, p.created_at, p.created_by, u.username AS creator,
         u.avatar_url AS creator_avatar_url, ua.etag AS creator_avatar_ver,
         (pi.poll_id IS NOT NULL) AS has_image
  FROM polls p
  LEFT JOIN users u ON u.id = p.created_by
  ${joinAvatar('u', 'ua')}
  LEFT JOIN poll_images pi ON pi.poll_id = p.id
  WHERE p.is_active = 1 AND p.question LIKE ?
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT 20
`;
const SQL_SEARCH_USERS = `
  SELECT u.id, u.username, u.created_at, u.avatar_url, ua.etag AS avatar_ver
  FROM users u
  ${joinAvatar('u', 'ua')}
  WHERE u.username LIKE ?
  ORDER BY u.username ASC
  LIMIT 20
`;
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
          imageUrl: r.has_image ? `/api/polls/${r.id}/image` : null,
          creator: r.creator
            ? publicUserFromRow({
                id: r.created_by,
                username: r.creator,
                avatar_url: r.creator_avatar_url,
                avatar_ver: r.creator_avatar_ver,
              })
            : null,
        })),
        // Public profile fields only - never the email or password hash
        users: userRows.map((r) => ({ ...publicUserFromRow(r), createdAt: r.created_at })),
      });
    })
  );

  return router;
}

module.exports = { createSearchRouter, likePattern };
