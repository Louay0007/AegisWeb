import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const requiredFiles = [
  'docs/production-launch-checklist.md',
  'docs/accessibility-manual-checklist.md',
  'docs/load-test-targets.md',
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml',
  'playwright.config.ts',
];

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> };
const requiredScripts = [
  'typecheck',
  'lint',
  'test',
  'test:frontend',
  'test:component',
  'test:e2e',
  'test:security',
  'test:regression',
  'qa:a11y',
  'qa:responsive',
  'load:api',
  'load:workflow',
  'prod:check',
];

const missingFiles = requiredFiles.filter((file) => !existsSync(file));
const missingScripts = requiredScripts.filter((script) => !packageJson.scripts?.[script]);
const report = {
  generatedAt: new Date().toISOString(),
  missingFiles,
  missingScripts,
  ready: missingFiles.length === 0 && missingScripts.length === 0,
};

const artifactDir = join(process.cwd(), '.qa-artifacts');
mkdirSync(artifactDir, { recursive: true });
writeFileSync(join(artifactDir, 'launch-readiness.json'), JSON.stringify(report, null, 2));

if (!report.ready) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log('Launch readiness metadata checks passed.');
