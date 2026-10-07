# PlayHub - Poll & Voting App

Full-stack final project for **Integrative Programming and Technologies** and **System Architecture and Integration**.

**First time here? Read [START_HERE.md](START_HERE.md): a step-by-step beginner guide (VS Code + Docker).**

**New in this version:** dark/light theme, avatars, image polls, comments, followers - see **[UPGRADE.md](UPGRADE.md)** for the migration, API and production-deployment guide.

**Stack:** React (Vite) + Tailwind CSS · Node.js/Express · MySQL 8.4 · Nginx · Docker Compose

## Quick start

Requirements: Docker Engine + Docker Compose v2.

```bash
cp .env.example .env          # then edit .env and replace every "change_me" value (openssl rand -hex 32)
docker compose up -d --build
```

Open **http://localhost:8080**.

| Check | Command |
| --- | --- |
| All services healthy | `docker compose ps` |
| API health via proxy | `curl http://localhost:8080/health` |
| List polls | `curl http://localhost:8080/api/polls` |
| Logs | `docker compose logs -f poll-api` |
| Stop | `docker compose down` |
| Stop and wipe the database | `docker compose down -v` |

> `init.sql` only runs on an **empty** database volume. After changing it, run `docker compose down -v` first.

## Architecture

```
 Browser ──► :8080 ┌─────────┐   /      ┌──────────┐
                   │  proxy  │ ───────► │ frontend │  (Nginx, static React build)
                   │ (Nginx) │          └──────────┘
                   │         │  /api/   ┌──────────┐      ┌──────────┐
                   │         │ ───────► │ poll-api │ ───► │    db    │  (MySQL 8.4)
                   └─────────┘          │ (Express)│      │  :3306   │  not published
                                        └──────────┘      └────┬─────┘
          all containers on bridge network "poll-net"          │
                                                       volume: poll-db-data
```

