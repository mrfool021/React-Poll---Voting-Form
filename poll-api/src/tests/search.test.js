'use strict';

const request = require('supertest');
const { createApp } = require('../app');
const { signToken } = require('../middleware/auth');
const { likePattern } = require('../routes/search');

const JWT_SECRET = 'test-jwt-secret-test-jwt-secret-1234';
const AUTH = `Bearer ${signToken(
  { id: 1, username: 'tester' },
  { jwtSecret: JWT_SECRET, jwtExpiresIn: '1h' }
)}`;

let pool;
let app;

beforeEach(() => {
  pool = { execute: jest.fn(), getConnection: jest.fn() };
  app = createApp(pool, { jwtSecret: JWT_SECRET });
});

const get = (url) => request(app).get(url).set('Authorization', AUTH);

// ---------------------------------------------------------------------------
describe('GET /api/search', () => {
  it('returns matching polls and public profiles', async () => {
    pool.execute
      .mockResolvedValueOnce([
        [{ id: 4, question: 'Best game ever?', created_at: 'd1', created_by: 2, creator: 'ivan' }],
      ])
      .mockResolvedValueOnce([[{ id: 2, username: 'ivan', created_at: 'd2' }]]);

    const res = await get('/api/search?q=iv');

    expect(res.status).toBe(200);
    expect(res.body.polls).toEqual([
      { id: 4, question: 'Best game ever?', createdAt: 'd1', creator: { id: 2, username: 'ivan' } },
    ]);
    expect(res.body.users).toEqual([{ id: 2, username: 'ivan', createdAt: 'd2' }]);
  });

  it('never exposes email or password hash', async () => {
    pool.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 2, username: 'ivan', created_at: 'd', email: 'x@y.z', password_hash: 'h' }]]);
    const res = await get('/api/search?q=ivan');
    expect(JSON.stringify(res.body)).not.toMatch(/email|password|x@y\.z/);
  });

  it('passes the text only as a bound parameter, with wildcards escaped', async () => {
    pool.execute.mockResolvedValue([[]]);
    await get(`/api/search?q=${encodeURIComponent("100%_'; DROP TABLE users;--")}`);

    for (const [sql, params] of pool.execute.mock.calls) {
      expect(sql).not.toMatch(/DROP/i);
      expect(params).toHaveLength(1);
      expect(params[0]).toMatch(/^%100\\%\\_/); // % and _ are escaped
    }
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/search?q=ivan');
    expect(res.status).toBe(401);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', '/api/search'],
    ['too short', '/api/search?q=a'],
    ['too long', `/api/search?q=${'x'.repeat(51)}`],
    ['array value', '/api/search?q[]=ab&q[]=cd'],
    ['object value', '/api/search?q[$ne]=ab'],
  ])('rejects a %s query with 400 before touching the database', async (_n, url) => {
    const res = await get(url);
    expect(res.status).toBe(400);
    expect(pool.execute).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('GET /api/users/:id', () => {
  it('returns the profile and the polls that user created', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 2, username: 'ivan', created_at: 'joined' }]])
      .mockResolvedValueOnce([[{ id: 9, question: 'Best editor?', created_at: 'c' }]]);

    const res = await get('/api/users/2');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 2,
      username: 'ivan',
      createdAt: 'joined',
      polls: [{ id: 9, question: 'Best editor?', createdAt: 'c' }],
    });
    expect(pool.execute.mock.calls[0][1]).toEqual([2]);
    expect(pool.execute.mock.calls[1][1]).toEqual([2]);
  });

  it('returns 404 for an unknown user', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    const res = await get('/api/users/999');
    expect(res.status).toBe(404);
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999'])('rejects invalid id "%s" with 400', async (bad) => {
    const res = await get(`/api/users/${bad}`);
    expect(res.status).toBe(400);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users/2');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe('likePattern', () => {
  it('escapes LIKE wildcards and wraps the text', () => {
    expect(likePattern('a%b_c\\d')).toBe('%a\\%b\\_c\\\\d%');
    expect(likePattern('plain')).toBe('%plain%');
  });
});
