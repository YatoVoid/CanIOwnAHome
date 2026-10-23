# How the data flows

### Search: form or chat → results page

```mermaid
flowchart LR
  Chat["Chat"] <-- "messages / reply + filters" --> Gemini1["Google Gemini"]
  Chat -- "search link" --> Search
  Form["Search form<br/>income, rent, savings,<br/>debts, zip"] --> Search{"Income given,<br/>or no zip?"}
  Search -- "yes (the form's flow)" --> Ours["Our ML scores<br/>web/data/ours<br/>fair price, deal label, flood"]
  Search -- "no (old rent + zip link)" --> AWS1["AWS /rent-to-own<br/>AWS /deal-score"]
  Ours --> Enrich["Photos, map, facts<br/>web/data/listings"]
  AWS1 --> Enrich
  Enrich --> Finance["Monthly cost vs budget<br/>lib/finance.ts"]
  Finance --> Results["Results page<br/>homes grid, flood check,<br/>best deals"]
```

### Home page

```mermaid
flowchart LR
  Home["Home page"] --> Predict["AWS /predict"] --> Fair["Is the price fair?"]
  Home --> Offer["AWS /offer-price"] --> WhatToOffer["What to offer"]
  Home --> Gemini2["Google Gemini"] --> Like["What it's like"]
  Home --> Data["web/data/listings<br/>+ web/data/ours"] --> Facts["Gallery, map, facts,<br/>fair price, flood"]
  Home --> Finance2["lib/finance.ts"] --> Cost["Monthly cost,<br/>cash to buy"]
```

### Inside AWS (backend branch, `backend/deploy`)

```mermaid
flowchart LR
  CSV["Zillow CSV<br/>houston_housing_2024.csv"] -- "build_data.py" --> LJ["listings.json<br/>cleaned listings + features"]
  Train["Training run"] --> Model["houston_model.joblib<br/>HistGradientBoostingRegressor<br/>15 features, RMSE $111,529"]
  Req1["POST /predict"] --> H1["handler.py"]
  H1 --> Model
  Model -- "price" --> Out1["predicted_price<br/>low / high = ± RMSE"]
  Req2["POST /rent-to-own"] --> H2["rent_handler.py"]
  H2 -- "rent → loan at 6.5%, 30 yr<br/>+ down payment = budget" --> Pool["Listings in the zip<br/>priced ≤ 110% of budget"]
  LJ --> Pool
  Pool --> Model
  Model -- "fair price per home" --> Tier["GOOD_BUY / NEGOTIATE /<br/>OVERPRICED, sorted by size"]
  Req3["POST /deal-score<br/>POST /offer-price"] --> H3["Deployed, code not<br/>in the repo yet"]
  H3 --> Model
```

Model features: beds, baths, sqft, lot sqft, days on Zillow, rent estimate, tax value, lat, lon, log of sqft, beds per bath, total rooms, and single-family / condo / townhouse flags. Missing inputs get defaults (3 beds, 2 baths, 1,800 sqft, 30 days, downtown coordinates), which is why the site always sends every field it knows.

### Our scores (ML notebook → `web/data/ours`)

```mermaid
flowchart LR
  NB["ML notebook<br/>houston-home/nb_src/06_export_site.py"] --> OJ["ours.json<br/>per zpid: fair price,<br/>% below fair, label"]
  NB --> ZF["zip_flood.json<br/>per zip: flood score 0-1,<br/>flood-insurance claims"]
  OJ --> Site["lib/ours.ts → lib/model/ours-search.ts"]
  ZF --> Site
  Site -- "bargain / fair / overpriced / flood trap,<br/>Low / Medium / High flood" --> Pages["Results ranking, card chips,<br/>flood check, home-page flood section"]
```

These are files in the repo, not live calls. Rerun the notebook export and commit the two files to update them.

