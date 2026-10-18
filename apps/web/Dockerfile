# Contexte de build : racine du monorepo (docker build -f apps/web/Dockerfile .)
FROM node:22.22.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/markdown/package.json packages/markdown/
COPY packages/tokens/package.json packages/tokens/
COPY packages/pb-types/package.json packages/pb-types/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter web...
COPY apps/web apps/web
COPY packages packages
RUN pnpm --filter web build
RUN pnpm --filter web deploy --legacy --prod /out && cp -r apps/web/dist /out/dist

FROM node:22.22.0-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
# curl : requis par le healthcheck de Coolify
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /out /app
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD curl -fsS http://127.0.0.1:4321/healthz || exit 1
CMD ["node", "dist/server/entry.mjs"]
