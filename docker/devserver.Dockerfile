# syntax=docker/dockerfile:1
#
# Single-image build for the Arcade2D dev server: the React frontend is built to
# static assets and served by the NestJS backend, so the whole product runs as
# one Node process on one port.
#
# Build from the repo root:
#   docker build -f docker/devserver.Dockerfile -t arcade2d-devserver .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- Prune: isolate just what devserver-backend needs ----------------------
FROM base AS pruner
RUN npm i -g turbo@^2
COPY . .
RUN turbo prune @arcade2d/devserver-backend --docker

# ---- Install: deps only, for cacheable layers -----------------------------
FROM base AS installer
COPY .yarnrc.yml ./
COPY .yarn ./.yarn
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/yarn.lock ./yarn.lock
RUN yarn install --immutable

# ---- Build: engine deps -> frontend -> backend (Turbo ^build order) -------
COPY --from=pruner /app/out/full/ ./
COPY turbo.json ./turbo.json
RUN yarn turbo build --filter=@arcade2d/devserver-backend

# ---- Runner: slim, non-root ----------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000
ENV ARCADE2D_FRONTEND_DIST=/app/apps/devserver/frontend/dist

RUN addgroup -S app && adduser -S app -G app
COPY --from=installer --chown=app:app /app ./
USER app

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/devserver/backend/dist/main.js"]
