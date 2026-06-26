FROM node:22-slim AS runtime
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json prisma.config.ts ./
COPY apps ./apps
COPY libs ./libs
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod=false && pnpm db:generate
RUN chown -R node:node /app
ENV NODE_ENV=development
ENV VENDOR_SANDBOX_PORT=4202
USER node
EXPOSE 4202
CMD ["pnpm", "start:vendor"]
