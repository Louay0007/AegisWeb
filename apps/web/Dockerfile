FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY apps/web ./apps/web
COPY libs ./libs
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ENABLE_DEMO_MODE=false
ARG NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ENABLE_DEMO_MODE=$NEXT_PUBLIC_ENABLE_DEMO_MODE
ENV NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=$NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK
RUN pnpm --filter my-v0-project build

FROM node:22-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
RUN chown -R node:node /app
COPY --from=builder --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=node:node /app/apps/web ./apps/web
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "my-v0-project", "start"]
