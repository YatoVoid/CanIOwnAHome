type Window = { start: number; count: number };

/**
 * Fixed-window limiter held in memory. On Vercel each function instance keeps
 * its own counts, so this only blunts bursts from one client; the hard cost cap
 * is the quota set on the Gemini key itself.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const windows = new Map<string, Window>();

  return function allow(key: string, now = Date.now()) {
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k);
    }
    const w = windows.get(key);
    if (!w || now - w.start >= windowMs) {
      windows.set(key, { start: now, count: 1 });
      return true;
    }
    if (w.count >= limit) return false;
    w.count++;
    return true;
  };
}

export function clientIp(headers: Headers) {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
