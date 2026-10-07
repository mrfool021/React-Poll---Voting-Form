'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createPollsRouter } = require('./routes/polls');
const { createAuthRouter } = require('./routes/auth');
const { createSearchRouter } = require('./routes/search');
const { createUsersRouter } = require('./routes/users');
const { createCommentsRouter } = require('./routes/comments');
const { DEFAULT_LIMITS } = require('./images');
const { createRequireAuth } = require('./middleware/auth');

/**
 * App factory. The database pool is injected so tests can pass a mock and
 * run without a real MySQL server (this is what makes the Docker "test"
 * stage usable as a CI/CD quality gate).
 */
function createApp(pool, config = {}) {
  const {
    corsOrigins = ['http://localhost:8080', 'http://localhost:5173'],
    enforceOneVote = true,
    voterSalt = 'dev-only-salt',
    rateLimitMax = 600, // avatars/photos are separate requests, so allow more than a text-only API
    pollImageMaxBytes = DEFAULT_LIMITS.pollImageMaxBytes,
    avatarMaxBytes = DEFAULT_LIMITS.avatarMaxBytes,
    jwtSecret = 'dev-only-jwt-secret', // server.js makes the real one mandatory
    jwtExpiresIn = '7d',
    bcryptCost = 12,
    authRateLimit = 10,
    trustProxyHops = 1, // Nginx proxy = 1; add 1 for each extra load balancer / CDN in front
  } = config;

  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxyHops);

  app.use(helmet());

  // CORS allow-list. Unknown origins simply receive no CORS headers, so the
  // browser blocks the response. (In Docker everything is same-origin via the proxy.)
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || corsOrigins.includes(origin));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    })
  );

  const requireAuth = createRequireAuth(jwtSecret);

  // Body size: 10 kB everywhere, except the two routes that carry a base64 image
  // (create poll, set avatar). Those get a larger limit - but only AFTER the
  // bearer token is verified, so anonymous clients can never make the server
  // buffer megabytes.
  const smallJson = express.json({ limit: '10kb' });
  const imageBodyLimit =
    Math.ceil((Math.max(pollImageMaxBytes, avatarMaxBytes) * 4) / 3) + 16 * 1024;
  const imageJson = express.json({ limit: imageBodyLimit });
  const isImageRoute = (req) => {
    const path = req.path.replace(/\/+$/, '');
    return (
      (req.method === 'POST' && path === '/api/polls') ||
      (req.method === 'PUT' && path === '/api/users/me/avatar')
    );
  };
  app.use((req, res, next) => {
    if (!isImageRoute(req)) return smallJson(req, res, next);
    return requireAuth(req, res, (err) => (err ? next(err) : imageJson(req, res, next)));
  });

  // Liveness probe for Docker / load balancers / uptime monitors
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later.' },
    })
  );

  app.use(
    '/api/auth',
    createAuthRouter(pool, { jwtSecret, jwtExpiresIn, bcryptCost, authRateLimit })
  );

  // Everything below needs a valid login token
  app.use('/api/polls/:id/comments', createCommentsRouter(pool, { requireAuth }));
  app.use(
    '/api/polls',
    createPollsRouter(pool, { enforceOneVote, voterSalt, requireAuth, pollImageMaxBytes })
  );
  app.use('/api/search', createSearchRouter(pool, { requireAuth }));
  app.use('/api/users', createUsersRouter(pool, { requireAuth, avatarMaxBytes }));

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large (images must be compressed).' });
    }
    console.error('Unhandled error:', err);
    // Never leak internals (stack traces, SQL messages) to clients
    return res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

module.exports = { createApp };
