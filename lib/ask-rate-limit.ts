const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
// 单进程、内存固定窗口。多实例部署需在可信反向代理或共享存储中限流。
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkAskRateLimit(ip: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  let bucket = buckets.get(ip);
  if (!bucket) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, bucket);
  }
  if (bucket.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}
