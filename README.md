# Can I Own a Home?

A renter enters their zip code and monthly rent. A model picks homes for sale nearby that would cost about the same per month to own. The site shows each one as a listing presentation: photos, a short description generated from the listing facts, the monthly cost next to their rent, cash needed to buy, and how the asking price compares to estimates.

Houston area only for now.

## Layout

| Path | What |
| --- | --- |
| `web/` | Next.js 16 site, deployed to Vercel |
| `model/` | Recommendation model and its API (model team) |
| `CONTRACT.md` | The HTTP API between the two |

## Run the site

```sh
cd web
npm install
cp .env.example .env.local   # optional: add GEMINI_API_KEY, MODEL_API_URL
npm run dev
```

Open http://localhost:3000. Without `MODEL_API_URL` the site uses the demo model over `web/data/mock-listings.json`. Without `GEMINI_API_KEY` descriptions fall back to a one-line summary.

```sh
npm test          # vitest
npm run lint
npm run typecheck # run after `npm run build` once, it generates route types
```

## Deploy (Vercel)

1. Import the repo in Vercel and set **Root Directory** to `web`.
2. Environment variables:
   - `GEMINI_API_KEY`: server-side only. Never add a `NEXT_PUBLIC_` copy.
   - `GEMINI_MODEL`: optional, defaults to `gemini-flash-latest`.
   - `MODEL_API_URL`, `MODEL_API_KEY`: once the model API is live.
3. In the Google Cloud console, set a quota or budget cap on the Gemini key. The app's per-IP limit (30 descriptions a minute) is in memory per function instance and only stops bursts.

## Pages

- `/`: zip and rent form.
- `/homes?zip=77044&rent=2200`: the recommended homes, with down payment, rate and term controls. Costs update live.
- `/homes/[id]?zip=…&rent=…`: one home's presentation, with previous/next through the result list.

## Known gaps

- Photos and listing data are hotlinked from Zillow via the scraped dataset. That is fine for a class/demo build but not for a public launch; Zillow's terms forbid it. The real model API should return photos we are allowed to show.
- Tax and insurance are flat Houston averages, not per-property quotes.
- No accounts: assumptions are saved in the browser's localStorage only.
- Gemini descriptions are cached per listing for weeks (`use cache: remote`). A changed listing keeps its old description until the next deploy.
