# Model API contract

The website calls the model over HTTP. The model team owns the server; the website owns the presentation and the monthly-cost math.

Base URL comes from `MODEL_API_URL` on Vercel. If `MODEL_API_KEY` is set, every request sends `Authorization: Bearer <key>`. Requests time out after 10 seconds and are retried once on a 5xx or network error.

The website validates every response with Zod (`web/src/lib/listing.ts`). A response that does not match is treated as an error and the user sees a "try again" page, so check your output against the examples below.

## POST /recommend

Request:

```json
{ "zip": "77044", "monthlyRent": 2200 }
```

- `zip`: 5-digit string.
- `monthlyRent`: whole dollars, 300 to 20000.

Response `200`:

```json
{ "homes": [ Listing, ... ] }
```

- Up to 100 homes. Order matters: the website shows them in the order you return them.
- Return `{ "homes": [] }` when nothing fits. Do not return 404 for this.

## GET /listings/{id}

Returns one `Listing`, or `404` if the id is unknown. The detail page calls this when someone opens a shared link, so it has to work for any id `/recommend` has returned.

## Listing

```json
{
  "id": "123182286",
  "address": { "street": "9807 Dawson Hill Ln", "city": "Houston", "state": "TX", "zip": "77044" },
  "price": 240000,
  "beds": 3,
  "baths": 2,
  "sqft": 1298,
  "lotSqft": 4783,
  "yearBuilt": 2016,
  "homeType": "SINGLE_FAMILY",
  "location": { "lat": 29.88, "lng": -95.18 },
  "photos": ["https://photos.zillowstatic.com/fp/<hash>-cc_ft_1536.jpg"],
  "hoaMonthly": 45,
  "estimates": { "value": 238600, "rent": 1950, "taxAssessed": 228250 },
  "model": {
    "predictedPrice": 236000,
    "score": 0.82,
    "reasons": ["About $82 a month less than your rent"]
  },
  "daysOnMarket": 4,
  "broker": "RE/MAX Fine Properties",
  "sourceUrl": "https://www.zillow.com/homedetails/..."
}
```

| Field | Rules |
| --- | --- |
| `id` | Letters, digits, `_` or `-`, max 64 chars. Stable across calls. |
| `price` | List price in dollars, > 0. |
| `beds`, `baths`, `sqft`, `lotSqft` | Number or `null`. |
| `yearBuilt` | Integer or `null`. Optional. |
| `homeType` | `SINGLE_FAMILY`, `TOWNHOUSE`, `CONDO`, `MULTI_FAMILY`, `MANUFACTURED`. Other strings show as-is. |
| `location` | `{lat, lng}` or `null`. Used for the map. |
| `photos` | `https://` URLs only, max 60. First photo is the cover. Zillow URLs get resized automatically. |
| `hoaMonthly` | Dollars or `null` (unknown). Optional. |
| `estimates.value` | Market value estimate (e.g. Zestimate) or `null`. |
| `estimates.rent` | Rent estimate for this home or `null`. |
| `estimates.taxAssessed` | County appraised value or `null`. |
| `model` | Optional. `predictedPrice` is your model's fair-price estimate, shown on the "Is the price fair?" chart. `score` is 0 to 1. `reasons` is up to 6 short plain-text lines shown under "Why it was picked". |
| `daysOnMarket`, `broker` | Or `null`. |
| `sourceUrl` | `https://` link to the original listing, or `null`. |

## How the website prices a home

The model decides which homes to show. The website computes the monthly cost itself (`web/src/lib/finance.ts`) so users can change down payment, rate and term:

- Principal and interest: standard 30/20/15-year amortization. Defaults are 5% down and 6.25%.
- Property tax: 2.1% of price per year.
- Insurance: 0.9% of price per year.
- PMI: 0.6% of the loan per year when down payment is under 20%.
- HOA: `hoaMonthly`, or $0 if unknown.

If the model filters homes by affordability, use the same defaults so the site and the model agree on what "fits".

## Running without the model

Leave `MODEL_API_URL` unset and the site uses the demo model in `web/src/lib/model/mock.ts`: listings from `web/data/mock-listings.json` whose default monthly cost is at most 1.15x rent, closest to the rent first, falling back to neighboring zips. Rebuild that file from the Houston CSV with:

```sh
cd web && python3 -I scripts/build-mock-listings.py /path/to/houston_housing_2024.csv
```
