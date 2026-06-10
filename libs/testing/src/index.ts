export const TEST_ENV = {
  databaseUrl: 'postgresql://agentpass:agentpass@localhost:5432/agentpass',
  redisUrl: 'redis://localhost:6379',
  s3Endpoint: 'http://localhost:9000',
  s3Region: 'local',
  s3AccessKey: 'agentpass',
  s3SecretKey: 'agentpass-secret'
} as const;

export function expectNoPlaintextSecret(serialized: string): void {
  const forbidden = ['acme-local-password', 'nimbus-local-password', 'atlas-local-password'];
  const leaked = forbidden.find((value) => serialized.includes(value));

  if (leaked) {
    throw new Error(`Secret leaked into serialized output: ${leaked}`);
  }
}
