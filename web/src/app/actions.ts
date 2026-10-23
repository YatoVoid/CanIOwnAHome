"use server";

import { headers } from "next/headers";
import { ChatHistorySchema, runChat, type ChatResult } from "@/lib/chat";
import { geminiConfigured } from "@/lib/gemini";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const perMinute = createRateLimiter({ limit: 15, windowMs: 60_000 });
const perDay = createRateLimiter({ limit: 200, windowMs: 24 * 60 * 60_000 });

export type ChatResponse = ({ ok: true } & ChatResult) | { ok: false; error: string };

export async function sendChat(history: unknown): Promise<ChatResponse> {
  const parsed = ChatHistorySchema.safeParse(history);
  if (!parsed.success) return { ok: false, error: "That message couldn't be sent. Keep it under 800 characters." };

  if (!geminiConfigured()) return { ok: false, error: "The assistant isn't set up yet. Use the form above instead." };

  const ip = clientIp(await headers());
  if (!perMinute(ip) || !perDay(ip)) {
    console.warn("chat rate limit hit", { ip });
    return { ok: false, error: "You're sending messages quickly. Wait a minute and try again." };
  }

  try {
    return { ok: true, ...(await runChat(parsed.data)) };
  } catch (err) {
    console.error("chat failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "The assistant didn't answer. Try again, or use the form above." };
  }
}
