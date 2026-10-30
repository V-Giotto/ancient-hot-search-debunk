const buckets = new Map<string, { count: number; resetAt: number }>();

// 单进程 IP 固定窗口；多实例部署应在可信代理或共享存储中实现统一限流。
export function checkChatRateLimit(ip: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
  for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
  const bucket = buckets.get(ip) ?? { count: 0, resetAt: now + 60_000 };
  buckets.set(ip, bucket);
  if (bucket.count >= 10) return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}