Only the proxy publishes a host port (8080). MySQL is reachable solely from inside `poll-net`
(in development, `docker-compose.override.yml` additionally adds phpMyAdmin at http://localhost:8081, reachable from your computer only).

Startup order is enforced with health checks: `db` (healthy) → `poll-api` (healthy) → `proxy`; `frontend` (healthy) → `proxy`.

## REST API

| Method | Route | Description |
| --- | --- | --- |
| GET | `/health` | Liveness probe, returns `200 {"status":"ok"}` |
| GET | `/api/polls` | Active polls with per-option vote counts 🔒 |
| GET | `/api/polls/:id` | One poll 🔒 |
| POST | `/api/polls` | Create a poll — body `{ "question": "...", "options": ["A", "B"], "image": "data:image/jpeg;base64,..." }` (2–10 options, `image` optional but never standalone) 🔒 |
| POST | `/api/polls/:id/vote` | Vote — body `{ "optionId": 3 }` (409 if this account already voted) 🔒 |
| GET | `/api/search?q=text` | Search poll questions and usernames (2–50 characters) 🔒 |
| GET | `/api/users/:id` | Public profile: avatar, join date, follower counts, polls created 🔒 |
| PUT/DELETE | `/api/users/me/avatar` | Set avatar (`{image}` base64 or `{url}` https) / remove it 🔒 |
| POST/DELETE | `/api/users/:id/follow` | Follow / unfollow 🔒 |
| GET | `/api/users/:id/followers`, `/following` | Paginated lists 🔒 |
| GET/POST | `/api/polls/:id/comments` | Read / write comments, `parentId` for replies 🔒 |
| DELETE | `/api/polls/:id/comments/:commentId` | Delete your own comment 🔒 |
| GET | `/api/polls/:id/image` | Photo attached to a poll 🔒 |
| POST | `/api/auth/register` | Sign up — body `{ "username", "email", "password" }` → `201 { token, user }` (409 if taken) |
| POST | `/api/auth/login` | Log in — body `{ "identifier", "password" }` (username or email) → `{ token, user }` |
| GET | `/api/auth/me` | The logged-in user 🔒 |

🔒 = needs the header `Authorization: Bearer <token>`. Everything except `/health` and sign up / log in requires it, so users must log in first. Voting is limited to one vote per account per poll.

### Authentication setup

Add to your `.env` (the API refuses to start without it):

```bash
JWT_SECRET=<at least 32 random characters>   # e.g. openssl rand -hex 32
JWT_EXPIRES_IN=7d                            # optional, default 7d
```

**Existing database?** `init.sql` only runs on an empty volume. Apply new schema changes with the tracked migration runner (safe to run repeatedly, backs nothing up by itself - run `./db/backup.sh` first):

```bash
./db/migrate.sh
```

(Or, if the data is disposable: `docker compose down -v` and start fresh.)

## Tests (Jest + Supertest)

The tests use a mocked database pool, so no MySQL is needed.

```bash
cd poll-api && npm install && npm test
```

In Docker, the same tests run in the `test` stage of `poll-api/Dockerfile`. The production stage depends on that stage, so **a failing test fails the image build** (CI/CD quality gate). To see it fail, break an assertion in `src/tests/poll.test.js` and run `docker compose build poll-api`.

## Showing a CI/CD deployment (build label)

The footer shows `import.meta.env.VITE_BUILD_NUMBER`. It is baked in at build time from `BUILD_NUMBER`:

```bash
BUILD_NUMBER=42 docker compose up -d --build frontend
```

In a pipeline, set it to the run number (e.g. `$GITHUB_RUN_NUMBER`) and the footer proves which build is live.

## Local development (without Docker for the app)

```bash
# terminal 1 - database only (temporarily publish 3306 with a compose override if you need it)
# terminal 2
cd poll-api && npm install
DB_HOST=127.0.0.1 DB_USER=poll_user DB_PASSWORD=... DB_NAME=pollsdb VOTER_SALT=dev npm start
# terminal 3
cd frontend && npm install && npm run dev      # http://localhost:5173 (proxies /api to :3000)
```

## Security measures

| Area | Measure |
| --- | --- |
| SQL injection | Parameterized queries only; IDs validated as positive integers; constant SQL strings |
| XSS | Tags/control characters stripped on input; React escapes output; strict CSP header on the frontend |
| Input validation | Length limits, option count/uniqueness, 10 kb body limit (larger only on the 2 image routes, and only after the token is verified) |
| Uploads | Allow-list PNG/JPEG/WebP/GIF, magic-byte check, no SVG, size caps, served with `nosniff` + sandbox CSP |
| CORS | Explicit origin allow-list (`CORS_ORIGIN`), GET/POST/PUT/DELETE |
| HTTP hardening | Helmet headers, `x-powered-by` disabled, `server_tokens off` |
| Abuse control | Rate limiting (global + stricter on voting), one vote per voter per poll |
| Privacy | Voters are stored as a salted SHA-256 hash, never as a raw IP address |
| Error handling | Generic 500 responses; no stack traces or SQL errors reach clients |
| Containers | API runs as `USER node`; Nginx images are unprivileged; `cap_drop: ALL`; `no-new-privileges` |
| Secrets | Only `.env.example` is committed; compose refuses to start if required secrets are unset |
| Network | DB not published to the host; single bridge network; one public entry point |
| Data integrity | Foreign keys with cascades; composite FK guarantees a vote's option belongs to its poll |

## Project layout

```
poll-app/
├── docker-compose.yml
├── .env.example, UPGRADE.md
├── docker-compose.override.yml (dev extras) · docker-compose.prod.yml (HTTPS)
├── db/init.sql, db/migrations/, db/migrate.sh, db/backup.sh
├── poll-api/        Dockerfile (base → test → production), src/, src/tests/poll.test.js
├── frontend/        Dockerfile (build → nginx), src/AuthContext.jsx, src/components/{AuthForm,PollList,CreatePoll,PollView,SearchView,ProfileView,ResultsBar}.jsx
└── proxy/           Dockerfile, default.conf
```
