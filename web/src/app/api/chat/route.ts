import { ChatHistorySchema, runChat } from "@/lib/chat";
import { geminiConfigured } from "@/lib/gemini";
import { guardSameOrigin, json, limiter, readJson } from "@/lib/http";

const rateLimit = limiter(15, 200);

export async function POST(req: Request) {
  const refused = guardSameOrigin(req) ?? rateLimit(req, "chat");
  if (refused) return refused;

  const read = await readJson(req);
  if (!read.ok) return read.response;
  const parsed = ChatHistorySchema.safeParse((read.body as { messages?: unknown } | null)?.messages);
  if (!parsed.success) {
    return json({ error: "That message couldn't be sent. Keep it under 800 characters." }, { status: 400 });
  }
  if (!geminiConfigured()) {
    return json({ error: "The assistant isn't set up yet. Use the form above instead." }, { status: 503 });
  }

  try {
    return json(await runChat(parsed.data));
  } catch (err) {
    console.error("chat failed", err instanceof Error ? err.message : err);
    return json({ error: "The assistant didn't answer. Try again, or use the form above." }, { status: 502 });
  }
}
