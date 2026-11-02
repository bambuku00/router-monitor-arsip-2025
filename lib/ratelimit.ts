/**
 * In-memory rate limit + optional Upstash Redis (multi-instance).
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN untuk Redis.
 * Tanpa itu: fallback Map in-process (single instance).
 */
const globalStore = new Map<string, { count: number; expiresAt: number }>();

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const record = globalStore.get(key);

  if (!record) {
    globalStore.set(key, { count: 1, expiresAt: now + windowMs });
    return false;
  }

  if (now > record.expiresAt) {
    globalStore.set(key, { count: 1, expiresAt: now + windowMs });
    return false;
  }

  if (record.count >= limit) {
    return true;
  }

  record.count++;
  return false;
}

async function redisRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  const redisKey = `rl:${key}`;
  try {
    const incr = await fetch(`${url}/incr/${encodeURIComponent(redisKey)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!incr.ok) return null;
    const incrJson = (await incr.json()) as { result?: number };
    const count = Number(incrJson.result ?? 0);
    if (count === 1) {
      const expireSec = Math.max(1, Math.ceil(windowMs / 1000));
      await fetch(
        `${url}/expire/${encodeURIComponent(redisKey)}/${expireSec}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
    }
    return count > limit;
  } catch {
    return null;
  }
}

/** Sync API (middleware + existing callers). Redis diabaikan di sync path. */
export function rateLimit(
  ip: string,
  limit: number = 5,
  windowMs: number = 60000
): boolean {
  return memoryRateLimit(ip, limit, windowMs);
}

/** Async: coba Redis dulu, fallback memory. */
export async function rateLimitAsync(
  key: string,
  limit: number = 5,
  windowMs: number = 60000
): Promise<boolean> {
  const redis = await redisRateLimit(key, limit, windowMs);
  if (redis != null) return redis;
  return memoryRateLimit(key, limit, windowMs);
}

const globalForInterval = global as unknown as {
  rateLimitInterval: NodeJS.Timeout;
};

if (!globalForInterval.rateLimitInterval) {
  globalForInterval.rateLimitInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of globalStore.entries()) {
      if (now > value.expiresAt) {
        globalStore.delete(key);
      }
    }
  }, 60000 * 5);
}
