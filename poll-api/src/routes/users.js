'use strict';

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { parseId, validateAvatar, parsePage } = require('../validation');
const { joinAvatar, avatarUrlFor, publicUserFromRow, asyncHandler } = require('../lib/users');

const FOLLOW_PAGE_SIZE = 30;

// ---------------------------------------------------------------------------
// SQL (constant strings; request values are always bound parameters)
// ---------------------------------------------------------------------------
const SQL_PROFILE = `
  SELECT u.id, u.username, u.created_at, u.avatar_url, ua.etag AS avatar_ver,
         (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) AS followers_count,
         (SELECT COUNT(*) FROM follows f WHERE f.follower_id  = u.id) AS following_count,
         EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = u.id) AS is_following
  FROM users u
  ${joinAvatar('u', 'ua')}
  WHERE u.id = ?
`;
const SQL_USER_POLLS = `
  SELECT p.id, p.question, p.created_at, (pi.poll_id IS NOT NULL) AS has_image
  FROM polls p
  LEFT JOIN poll_images pi ON pi.poll_id = p.id
  WHERE p.created_by = ? AND p.is_active = 1
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT 50
`;
const SQL_USER_EXISTS = 'SELECT id, username FROM users WHERE id = ?';
const SQL_GET_AVATAR = 'SELECT mime, data FROM user_avatars WHERE user_id = ?';
const SQL_UPSERT_AVATAR = `
  INSERT INTO user_avatars (user_id, mime, data, etag) VALUES (?, ?, ?, ?) AS new_row
  ON DUPLICATE KEY UPDATE mime = new_row.mime, data = new_row.data, etag = new_row.etag
`;
const SQL_DELETE_AVATAR = 'DELETE FROM user_avatars WHERE user_id = ?';
const SQL_SET_AVATAR_URL = 'UPDATE users SET avatar_url = ? WHERE id = ?';
const SQL_AVATAR_STATE = `
  SELECT u.id, u.username, u.avatar_url, ua.etag AS avatar_ver
  FROM users u ${joinAvatar('u', 'ua')} WHERE u.id = ?
`;

const SQL_FOLLOW = 'INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)';
const SQL_UNFOLLOW = 'DELETE FROM follows WHERE follower_id = ? AND following_id = ?';
const SQL_FOLLOWER_COUNT = 'SELECT COUNT(*) AS n FROM follows WHERE following_id = ?';

// LIMIT/OFFSET cannot be placeholders in mysql2 prepared statements. The two
// numbers below are built from validated integers (clamped page 1..200 and a
// constant page size), never from raw request text.
function followListSql(direction, page) {
  const [joinOn, whereOn] =
    direction === 'followers' ? ['f.follower_id', 'f.following_id'] : ['f.following_id', 'f.follower_id'];
  const offset = (page - 1) * FOLLOW_PAGE_SIZE;
  return `
    SELECT u.id, u.username, u.avatar_url, ua.etag AS avatar_ver,
           EXISTS(SELECT 1 FROM follows x WHERE x.follower_id = ? AND x.following_id = u.id) AS is_following
    FROM follows f
    JOIN users u ON u.id = ${joinOn}
    ${joinAvatar('u', 'ua')}
    WHERE ${whereOn} = ?
    ORDER BY f.created_at DESC, u.id DESC
    LIMIT ${FOLLOW_PAGE_SIZE + 1} OFFSET ${offset}
  `;
}

