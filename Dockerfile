FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
RUN corepack prepare pnpm@10.25.0 --activate
ENV PNPM_CONFIG_FETCH_RETRIES=5
ENV PNPM_CONFIG_FETCH_TIMEOUT=600000
ENV PNPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000
ENV PNPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json prisma.config.ts ./
COPY --chown=node:node apps ./apps
COPY --chown=node:node libs ./libs
COPY --chown=node:node prisma ./prisma
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --prod=false && pnpm db:generate
# Runtime processes run as `node` and may need to write temp files under WORKDIR.
RUN chown -R node:node /app

FROM base AS api-builder
RUN pnpm build:api

FROM base AS api
COPY --chown=node:node --from=api-builder /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 3001
USER node
CMD ["pnpm", "start:api:prod"]

FROM base AS vendor-sandbox
ENV NODE_ENV=development
ENV VENDOR_SANDBOX_PORT=4202
EXPOSE 4202
USER node
CMD ["pnpm", "start:vendor"]

FROM base AS worker-builder
RUN pnpm build:worker

FROM base AS worker
# Install browser deps as root, then browsers into the runtime user's cache.
RUN npx playwright install-deps chromium
USER node
ENV PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright
RUN npx playwright install chromium
COPY --chown=node:node --from=worker-builder /app/dist ./dist
ENV NODE_ENV=production
CMD ["pnpm", "start:worker:prod"]

FROM base AS web-builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ENABLE_DEMO_MODE=false
ARG NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false
ARG NEXT_PUBLIC_ALLOW_LOCAL_API_URL=false
ARG ALLOW_HTTP_PUBLIC_API_URL=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ENABLE_DEMO_MODE=$NEXT_PUBLIC_ENABLE_DEMO_MODE
ENV NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=$NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK
ENV NEXT_PUBLIC_ALLOW_LOCAL_API_URL=$NEXT_PUBLIC_ALLOW_LOCAL_API_URL
RUN node -e "const u=process.env.NEXT_PUBLIC_API_URL; const allowHttp=process.env.ALLOW_HTTP_PUBLIC_API_URL==='true'; if (!u || (!u.startsWith('https://') && !(allowHttp && u.startsWith('http://')))) { throw new Error('NEXT_PUBLIC_API_URL must be an HTTPS URL for production web builds (or http:// with ALLOW_HTTP_PUBLIC_API_URL=true for IP demos).'); }"
RUN pnpm --filter my-v0-project build

FROM base AS web
COPY --chown=node:node --from=web-builder /app/apps/web/.next ./apps/web/.next
ENV NODE_ENV=production
ENV NEXT_PUBLIC_ENABLE_DEMO_MODE=false
ENV NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false
ENV NEXT_PUBLIC_ALLOW_LOCAL_API_URL=false
EXPOSE 3000
USER node
CMD ["pnpm", "--filter", "my-v0-project", "start"]
