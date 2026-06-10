export type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
};

export function connectionFromRedisUrl(redisUrl: string): RedisConnectionOptions {
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined
  };
}
