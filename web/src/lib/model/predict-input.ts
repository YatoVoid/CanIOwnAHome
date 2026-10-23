import { z } from "zod";
import { HOME_TYPES, type Listing } from "@/lib/listing";

export const PredictInputSchema = z.object({
  beds: z.number().min(0).max(50).optional(),
  baths: z.number().min(0).max(50).optional(),
  sqft_living: z.number().positive().max(100_000).optional(),
  home_type: z.enum(HOME_TYPES),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  rent_zestimate: z.number().nonnegative().max(1_000_000).optional(),
  tax_assessed: z.number().nonnegative().max(100_000_000).optional(),
});

export type PredictInput = z.infer<typeof PredictInputSchema>;

/**
 * The model treats an explicit null differently from a missing field, so
 * unknown values are left out instead of sent as null.
 */
export function predictInput(home: Listing): PredictInput | null {
  if (!home.location || !(HOME_TYPES as readonly string[]).includes(home.homeType)) return null;
  const input: PredictInput = {
    home_type: home.homeType as PredictInput["home_type"],
    lat: home.location.lat,
    lon: home.location.lng,
  };
  if (home.beds != null) input.beds = home.beds;
  if (home.baths != null) input.baths = home.baths;
  if (home.sqft != null) input.sqft_living = home.sqft;
  if (home.estimates.rent != null) input.rent_zestimate = home.estimates.rent;
  if (home.estimates.taxAssessed != null) input.tax_assessed = home.estimates.taxAssessed;
  return input;
}
