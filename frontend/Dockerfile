# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 - build: compile the Vite/React app
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# Build label shown in the footer (import.meta.env.VITE_BUILD_NUMBER).
# Vite inlines it at build time, so it must be a build ARG, not a runtime env var.
ARG VITE_BUILD_NUMBER=dev
ENV VITE_BUILD_NUMBER=$VITE_BUILD_NUMBER
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 - production: static files served by unprivileged Nginx (non-root)
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:stable-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
