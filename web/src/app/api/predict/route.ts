import { cachedPredict } from "@/lib/data";
import { guardSameOrigin, json, limiter, readJson } from "@/lib/http";
import { PredictInputSchema } from "@/lib/model/predict-input";

const rateLimit = limiter(60, 2000);

export async function POST(req: Request) {
  const refused = guardSameOrigin(req) ?? rateLimit(req, "predict");
  if (refused) return refused;

  const read = await readJson(req);
  if (!read.ok) return read.response;
  const parsed = PredictInputSchema.safeParse(read.body);
  if (!parsed.success) return json({ error: "Invalid home", issues: parsed.error.issues }, { status: 400 });

  try {
    return json(await cachedPredict(parsed.data));
  } catch (err) {
    console.error("predict failed", err instanceof Error ? err.message : err);
    return json({ error: "The pricing model didn't answer." }, { status: 502 });
  }
}
