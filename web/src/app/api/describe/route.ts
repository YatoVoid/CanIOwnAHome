import { cachedListing } from "@/lib/data";
import { describeHome, descriptionFacts } from "@/lib/describe";
import { geminiConfigured } from "@/lib/gemini";
import { guardSameOrigin, json, limiter } from "@/lib/http";

const rateLimit = limiter(30, 500);

export async function GET(req: Request) {
  const refused = guardSameOrigin(req) ?? rateLimit(req, "describe");
  if (refused) return refused;

  const id = new URL(req.url).searchParams.get("id") ?? "";
  const home = await cachedListing(id);
  if (!home) return json({ error: "Unknown home" }, { status: 404 });
  if (!geminiConfigured()) return json({ text: null, generatedBy: null });

  try {
    return json({ text: await describeHome(descriptionFacts(home)), generatedBy: "Google Gemini" });
  } catch (err) {
    console.error("description failed", id, err instanceof Error ? err.message : err);
    return json({ text: null, generatedBy: null });
  }
}
