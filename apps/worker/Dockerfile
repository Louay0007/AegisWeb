FROM node:22-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json prisma.config.ts ./
COPY apps ./apps
COPY libs ./libs
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod=false && pnpm db:generate && npx playwright install --with-deps chromium
ENV NODE_ENV=development
CMD ["pnpm", "start:worker"]
