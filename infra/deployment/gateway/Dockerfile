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

RUN pnpm install --lockfile-only --no-frozen-lockfile \
 && echo "MASANAWA_LOCKFILE_ROOT_BEGIN" \
 && sed -n '1,90p' pnpm-lock.yaml \
 && echo "MASANAWA_LOCKFILE_ROOT_END" \
 && exit 1
RUN pnpm --filter @masanawa/gateway-service... build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "--filter", "@masanawa/gateway-service", "start"]
