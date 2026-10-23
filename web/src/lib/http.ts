import { clientIp, createRateLimiter } from "@/lib/rate-limit";

export const MAX_BODY_BYTES = 64 * 1024;

export function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

/**
 * These routes spend money (Gemini) or hit the model team's Lambda, so only
 * this site's own pages may call them. Browsers always send Sec-Fetch-Site or
 * Origin on fetch(); anything else is refused.
 */
export function sameOrigin(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { ok: false, response: json({ error: "Request too large" }, { status: 413 }) };
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: json({ error: "Request too large" }, { status: 413 }) };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: json({ error: "Body must be JSON" }, { status: 400 }) };
  }
}

export function limiter(perMinute: number, perDay: number) {
  const minute = createRateLimiter({ limit: perMinute, windowMs: 60_000 });
  const day = createRateLimiter({ limit: perDay, windowMs: 24 * 60 * 60_000 });
  return (req: Request, route: string) => {
    const ip = clientIp(req.headers);
    if (minute(ip) && day(ip)) return null;
    console.warn("rate limit hit", { route, ip });
    return json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });
  };
}

export function guardSameOrigin(req: Request) {
  if (!sameOrigin(req)) {
    console.warn("cross-site API call refused", { url: req.url, origin: req.headers.get("origin") });
    return json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
