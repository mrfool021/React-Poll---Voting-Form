'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createPollsRouter } = require('./routes/polls');
const { createAuthRouter } = require('./routes/auth');
const { createSearchRouter, createUsersRouter } = require('./routes/search');
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
    rateLimitMax = 300,
    jwtSecret = 'dev-only-jwt-secret', // server.js makes the real one mandatory
    jwtExpiresIn = '7d',
    bcryptCost = 12,
    authRateLimit = 10,
  } = config;

  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // exactly one hop: the Nginx proxy container

  app.use(helmet());

  // CORS allow-list. Unknown origins simply receive no CORS headers, so the
  // browser blocks the response. (In Docker everything is same-origin via the proxy.)
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || corsOrigins.includes(origin));
      },
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    })
  );

  app.use(express.json({ limit: '10kb' }));

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
  const requireAuth = createRequireAuth(jwtSecret);
  app.use('/api/polls', createPollsRouter(pool, { enforceOneVote, voterSalt, requireAuth }));
  app.use('/api/search', createSearchRouter(pool, { requireAuth }));
  app.use('/api/users', createUsersRouter(pool, { requireAuth }));

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large.' });
    }
    console.error('Unhandled error:', err);
    // Never leak internals (stack traces, SQL messages) to clients
    return res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

module.exports = { createApp };
