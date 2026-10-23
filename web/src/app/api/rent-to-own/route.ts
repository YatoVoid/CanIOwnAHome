import { z } from "zod";
import { cachedRentToOwn } from "@/lib/data";
import { guardSameOrigin, json, limiter, readJson } from "@/lib/http";
import { FiltersSchema, SearchSchema } from "@/lib/listing";

const rateLimit = limiter(60, 2000);

const BodySchema = z.object({
  zip: SearchSchema.shape.zip,
  monthly_rent: SearchSchema.shape.rent,
  income: SearchSchema.shape.income,
  savings: SearchSchema.shape.savings,
  debts: SearchSchema.shape.debts,
  filters: FiltersSchema.default({}),
});

export async function POST(req: Request) {
  const refused = guardSameOrigin(req) ?? rateLimit(req, "rent-to-own");
  if (refused) return refused;

  const read = await readJson(req);
  if (!read.ok) return read.response;
  const parsed = BodySchema.safeParse(read.body);
  if (!parsed.success) return json({ error: "Invalid search", issues: parsed.error.issues }, { status: 400 });

  const { zip, monthly_rent, income, savings, debts, filters } = parsed.data;
  try {
    return json(await cachedRentToOwn({ zip, rent: monthly_rent, income, savings, debts, filters }));
  } catch (err) {
    console.error("rent-to-own failed", err instanceof Error ? err.message : err);
    return json({ error: "The pricing model didn't answer. Try again in a moment." }, { status: 502 });
  }
}
