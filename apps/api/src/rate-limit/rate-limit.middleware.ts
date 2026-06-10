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

const defaultProfile: RateProfile = { windowMs: 60_000, max: 600 };
const authProfile: RateProfile = { windowMs: 60_000, max: 20 };
const internalProfile: RateProfile = { windowMs: 60_000, max: 240 };
const fileProfile: RateProfile = { windowMs: 60_000, max: 120 };

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

    const profile = profileFor(path);
    const now = Date.now();
    const key = rateLimitKey(clientKey(request), request.method ?? 'GET', path);

    const result = this.redis
      ? await hitRedisLimit(this.redis, key, profile, now)
      : hitMemoryLimit(key, profile, now);

    writeHeaders(response, result.remaining, result.resetAt);

    if (result.count > profile.max) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Rate limit exceeded.', {
        retryAfterSeconds: Math.ceil((result.resetAt - now) / 1000),
      });
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
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pexpire(key, profile.windowMs);
  }

  const ttl = await redis.pttl(key);
  const resetAt = now + (ttl > 0 ? ttl : profile.windowMs);
  return {
    count,
    resetAt,
    remaining: Math.max(0, profile.max - count)
  };
}

function rateLimitKey(client: string, method: string, path: string): string {
  const digest = createHash('sha256').update(`${client}:${method}:${path}`).digest('hex');
  return `aegisweb:rate-limit:${digest}`;
}

function profileFor(path: string): RateProfile {
  if (path.startsWith('/auth/')) return authProfile;
  if (path.startsWith('/internal/')) return internalProfile;
  if (path.startsWith('/files/') || path.startsWith('/receipts/')) return fileProfile;
  return defaultProfile;
}

function clientKey(request: RateLimitRequest): string {
  const remoteAddress = request.ip || request.socket?.remoteAddress || 'unknown';
  if (!isTrustedProxy(remoteAddress)) {
    return remoteAddress;
  }

  const forwarded = readHeader(request.headers, 'x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || remoteAddress;
}

function isTrustedProxy(remoteAddress: string): boolean {
  const trusted = (process.env.API_TRUSTED_PROXIES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return trusted.includes(remoteAddress);
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
