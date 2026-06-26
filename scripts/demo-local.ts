import { spawn } from 'node:child_process';

const reset = process.argv.includes('--reset');

async function main() {
  await run('pnpm', ['infra:up']);
  await run('pnpm', ['db:generate']);
  await run('pnpm', reset ? ['db:reset'] : ['db:seed']);

  const processes = [
    start('api', ['dev:api']),
    start('worker', ['dev:worker']),
    start('vendor', ['dev:vendor']),
    start('web', ['dev:web'], {
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      NEXT_PUBLIC_ALLOW_LOCAL_API_URL: 'true',
      NEXT_PUBLIC_ENABLE_DEMO_MODE: 'false',
      NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK: 'false'
    })
  ];

  process.on('SIGINT', () => {
    for (const child of processes) child.kill('SIGINT');
  });
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function start(name: string, script: string[], env: NodeJS.ProcessEnv = {}) {
  const child = spawn('pnpm', script, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with ${code}`);
    }
  });
  return child;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
