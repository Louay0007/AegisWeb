#!/usr/bin/env tsx
/**
 * Helpers for the production-like Docker stack.
 *
 *   pnpm prodtest:env     regenerate .env.prodtest (keeps existing Stripe keys when present)
 *   pnpm prodtest:hosts   print / suggest /etc/hosts entries
 *   pnpm prodtest:up      build + start the stack
 *   pnpm prodtest:down    stop the stack
 *   pnpm prodtest:logs    follow logs
 *   pnpm prodtest:status  health summary
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const envPath = resolve(root, '.env.prodtest');
const composeFile = resolve(root, 'infra/docker-compose.prodtest.yml');
const hostsBlock =
  '127.0.0.1 app.aegisweb.local api.aegisweb.local sandbox.aegisweb.local mail.aegisweb.local minio.aegisweb.local grafana.aegisweb.local';

function tokenUrlSafe(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

function tokenBase64(bytes: number): string {
  return randomBytes(bytes).toString('base64');
}

const command = process.argv[2] ?? 'help';

async function main() {
  switch (command) {
    case 'env':
      writeEnv();
      break;
    case 'hosts':
      await ensureHosts();
      break;
    case 'up':
      if (!existsSync(envPath)) writeEnv();
      await ensureHosts();
      await runCompose(['up', '-d', '--build']);
      console.log('\nStack starting. When healthy:');
      console.log('  Web:      https://app.aegisweb.local');
      console.log('  API:      https://api.aegisweb.local/health/ready');
      console.log('  Sandbox:  https://sandbox.aegisweb.local');
      console.log('  Mailpit:  https://mail.aegisweb.local');
      console.log('  Grafana:  https://grafana.aegisweb.local');
      console.log('\nLogin: founder@northstarlabs.dev / Password123!');
      console.log('Guide: docs/PRODTEST_WORKFLOW.md');
      break;
    case 'down':
      await runCompose(['down']);
      break;
    case 'logs':
      await runCompose(['logs', '-f', ...process.argv.slice(3)]);
      break;
    case 'status':
      await status();
      break;
    case 'seed':
      await runCompose(['run', '--rm', 'migrate']);
      break;
    default:
      console.log('Usage: tsx scripts/prodtest.ts <env|hosts|up|down|logs|status|seed>');
  }
}

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}

function pickSecret(existing: string | undefined, generator: () => string, rejectLocal = true): string {
  if (!existing) return generator();
  if (rejectLocal && existing.startsWith('local-')) return generator();
  if (existing.length < 32) return generator();
  return existing;
}

function writeEnv() {
  const existing = { ...readEnvFile(resolve(root, '.env')), ...readEnvFile(envPath) };
  const pgPass = existing.POSTGRES_PASSWORD || tokenUrlSafe(24);
  const redisPass = existing.REDIS_PASSWORD || tokenUrlSafe(24);
  const minioPass = existing.MINIO_ROOT_PASSWORD || tokenUrlSafe(24);
  const vault = existing.VAULT_MASTER_KEY || tokenBase64(32);
  const whsec = existing.STRIPE_WEBHOOK_SECRET || `whsec_${tokenBase64(32)}`;

  const content = `# AegisWeb production-like local stack
# DO NOT commit. Used by infra/docker-compose.prodtest.yml

COMPOSE_PROJECT_NAME=aegisweb-prodtest
NODE_ENV=production

APP_HOST=app.aegisweb.local
API_HOST=api.aegisweb.local
SANDBOX_HOST=sandbox.aegisweb.local

DASHBOARD_BASE_URL=https://app.aegisweb.local
NEXT_PUBLIC_API_URL=https://api.aegisweb.local
API_PORT=3001
API_BASE_URL=http://api:3001
API_ALLOWED_ORIGINS=https://app.aegisweb.local
VENDOR_SANDBOX_URL=http://vendor-sandbox:4202
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false
NEXT_PUBLIC_ALLOW_LOCAL_API_URL=false

POSTGRES_DB=aegisweb
POSTGRES_USER=aegisweb
POSTGRES_PASSWORD=${pgPass}
DATABASE_URL=postgresql://aegisweb:${pgPass}@postgres:5432/aegisweb
REDIS_PASSWORD=${redisPass}
REDIS_URL=redis://:${redisPass}@redis:6379
MINIO_ROOT_USER=aegisweb
MINIO_ROOT_PASSWORD=${minioPass}
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=aegisweb-prodtest
S3_ACCESS_KEY=aegisweb
S3_SECRET_KEY=${minioPass}
S3_FORCE_PATH_STYLE=true

JWT_ACCESS_SECRET=${pickSecret(existing.JWT_ACCESS_SECRET, () => tokenUrlSafe(48))}
JWT_REFRESH_SECRET=${pickSecret(existing.JWT_REFRESH_SECRET, () => tokenUrlSafe(48))}
BFF_SESSION_SECRET=${pickSecret(existing.BFF_SESSION_SECRET, () => tokenUrlSafe(48))}
WORKER_INTERNAL_TOKEN=${pickSecret(existing.WORKER_INTERNAL_TOKEN, () => tokenUrlSafe(48))}
VAULT_MASTER_KEY=${vault}

MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_FROM="AegisWeb Prodtest <noreply@aegisweb.local>"
MAIL_SECURE=false
MAIL_REQUIRE_TLS=false

MFA_REQUIRED_ROLES=OWNER,ADMIN,APPROVER
ENABLE_OPENAPI=false
ALLOW_LOCAL_PRODUCTION_DEPENDENCIES=true
ALLOW_UNCONFIGURED_BILLING=false
LOG_LEVEL=info
API_TRUSTED_PROXIES=caddy
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_DEFAULT_MAX=1000
RATE_LIMIT_AUTH_MAX=30
RATE_LIMIT_INTERNAL_MAX=500
RATE_LIMIT_FILE_MAX=50

STRIPE_SECRET_KEY=${existing.STRIPE_SECRET_KEY ?? ''}
STRIPE_WEBHOOK_SECRET=${whsec}
STRIPE_STARTER_PRICE_ID=${existing.STRIPE_STARTER_PRICE_ID ?? ''}
STRIPE_BUSINESS_PRICE_ID=${existing.STRIPE_BUSINESS_PRICE_ID ?? ''}
STRIPE_SUCCESS_URL=https://app.aegisweb.local/app/settings?billing=success
STRIPE_CANCEL_URL=https://app.aegisweb.local/app/settings?billing=cancelled

GRAFANA_ADMIN_USER=${existing.GRAFANA_ADMIN_USER ?? 'admin'}
GRAFANA_ADMIN_PASSWORD=${existing.GRAFANA_ADMIN_PASSWORD && existing.GRAFANA_ADMIN_PASSWORD.length >= 8 ? existing.GRAFANA_ADMIN_PASSWORD : tokenUrlSafe(16)}
DEMO_PASSWORD=Password123!
`;

  writeFileSync(envPath, content, { mode: 0o600 });
  console.log(`Wrote ${envPath}`);
}

async function ensureHosts() {
  const hostsPath = '/etc/hosts';
  const hosts = readFileSync(hostsPath, 'utf8');
  const needed = [
    'app.aegisweb.local',
    'api.aegisweb.local',
    'sandbox.aegisweb.local',
    'mail.aegisweb.local',
    'minio.aegisweb.local',
    'grafana.aegisweb.local'
  ];
  const missing = needed.filter((h) => !hosts.includes(h));
  if (missing.length === 0) {
    console.log('Hosts entries already present.');
    return;
  }

  console.log('Missing /etc/hosts entries for:', missing.join(', '));
  console.log('\nAdd this line (requires sudo):\n');
  console.log(hostsBlock);
  console.log('');

  if (process.env.PRODTEST_AUTO_HOSTS === '1') {
    try {
      await run('sudo', ['-n', 'sh', '-c', `grep -q 'app.aegisweb.local' /etc/hosts || echo '${hostsBlock}' >> /etc/hosts`]);
      console.log('Hosts updated.');
    } catch {
      console.warn('Could not update /etc/hosts automatically (sudo password required).');
      console.warn('Run this yourself, then continue:\n');
      console.warn(`  sudo sh -c "grep -q 'app.aegisweb.local' /etc/hosts || echo '${hostsBlock}' >> /etc/hosts"`);
    }
    return;
  }

  if (!process.stdin.isTTY) {
    console.log('Non-interactive shell: set PRODTEST_AUTO_HOSTS=1 or add hosts manually, then re-run.');
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolveAnswer) => {
    rl.question('Apply with sudo now? [y/N] ', resolveAnswer);
  });
  rl.close();
  if (answer.trim().toLowerCase() === 'y') {
    await run('sudo', ['sh', '-c', `grep -q 'app.aegisweb.local' /etc/hosts || echo '${hostsBlock}' >> /etc/hosts`]);
    console.log('Hosts updated.');
  } else {
    console.log('Skipped. Run with PRODTEST_AUTO_HOSTS=1 to apply automatically.');
  }
}

async function status() {
  const urls = [
    'https://api.aegisweb.local/health/ready',
    'https://app.aegisweb.local/login',
    'https://sandbox.aegisweb.local/health',
    'https://mail.aegisweb.local'
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      console.log(`${res.status}\t${url}`);
    } catch (error) {
      console.log(`ERR\t${url}\t${error instanceof Error ? error.message : error}`);
    }
  }
}

function runCompose(args: string[]) {
  // Shell-exported NEXT_PUBLIC_API_URL from local .env must not win over .env.prodtest.
  const {
    NEXT_PUBLIC_API_URL: _ignoredApiUrl,
    DASHBOARD_BASE_URL: _ignoredDashboard,
    API_ALLOWED_ORIGINS: _ignoredOrigins,
    NODE_ENV: _ignoredNodeEnv,
    ...rest
  } = process.env;

  return run('docker', ['compose', '--env-file', envPath, '-f', composeFile, ...args], {
    ...rest,
    COMPOSE_PROJECT_NAME: 'aegisweb-prodtest',
    NEXT_PUBLIC_API_URL: 'https://api.aegisweb.local',
    DASHBOARD_BASE_URL: 'https://app.aegisweb.local',
    API_ALLOWED_ORIGINS: 'https://app.aegisweb.local',
    NODE_ENV: 'production'
  });
}

function run(commandName: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(commandName, args, { stdio: 'inherit', env, cwd: root });
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${commandName} ${args.join(' ')} exited with ${code}`));
    });
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
