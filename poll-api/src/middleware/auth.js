'use strict';

const jwt = require('jsonwebtoken');

const ALGORITHM = 'HS256';

/** Signs a short-lived access token. `sub` carries the user id. */
function signToken(user, { jwtSecret, jwtExpiresIn }) {
  return jwt.sign({ username: user.username }, jwtSecret, {
    algorithm: ALGORITHM,
    subject: String(user.id),
    expiresIn: jwtExpiresIn,
  });
}

/**
 * Express middleware factory. Expects `Authorization: Bearer <token>`.
 * On success it sets `req.user = { id, username }`; otherwise it answers 401.
 * The algorithm is pinned so a forged "alg: none" token is always rejected.
 */
function createRequireAuth(jwtSecret) {
  return function requireAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
      const payload = jwt.verify(match[1], jwtSecret, { algorithms: [ALGORITHM] });
      const id = Number(payload.sub);
      if (!Number.isInteger(id) || id < 1) throw new Error('bad subject');
      req.user = { id, username: payload.username };
      return next();
    } catch (_) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  };
}

module.exports = { signToken, createRequireAuth };
