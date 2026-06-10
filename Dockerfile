FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable
RUN corepack prepare pnpm@10.25.0 --activate
ENV PNPM_CONFIG_FETCH_RETRIES=5
ENV PNPM_CONFIG_FETCH_TIMEOUT=600000
ENV PNPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000
ENV PNPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json prisma.config.ts ./
COPY apps ./apps
COPY libs ./libs
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --prod=false && pnpm db:generate

FROM base AS api
ENV NODE_ENV=development
EXPOSE 3001
CMD ["pnpm", "start:api"]

FROM base AS vendor-sandbox
ENV NODE_ENV=development
ENV VENDOR_SANDBOX_PORT=4202
EXPOSE 4202
CMD ["pnpm", "start:vendor"]

FROM base AS worker
RUN npx playwright install --with-deps chromium
ENV NODE_ENV=development
CMD ["pnpm", "start:worker"]

FROM base AS web-builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ENABLE_DEMO_MODE=false
ARG NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false
ARG NEXT_PUBLIC_ALLOW_LOCAL_API_URL=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ENABLE_DEMO_MODE=$NEXT_PUBLIC_ENABLE_DEMO_MODE
ENV NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=$NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK
ENV NEXT_PUBLIC_ALLOW_LOCAL_API_URL=$NEXT_PUBLIC_ALLOW_LOCAL_API_URL
RUN node -e "const u=process.env.NEXT_PUBLIC_API_URL; if (!u || !u.startsWith('https://')) { throw new Error('NEXT_PUBLIC_API_URL must be an HTTPS URL for production web builds.'); }"
RUN pnpm --filter my-v0-project build

FROM base AS web
COPY --from=web-builder /app/apps/web/.next ./apps/web/.next
ENV NODE_ENV=production
ENV NEXT_PUBLIC_ENABLE_DEMO_MODE=false
ENV NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false
ENV NEXT_PUBLIC_ALLOW_LOCAL_API_URL=false
EXPOSE 3000
CMD ["pnpm", "--filter", "my-v0-project", "start"]
