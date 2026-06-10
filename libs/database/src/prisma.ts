import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export function createPrismaClient(databaseUrl = defaultDatabaseUrl()): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export function defaultDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? 'postgresql://agentpass:agentpass@localhost:5432/agentpass';
}
