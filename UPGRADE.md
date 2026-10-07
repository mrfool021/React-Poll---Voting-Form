# PlayHub upgrade guide

Everything in this upgrade uses **only packages that were already in your lockfiles**
(no new npm dependencies). Images travel as base64 strings inside JSON.

## 1. What changed

| Feature | Backend | Frontend |
| --- | --- | --- |
| Dark / light theme | - | `ThemeContext.jsx`, `public/theme-init.js` (no flash), CSS tokens in `index.css` |
| Avatars | `routes/users.js`, `images.js`, `lib/users.js`, tables `user_avatars` + `users.avatar_url` | `Avatar.jsx`, `AvatarEditor.jsx`, `AuthImage.jsx`, shown in navbar / cards / comments / profile |
| Image polls | `POST /api/polls` accepts `image`; `GET /api/polls/:id/image`; table `poll_images` | `CreatePoll.jsx`, `PollCard.jsx`, `PollView.jsx`, `imageUtils.js` (client compression) |
| Comments | `routes/comments.js`, table `comments` (one-level replies) | `Comments.jsx` |
| Follow graph | follow / unfollow / lists in `routes/users.js`, table `follows`, `?scope=following` feed | `FollowButton.jsx`, `FollowList.jsx`, Following tab |
| UI overhaul | - | Tailwind tokens, mobile drawer nav, FAB, responsive grid, hash router |
| Deployment | `TRUST_PROXY_HOPS`, image limits | compose split, TLS proxy config, Nginx hardening |

## 2. Upgrade an existing install (keeps your data)

```bash
# 0. back up first
./db/backup.sh

# 1. pull the new code, then add the new variables from .env.example to your .env
#    (POLL_IMAGE_MAX_BYTES, AVATAR_MAX_BYTES, RATE_LIMIT_MAX, TRUST_PROXY_HOPS, HTTP_PORT, HTTPS_PORT)

# 2. apply the migrations (003-006). Tracks what is applied in schema_migrations.
./db/migrate.sh

# 3. rebuild and restart (the API image build runs the Jest suite as a quality gate)
docker compose up -d --build
```

Fresh install / disposable data: `docker compose down -v && docker compose up -d --build`
(`db/init.sql` already contains every table and marks all migrations as applied).

## 3. API reference (new / changed)

All routes need `Authorization: Bearer <token>`.

| Method | Route | Notes |
| --- | --- | --- |
| POST | `/api/polls` | `{ question, options[2-10], image? }` - `image` is a `data:image/(png\|jpeg\|webp\|gif);base64,...` string. 400 if the poll is invalid, nothing is stored. |
| GET | `/api/polls?scope=following` | Only polls from accounts you follow |
| GET | `/api/polls/:id/image` | Photo bytes (fetched with the token by the SPA) |
| GET | `/api/polls/:id/comments?before=<id>` | `{ total, comments[{..., replies[]}], nextCursor }`, 20 per page, newest first |
| POST | `/api/polls/:id/comments` | `{ body (1-500), parentId? }` |
| DELETE | `/api/polls/:id/comments/:commentId` | Author only |
| GET | `/api/users/:id` | + `avatarUrl`, `followersCount`, `followingCount`, `isFollowing` |
| PUT | `/api/users/me/avatar` | `{ image }` **or** `{ url: "https://..." }` |
| DELETE | `/api/users/me/avatar` | Back to the initial-letter placeholder |
| GET | `/api/users/:id/avatar` | Uploaded avatar bytes |
| POST / DELETE | `/api/users/:id/follow` | Idempotent. Following yourself -> 400 |
| GET | `/api/users/:id/followers` and `/following` | `?page=1`, 30 per page |

Every user object is `{ id, username, avatarUrl }`; `avatarUrl` is `null`, an external https URL,
or `/api/users/:id/avatar?v=<etag>` (the `v` changes on every upload, so caches never go stale).

### How "a photo can never be posted standalone" is enforced

1. **No image endpoint exists.** The photo is a field of `POST /api/polls`; the question and 2-10
   options are validated in the same request, and everything is written in **one transaction**.
2. **Database:** `poll_images.poll_id` is the primary key *and* a foreign key to `polls`
   (cascade delete) - an orphan photo cannot exist, and a poll has at most one.
3. **No update path:** there is no route to attach or swap a photo on an existing poll.

Covered by tests in `poll-api/src/tests/images.test.js`.

### Image safety

Only PNG / JPEG / WebP / GIF; the declared type must match the file's magic bytes (a renamed HTML
file is rejected); **SVG is refused** (script carrier). Size caps: poll photo 1.5 MB, avatar 256 KB
decoded. Larger request bodies are accepted only on the two image routes, and only **after** the
token is verified. Served images carry `nosniff` and `Content-Security-Policy: sandbox`.
The browser shrinks every image to JPEG (poll: max 1280 px, avatar: 256x256 crop) before upload.

## 4. Production deployment

```bash
cp .env.example .env     # fill in real secrets: openssl rand -hex 32
```
Set in `.env`: `HTTP_PORT=80`, `HTTPS_PORT=443`, `CORS_ORIGIN=https://your.domain`, strong secrets,
and `TRUST_PROXY_HOPS=2` if a cloud load balancer / CDN sits in front of the bundled proxy.

**HTTPS certificate** (host machine, DNS already pointing at the server):
```bash
sudo certbot certonly --standalone -d your.domain       # port 80 must be free for this step
mkdir -p certs
sudo cp /etc/letsencrypt/live/your.domain/fullchain.pem certs/
sudo cp /etc/letsencrypt/live/your.domain/privkey.pem  certs/
sudo chmod 640 certs/*.pem   # the nginx user must be able to read them
```
Edit `server_name` in `proxy/default.prod.conf`, then:
```bash
export COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
docker compose up -d --build
./db/migrate.sh          # only needed when upgrading an existing database
curl -I https://your.domain/health
```
After renewing certificates: copy the files again and `docker compose restart proxy`.

What the split compose files do: `docker-compose.yml` is production-safe (only the proxy publishes a
port; log rotation; memory limits). The DB port and phpMyAdmin moved to `docker-compose.override.yml`,
which is only auto-loaded in development (phpMyAdmin on `127.0.0.1:8081`). Production never loads it.

**Before going live:** your original `.env` contained weak sample secrets (`pollpassword`,
`saltpassword`, a readable JWT secret). Replace all of them. Changing `JWT_SECRET` logs everyone out.

**Backups:** `./db/backup.sh` (cron it). Images live inside the DB, so a DB backup covers them.

## 5. Responsive behaviour

| Screen | Layout |
| --- | --- |
| Phone (<640 px) | single-column feed, hamburger **drawer** (profile, search, theme, logout), floating "+" button, full-width buttons, 44 px tap targets, 16 px inputs (no iOS zoom), notch safe-areas |
| Tablet (640-1023 px) | 2-column poll grid, drawer navigation |
| Desktop (>=1024 px) | full navbar + inline search, 3-column grid (xl), poll page = poll on the left, live comments on the right |

## 6. Known limits (deliberate trade-offs)

- Images are stored in MySQL (simple, backed up with the DB). Past a few thousand large photos,
  move them to object storage - the `AuthImage`/URL design means only the API routes change.
- External avatar URLs need `img-src https:` in the CSP (already set in `frontend/nginx.conf`).
  Remove `https:` there if you want to allow uploaded avatars only.
- The poll feed is not paginated yet (the comment and follower lists are).
- Hash routing (`#/poll/3`) keeps Nginx simple; switch to the History API if you need clean URLs / SEO.
