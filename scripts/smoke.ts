import 'dotenv/config';
import { checkPostgres, checkRedis, checkS3 } from '@agentpass/database';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://agentpass:agentpass@localhost:5432/agentpass';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

const dependencies = await Promise.all([
  checkPostgres(databaseUrl),
  checkRedis(redisUrl),
  checkS3({
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'local',
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'agentpass',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'agentpass-secret',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false'
  })
]);

for (const dependency of dependencies) {
  const latency = dependency.latencyMs === undefined ? '' : ` ${dependency.latencyMs}ms`;
  const message = dependency.message ? ` - ${dependency.message}` : '';
  console.log(`${dependency.name}: ${dependency.state}${latency}${message}`);
}

const failed = dependencies.filter((dependency) => dependency.state !== 'ok');

if (failed.length > 0) {
  process.exitCode = 1;
}
