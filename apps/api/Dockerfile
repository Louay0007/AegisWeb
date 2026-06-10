FROM node:22-slim AS runtime
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json prisma.config.ts ./
COPY libs ./libs
COPY prisma ./prisma
COPY apps ./apps
RUN pnpm install --frozen-lockfile --prod=false && pnpm db:generate
ENV NODE_ENV=development
EXPOSE 3001
CMD ["pnpm", "start:api"]
