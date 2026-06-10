import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx libs/database/src/seed.ts'
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://agentpass:agentpass@localhost:5432/agentpass'
  }
});
