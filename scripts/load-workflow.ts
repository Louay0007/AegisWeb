import autocannon from 'autocannon';

const url = process.env.LOAD_WORKFLOW_URL ?? process.env.API_BASE_URL ?? 'http://localhost:3001/health/ready';
const connections = Number(process.env.LOAD_WORKFLOW_CONNECTIONS ?? 10);
const duration = Number(process.env.LOAD_WORKFLOW_DURATION_SECONDS ?? 20);
const maxLatencyP95 = Number(process.env.LOAD_WORKFLOW_MAX_P95_MS ?? 500);

const result = await autocannon({ url, connections, duration });
const latencyP95 = Number((result.latency as { p95?: number; average: number }).p95 ?? result.latency.average);

console.log(`Workflow load test: ${result.requests.average.toFixed(1)} rps, p95 ${latencyP95}ms`);

if (latencyP95 > maxLatencyP95) {
  console.error(`Workflow load test failed: expected p95 <= ${maxLatencyP95}ms.`);
  process.exit(1);
}
