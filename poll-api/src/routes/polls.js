'use strict';

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { validateNewPoll, parseId } = require('../validation');

// ---------------------------------------------------------------------------
// SQL - all statements are constant strings; user input only ever travels in
// the parameter array (prepared statements), never inside the SQL text.
// ---------------------------------------------------------------------------
const SELECT_POLLS = `
  SELECT p.id, p.question, p.is_active, p.created_at, p.created_by,
         u.username AS creator,
         o.id AS option_id, o.label, COUNT(v.id) AS votes
  FROM polls p
  JOIN options o ON o.poll_id = p.id
  LEFT JOIN votes v ON v.option_id = o.id
  LEFT JOIN users u ON u.id = p.created_by
`;
const GROUP_ORDER = `
  GROUP BY p.id, p.question, p.is_active, p.created_at, p.created_by, u.username, o.id, o.label
  ORDER BY p.created_at DESC, p.id DESC, o.id ASC
`;

const SQL_LIST_ACTIVE = `${SELECT_POLLS} WHERE p.is_active = 1 ${GROUP_ORDER}`;
const SQL_BY_ID = `${SELECT_POLLS} WHERE p.id = ? ${GROUP_ORDER}`;
const SQL_ACTIVE_CHECK = 'SELECT id FROM polls WHERE id = ? AND is_active = 1';
const SQL_INSERT_POLL = 'INSERT INTO polls (question, created_by) VALUES (?, ?)';
const SQL_INSERT_OPTION = 'INSERT INTO options (poll_id, label) VALUES (?, ?)';
const SQL_INSERT_VOTE =
  'INSERT INTO votes (poll_id, option_id, voter_hash) VALUES (?, ?, ?)';

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Turns flat JOIN rows into [{ id, question, options: [{ id, label, votes }] }] */
function rowsToPolls(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        question: row.question,
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
        creator: row.creator ? { id: row.created_by, username: row.creator } : null,
        totalVotes: 0,
        options: [],
      });
    }
    const poll = byId.get(row.id);
    const votes = Number(row.votes);
    poll.options.push({ id: row.option_id, label: row.label, votes });
    poll.totalVotes += votes;
  }
  return [...byId.values()];
}

function createPollsRouter(pool, { enforceOneVote, voterSalt, requireAuth }) {
  const router = express.Router();

  // Everything under /api/polls needs a logged-in user (login comes first)
  router.use(requireAuth);

  const voteLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many votes from this address, please slow down.' },
  });

  async function fetchPollById(id) {
    const [rows] = await pool.execute(SQL_BY_ID, [id]);
    return rowsToPolls(rows)[0] || null;
  }

  // One vote per ACCOUNT per poll. The hash is derived from the user id (not
  // the IP), so switching networks or browsers cannot grant a second vote and
  // people behind a shared IP are not blocked. It reuses the existing
  // UNIQUE (poll_id, voter_hash) index, so no schema change is needed.
  function voterHash(req, pollId) {
    if (!enforceOneVote) return null; // NULLs never collide in the UNIQUE index
    return crypto
      .createHash('sha256')
      .update(`${voterSalt}|${pollId}|user:${req.user.id}`)
      .digest('hex');
  }

  // GET /api/polls - active polls with per-option vote counts
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const [rows] = await pool.execute(SQL_LIST_ACTIVE);
      res.json(rowsToPolls(rows));
    })
  );

  // GET /api/polls/:id - a single poll
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid poll id.' });

      const poll = await fetchPollById(id);
      if (!poll) return res.status(404).json({ error: 'Poll not found.' });
      res.json(poll);
    })
  );

  // POST /api/polls - create a poll with its options (single transaction)
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const result = validateNewPoll(req.body);
      if (!result.ok) {
        return res.status(400).json({ error: 'Validation failed.', details: result.errors });
      }
      const { question, options } = result.value;

      const conn = await pool.getConnection();
      let pollId;
      try {
        await conn.beginTransaction();
        const [inserted] = await conn.execute(SQL_INSERT_POLL, [question, req.user.id]);
        pollId = inserted.insertId;
        for (const label of options) {
          await conn.execute(SQL_INSERT_OPTION, [pollId, label]);
        }
        await conn.commit();
      } catch (err) {
        try {
          await conn.rollback();
        } catch (_) {
          /* connection already broken - nothing more to do */
        }
        throw err;
      } finally {
        conn.release();
      }

      const poll = await fetchPollById(pollId);
      res.status(201).location(`/api/polls/${pollId}`).json(poll);
    })
  );

  // POST /api/polls/:id/vote - body: { optionId }
  router.post(
    '/:id/vote',
    voteLimiter,
    asyncHandler(async (req, res) => {
      const pollId = parseId(req.params.id);
      const optionId = parseId(req.body && req.body.optionId);
      if (!pollId) return res.status(400).json({ error: 'Invalid poll id.' });
      if (!optionId) return res.status(400).json({ error: 'optionId must be a positive integer.' });

      const [active] = await pool.execute(SQL_ACTIVE_CHECK, [pollId]);
      if (active.length === 0) {
        return res.status(404).json({ error: 'Poll not found or no longer active.' });
      }

      try {
        await pool.execute(SQL_INSERT_VOTE, [pollId, optionId, voterHash(req, pollId)]);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'You have already voted in this poll.' });
        }
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
          return res.status(400).json({ error: 'That option does not belong to this poll.' });
        }
        throw err;
      }

      const poll = await fetchPollById(pollId);
      res.status(201).json(poll);
    })
  );

  return router;
}

module.exports = { createPollsRouter, rowsToPolls };
