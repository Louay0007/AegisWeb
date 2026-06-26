FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json prisma.config.ts ./
COPY libs ./libs
COPY prisma ./prisma
COPY apps ./apps
RUN pnpm install --frozen-lockfile --prod=false && pnpm db:generate

FROM base AS builder
RUN pnpm build:api

FROM base AS runtime
RUN chown -R node:node /app
COPY --from=builder --chown=node:node /app/dist ./dist
ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["pnpm", "start:api:prod"]
