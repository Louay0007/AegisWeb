import { createHash } from 'node:crypto';
import { Inject, Injectable, NestMiddleware, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { ConfigService } from '../config/config.service.js';
import { HeaderValue } from '../request-context/types.js';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateProfile = {
  windowMs: number;
  max: number;
};

const buckets = new Map<string, RateLimitEntry>();
const MAX_BUCKETS = 20_000;

const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

type RateLimitRequest = {
  ip?: string;
  socket?: { remoteAddress?: string };
  url?: string;
  method?: string;
  headers?: Record<string, HeaderValue>;
};

type RateLimitResponse = {
  setHeader(name: string, value: string | number): void;
};

type Next = () => void;

@Injectable()
export class RateLimitMiddleware implements NestMiddleware, OnModuleDestroy {
  private readonly redis: Redis | undefined;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    if (this.config.config.nodeEnv === 'production') {
      this.redis = new Redis(this.config.redisUrl, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1
      });
    }
  }

  async use(request: RateLimitRequest, response: RateLimitResponse, next: Next): Promise<void> {
    const path = (request.url ?? '').split('?')[0];
    if (path === '/health' || path === '/health/ready') {
      next();
      return;
    }

    const profile = profileFor(path, this.config.config);
    const now = Date.now();
    const key = rateLimitKey(clientKey(request, this.config.config.apiTrustedProxies), request.method ?? 'GET', path);

    const result = this.redis
      ? await hitRedisLimit(this.redis, key, profile, now)
      : hitMemoryLimit(key, profile, now);

    writeHeaders(response, result.remaining, result.resetAt);

    if (result.count > profile.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
      response.setHeader('retry-after', retryAfterSeconds);
      throw new DomainError(DomainErrorCode.RateLimited, 'Rate limit exceeded.', { retryAfterSeconds });
    }

    next();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

function hitMemoryLimit(key: string, profile: RateProfile, now: number): RateLimitEntry & { remaining: number } {
  cleanupBuckets(now);
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + profile.windowMs });
    return { count: 1, resetAt: now + profile.windowMs, remaining: profile.max - 1 };
  }

  entry.count += 1;
  return { ...entry, remaining: Math.max(0, profile.max - entry.count) };
}

async function hitRedisLimit(redis: Redis, key: string, profile: RateProfile, now: number): Promise<RateLimitEntry & { remaining: number }> {
  const [countValue, ttlValue] = (await redis.eval(HIT_SCRIPT, 1, key, profile.windowMs)) as [number, number];
  const count = Number(countValue);
  const ttl = Number(ttlValue);
  const resetAt = now + (ttl > 0 ? ttl : profile.windowMs);
  return {
    count,
    resetAt,
    remaining: Math.max(0, profile.max - count)
  };
}

function rateLimitKey(client: string, method: string, path: string): string {
  const digest = createHash('sha256').update(`${client}:${method}:${routeGroup(path)}`).digest('hex');
  return `aegisweb:v1:rate-limit:${digest}`;
}

function profileFor(path: string, config: ConfigService['config']): RateProfile {
  if (path.startsWith('/auth/')) return { windowMs: config.rateLimitWindowMs, max: config.rateLimitAuthMax };
  if (path.startsWith('/internal/')) return { windowMs: config.rateLimitWindowMs, max: config.rateLimitInternalMax };
  if (path.startsWith('/files/') || path.startsWith('/receipts/')) return { windowMs: config.rateLimitWindowMs, max: config.rateLimitFileMax };
  return { windowMs: config.rateLimitWindowMs, max: config.rateLimitDefaultMax };
}

function clientKey(request: RateLimitRequest, trustedProxies: string[]): string {
  const remoteAddress = request.ip || request.socket?.remoteAddress || 'unknown';
  if (!trustedProxies.includes(remoteAddress)) {
    return remoteAddress;
  }

  const forwarded = readHeader(request.headers, 'x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || remoteAddress;
}

function routeGroup(path: string): string {
  if (path.startsWith('/auth/')) return 'auth';
  if (path.startsWith('/internal/')) return 'internal';
  if (path.startsWith('/files/')) return 'files';
  if (path.startsWith('/receipts/')) return 'receipts';
  return path.split('/').slice(0, 3).join('/') || '/';
}

function cleanupBuckets(now: number): void {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }

  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now || buckets.size >= MAX_BUCKETS) {
      buckets.delete(key);
    }
  }
}

function readHeader(headers: Record<string, HeaderValue> | undefined, name: string): string | undefined {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()] ?? headers?.[name.toUpperCase()];
  return Array.isArray(value) ? value[0] : value;
}

function writeHeaders(response: RateLimitResponse, remaining: number, resetAt: number): void {
  response.setHeader('x-ratelimit-remaining', remaining);
  response.setHeader('x-ratelimit-reset', Math.ceil(resetAt / 1000));
}
