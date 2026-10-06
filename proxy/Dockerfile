# Nginx reverse proxy (runs as the unprivileged "nginx" user, listens on 8080)
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

# Goes through the proxy to the API, so it verifies the whole chain
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