| Source | The site sends | It returns | The site uses it for |
| --- | --- | --- | --- |
| AWS `POST /rent-to-own` | `zip`, `monthly_rent`, `down_payment: 0`, `n_results: 100` | Homes in the zip within the rent-based budget, with `price`, `predicted_price`, `delta_pct`, `tier` (within budget: GOOD_BUY if at most 10% over the model price, else OVERPRICED; over budget but the model price fits: NEGOTIATE), beds, baths, sqft, one photo, sorted by size | Results grid and "Why it was picked", for old links that have rent and zip but no income |
| AWS `POST /deal-score` | `area` = the zip, `n_results: 40` | Homes with `deal_score` (50% price vs model, 30% days on market, 20% rental yield), `rating`, `value_gap_pct`, `days_on_zillow` | "Best deals in &lt;zip&gt;" under the results, same old-link case |
| AWS `POST /predict` | beds, baths, sqft, home type, lat, lon, rent and tax estimates (unknown fields left out) | `predicted_price` from the gradient-boosting model, `low_estimate` / `high_estimate` = ± $111,529 | "Is the price fair?" chart on every home page |
| AWS `POST /offer-price` | Exactly 8 fields: asking price, beds, baths, sqft, days on Zillow, home type, lat, lon | Model estimate and range, verdict, three offers: competitive (ask or model value), fair (model value), negotiated (model value minus a discount for days on market) | "What to offer" on every home page (offers above the asking price are flagged) |
| `web/data/ours` (ML notebook) | Looked up by zpid and zip, no network call | Fair price, % below fair, label (bargain, fair, overpriced, flood trap), zip flood score | Ranking for the income flow and Houston-wide search, fair-price and flood chips, flood check, "Best deals" in that flow |
| `web/data/listings` (Zillow CSV) | Looked up by zpid | 12 photos, coordinates, lot size, home type, Zestimate, rent estimate, tax value, days listed | Gallery, map, facts table, inputs for `/predict` and `/offer-price` |
| Google Gemini | Chat history; or one home's facts | Chat reply plus extracted zip, rent, household and filters; or a description | The chat's "Show matching homes" link; "What it's like" on each home page |
| `lib/finance.ts` (no model) | Price and the user's numbers | Monthly cost (loan, tax, insurance, PMI, HOA), budget, top price, cash to buy | Every monthly figure and "less than / more than your rent" badge |

The Lambda sends no CORS headers, so the browser never calls AWS directly. Each `/api` route calls it from the server and returns the Lambda URL it used as `upstream`. Without `MODEL_API_URL`, the AWS rows fall back to a stand-in model and the home-page sections that need AWS are hidden.

---

# Can I Own a Home?

A renter enters their zip code and monthly rent. A model picks homes for sale nearby that would cost about the same per month to own. The site shows each one as a listing presentation: photos, a short description generated from the listing facts, the monthly cost next to their rent, cash needed to buy, and how the asking price compares to estimates.

Houston area only for now.

## Layout

| Path | What |
| --- | --- |
| `web/` | Next.js 16 site, deployed to Vercel |
| `model/` | Recommendation model (model team) |
| `CONTRACT.md` | The model APIs the site calls, and what the site needs from them |

## Run the site

```sh
cd web
npm install
cp .env.example .env.local   # add GEMINI_API_KEY and MODEL_API_URL
npm run dev
```

Open http://localhost:3000. Without `MODEL_API_URL` the site uses a stand-in model over `web/data/listings`. Without `GEMINI_API_KEY` descriptions fall back to a one-line summary.

```sh
npm test          # vitest
npm run lint
npm run typecheck # run after `npm run build` once, it generates route types
```

## Deploy (Vercel)

1. Import the repo in Vercel and set **Root Directory** to `web`.
2. Environment variables:
   - `GEMINI_API_KEY`: server-side only. Never add a `NEXT_PUBLIC_` copy.
   - `GEMINI_MODEL`: optional, defaults to `gemini-3.5-flash` (falls back to `gemini-flash-lite-latest` when busy).
   - `MODEL_API_URL`: the model team's Lambda base URL (see `CONTRACT.md`).
3. In the Google Cloud console, set a quota or budget cap on the Gemini key. The app's per-IP limits (30 descriptions a minute, 15 chat messages a minute, 200 a day) are in memory per function instance and only stop bursts.

## Pages

- `/`: zip and rent form, and below it a chat where the user describes their household and needs. Gemini turns the conversation into search filters (bedrooms, bathrooms, size, yard, home type) and asks for whatever is missing. The search button appears once zip, rent and household size are known. Logic in `web/src/lib/chat.ts`, called through the server action in `web/src/app/actions.ts`.
- `/homes?zip=77044&rent=2200`: the recommended homes, with down payment, rate and term controls. Costs update live. Optional filters: `beds`, `baths`, `sqft`, `lot`, `type` (comma-separated home types).
- `/homes/[id]?zip=…&rent=…`: one home's presentation, with previous/next through the result list.

## Known gaps

- Photos and listing data are hotlinked from Zillow via the scraped dataset. That is fine for a class/demo build but not for a public launch; Zillow's terms forbid it. The real model API should return photos we are allowed to show.
- Tax and insurance are flat Houston averages, not per-property quotes.
- No accounts: assumptions are saved in the browser's localStorage only.
- Gemini descriptions are cached per listing for weeks (`use cache: remote`). A changed listing keeps its old description until the next deploy.
