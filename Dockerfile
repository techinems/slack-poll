# ── Build stage: compile TypeScript ──────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run compile

# ── Runtime stage: production deps + compiled output only ─────────────────────
FROM node:24-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# package.json is read at runtime (Sentry release version); it's already copied.
COPY --from=build /usr/src/app/out ./out

EXPOSE 3000

# Stateless service — safe to run as the image's built-in non-root user.
USER node

# PORT may be overridden at runtime (defaults to 3000); check whatever it is.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" >/dev/null 2>&1 || exit 1

CMD ["node", "out/server.js"]
