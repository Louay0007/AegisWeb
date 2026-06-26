import autocannon from 'autocannon';

const url = process.env.LOAD_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:3001/health/ready';
const connections = Number(process.env.LOAD_CONNECTIONS ?? 25);
const duration = Number(process.env.LOAD_DURATION_SECONDS ?? 20);
const minRequestsPerSecond = Number(process.env.LOAD_MIN_RPS ?? 50);

const result = await autocannon({ url, connections, duration });
const rps = result.requests.average;
const latencyP95 = Number((result.latency as { p95?: number; average: number }).p95 ?? result.latency.average);

console.log(`API load test: ${rps.toFixed(1)} rps, p95 ${latencyP95}ms`);

if (rps < minRequestsPerSecond) {
  console.error(`API load test failed: expected >= ${minRequestsPerSecond} rps.`);
  process.exit(1);
}