function createUsersRouter(pool, { requireAuth, avatarMaxBytes }) {
  const router = express.Router();
  router.use(requireAuth);

  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    keyGenerator: (req) => `user:${req.user.id}`,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many changes, please slow down.' },
  });

  const avatarState = async (userId) => {
    const [rows] = await pool.execute(SQL_AVATAR_STATE, [userId]);
    return publicUserFromRow(rows[0]);
  };

  // ---- Avatar management (current user). Declared BEFORE '/:id' ----------
  // PUT /api/users/me/avatar - body: { image: "data:image/...;base64,..." } OR { url: "https://..." }
  router.put(
    '/me/avatar',
    writeLimiter,
    asyncHandler(async (req, res) => {
      const result = validateAvatar(req.body, { avatarMaxBytes });
      if (!result.ok) {
        return res.status(400).json({ error: 'Validation failed.', details: result.errors });
      }
      const { image, url } = result.value;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        if (image) {
          const etag = crypto.randomBytes(8).toString('hex');
          await conn.execute(SQL_UPSERT_AVATAR, [req.user.id, image.mime, image.buffer, etag]);
          await conn.execute(SQL_SET_AVATAR_URL, [null, req.user.id]);
        } else {
          await conn.execute(SQL_DELETE_AVATAR, [req.user.id]);
          await conn.execute(SQL_SET_AVATAR_URL, [url, req.user.id]);
        }
        await conn.commit();
      } catch (err) {
        try {
          await conn.rollback();
        } catch (_) {
          /* connection already broken */
        }
        throw err;
      } finally {
        conn.release();
      }
      res.json({ user: await avatarState(req.user.id) });
    })
  );

  // DELETE /api/users/me/avatar - back to the initial-letter placeholder
  router.delete(
    '/me/avatar',
    writeLimiter,
    asyncHandler(async (req, res) => {
      await pool.execute(SQL_DELETE_AVATAR, [req.user.id]);
      await pool.execute(SQL_SET_AVATAR_URL, [null, req.user.id]);
      res.json({ user: await avatarState(req.user.id) });
    })
  );

  // GET /api/users/:id/avatar - uploaded avatar bytes
  router.get(
    '/:id/avatar',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid user id.' });
      const [rows] = await pool.execute(SQL_GET_AVATAR, [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'No avatar.' });
      res.set({
        'Content-Type': rows[0].mime,
        // The URL carries ?v=<etag>, so a new upload gets a new URL: safe to cache hard
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      });
      return res.end(rows[0].data);
    })
  );

  // ---- Public profile ----------------------------------------------------
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid user id.' });

      const [users] = await pool.execute(SQL_PROFILE, [req.user.id, id]);
      if (users.length === 0) return res.status(404).json({ error: 'User not found.' });
      const u = users[0];

      const [polls] = await pool.execute(SQL_USER_POLLS, [id]);
      res.json({
        ...publicUserFromRow(u),
        createdAt: u.created_at,
        followersCount: Number(u.followers_count),
        followingCount: Number(u.following_count),
        isFollowing: Boolean(Number(u.is_following)),
        polls: polls.map((p) => ({
          id: p.id,
          question: p.question,
          createdAt: p.created_at,
          imageUrl: p.has_image ? `/api/polls/${p.id}/image` : null,
        })),
      });
    })
  );

  // ---- Follow graph ------------------------------------------------------
  // POST /api/users/:id/follow  (idempotent)
  router.post(
    '/:id/follow',
    writeLimiter,
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid user id.' });
      if (id === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself.' });

      const [exists] = await pool.execute(SQL_USER_EXISTS, [id]);
      if (exists.length === 0) return res.status(404).json({ error: 'User not found.' });

      await pool.execute(SQL_FOLLOW, [req.user.id, id]);
      const [[count]] = await pool.execute(SQL_FOLLOWER_COUNT, [id]);
      res.status(201).json({ following: true, followersCount: Number(count.n) });
    })
  );

  // DELETE /api/users/:id/follow  (idempotent)
  router.delete(
    '/:id/follow',
    writeLimiter,
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid user id.' });

      await pool.execute(SQL_UNFOLLOW, [req.user.id, id]);
      const [[count]] = await pool.execute(SQL_FOLLOWER_COUNT, [id]);
      res.json({ following: false, followersCount: Number(count.n) });
    })
  );

  // GET /api/users/:id/followers | /following  (?page=1)
  for (const direction of ['followers', 'following']) {
    router.get(
      `/:id/${direction}`,
      asyncHandler(async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid user id.' });
        const page = parsePage(req.query.page);
        if (!page) return res.status(400).json({ error: 'Invalid page.' });

        const [exists] = await pool.execute(SQL_USER_EXISTS, [id]);
        if (exists.length === 0) return res.status(404).json({ error: 'User not found.' });

        const [rows] = await pool.execute(followListSql(direction, page), [req.user.id, id]);
        const hasMore = rows.length > FOLLOW_PAGE_SIZE;
        res.json({
          user: { id: exists[0].id, username: exists[0].username },
          page,
          hasMore,
          users: (hasMore ? rows.slice(0, FOLLOW_PAGE_SIZE) : rows).map((r) => ({
            ...publicUserFromRow(r),
            isFollowing: Boolean(Number(r.is_following)),
          })),
        });
      })
    );
  }

  return router;
}

module.exports = { createUsersRouter, avatarUrlFor, FOLLOW_PAGE_SIZE };
