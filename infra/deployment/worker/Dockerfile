# Canonical Masanawa Rooms/AI-answer Worker, not the retired @nurain webhook proxy.
# Build context is the monorepo root, as for the Gateway Dockerfile.
FROM node:24-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@12.8.2 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json vitest.config.ts ./
COPY packages ./packages
COPY adapters ./adapters
COPY infra ./infra
COPY services ./services
COPY apps ./apps

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @masanawa/worker-service... build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001
CMD ["pnpm", "--filter", "@masanawa/worker-service", "start"]
