import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const requiredFiles = [
  'docs/production-launch-checklist.md',
  'docs/accessibility-manual-checklist.md',
  'docs/load-test-targets.md',
  'docs/MVP_PHASES.md',
  'docs/observability-alerts.md',
  'docs/disaster-recovery-runbook.md',
  'docs/production-runbook.md',
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml',
  'playwright.config.ts',
  'scripts/backup.ts',
  'scripts/restore.ts',
  'scripts/smoke.ts',
  'scripts/e2e-happy-path.ts',
  'apps/worker/src/connector/connector-registry.service.ts',
  'apps/worker/src/connector/stripe-billing.connector.ts',
  'apps/worker/src/connector/github.connector.ts',
  'prisma/migrations/20260722140000_vendor_connector_type/migration.sql'
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
  'backup:postgres',
  'restore:postgres',
  'smoke',
  'e2e:happy',
  'launch:check'
];

const deployWorkflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
const deployChecks = {
  capturesImageDigests: deployWorkflow.includes('digest') || deployWorkflow.includes('RepoDigests'),
  hasRollbackJob: deployWorkflow.includes('rollback') || deployWorkflow.includes('Rollback'),
  runsSmokeAfterStaging: deployWorkflow.includes('pnpm smoke'),
  runsHappyPathAfterStaging: deployWorkflow.includes('e2e:happy') || deployWorkflow.includes('pnpm e2e:happy'),
  productionNeedsStaging: deployWorkflow.includes('needs: [deploy-staging]') || deployWorkflow.includes('needs: [deploy-staging]')
};

const missingFiles = requiredFiles.filter((file) => !existsSync(file));
const missingScripts = requiredScripts.filter((script) => !packageJson.scripts?.[script]);
const failedDeployChecks = Object.entries(deployChecks)
  .filter(([, ok]) => !ok)
  .map(([name]) => name);

const report = {
  generatedAt: new Date().toISOString(),
  missingFiles,
  missingScripts,
  failedDeployChecks,
  deployChecks,
  ready: missingFiles.length === 0 && missingScripts.length === 0 && failedDeployChecks.length === 0
};

const artifactDir = join(process.cwd(), '.qa-artifacts');
mkdirSync(artifactDir, { recursive: true });
writeFileSync(join(artifactDir, 'launch-readiness.json'), JSON.stringify(report, null, 2));

if (!report.ready) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log('Launch readiness checks passed.');
