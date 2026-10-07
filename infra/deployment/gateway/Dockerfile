FROM node:24-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv \
 && rm -rf /var/lib/apt/lists/*

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
RUN pnpm --filter @masanawa/gateway-service... build
RUN python3 -m venv /opt/masanawa-presence \
 && /opt/masanawa-presence/bin/pip install --no-cache-dir -r services/presence/requirements.txt

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["bash", "infra/deployment/gateway/start-with-presence.sh"]
