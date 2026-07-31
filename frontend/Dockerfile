# syntax=docker/dockerfile:1.7
FROM node:24-alpine

WORKDIR /opt/tebuireng/frontend

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci \
    && package_lock_hash="$(sha256sum package-lock.json | cut -d ' ' -f 1)" \
    && printf 'image-v1:%s\n' "$package_lock_hash" > node_modules/.tebuireng-package-lock.sha256 \
    && chown -R node:node /opt/tebuireng/frontend/node_modules

COPY docker/entrypoint.sh /usr/local/bin/tebuireng-frontend-entrypoint
RUN chmod +x /usr/local/bin/tebuireng-frontend-entrypoint \
    && mkdir -p /app/node_modules \
    && chown -R node:node /app

WORKDIR /app

USER node

ENTRYPOINT ["tebuireng-frontend-entrypoint"]
