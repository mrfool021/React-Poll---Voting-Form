# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 - base: install ALL dependencies (dev + prod) and copy the source
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
# Uses the lockfile when present (reproducible), falls back to install otherwise
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY src ./src

# ---------------------------------------------------------------------------
# Stage 2 - test: CI/CD quality gate. If any Jest test fails, `docker build`
# fails here and no production image is produced.
# ---------------------------------------------------------------------------
FROM base AS test
ENV NODE_ENV=test
RUN npm test

# ---------------------------------------------------------------------------
# Stage 3 - production: slim Alpine, prod-only dependencies, non-root user
# ---------------------------------------------------------------------------
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
 && npm cache clean --force

# This COPY makes `production` depend on the `test` stage, so BuildKit can never
# skip the tests when building the production target.
COPY --from=test /app/package.json /tmp/.tests-passed

COPY src ./src
RUN rm -rf src/tests && chown -R node:node /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server.js"]
