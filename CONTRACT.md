# Model APIs

The model team runs one AWS Lambda function URL with two paths. The website calls it from the server only, through `web/src/lib/model/client.ts`. Set the base URL as `MODEL_API_URL` in Vercel (and in `web/.env.local` for local runs):

```
MODEL_API_URL=https://25ycvhxvy2wzeccub6izcv3i7i0shtyj.lambda-url.us-east-1.on.aws
```

| Path | Purpose | Used on |
| --- | --- | --- |
| `POST /rent-to-own` | Homes for a zip and rent | Results grid, verdict on each home |
| `POST /predict` | Predicted price for one home | "Is the price fair?" |
| `POST /deal-score` | Best deals in an area, any price | "Best deals in <zip>" under the results |
| `POST /offer-price` | Suggested offers for one home | "What to offer" on each home |

The Lambda doesn't send CORS headers, so browsers can't call it directly. The site's own routes forward to it, and the pages call those routes from the browser, so every model call shows in DevTools → Network:

| Browser calls | Forwards to | Response |
| --- | --- | --- |
| `POST /api/rent-to-own` `{"zip","monthly_rent","filters"}` | `$MODEL_API_URL/rent-to-own` | `upstream` (the Lambda URL), `model` (the Lambda's raw JSON), `homes` (enriched listings) |
| `POST /api/predict` (same body as `/predict`) | `$MODEL_API_URL/predict` | `upstream`, `prediction` |
| `POST /api/deal-score` `{"zip","monthly_rent","filters"}` | `$MODEL_API_URL/deal-score` | `upstream`, `model` (raw JSON), `homes` |
| `POST /api/offer-price` (same body as `/offer-price`) | `$MODEL_API_URL/offer-price` | `upstream`, `offer` |
| `POST /api/chat` `{"messages"}` | Gemini | reply and extracted filters |
| `GET /api/describe?id=` | Gemini | listing description |

These routes only answer the site's own pages (same-origin check), cap bodies at 64 KB, and rate-limit per IP.

Requests time out after 15 seconds and are retried once on a 5xx or network error. Responses are validated with Zod. A malformed result is skipped; a malformed response shows the user a "try again" page.

## Rent-to-own

`POST $MODEL_API_URL/rent-to-own`

```json
{ "zip": "77044", "monthly_rent": 2200, "down_payment": 0, "n_results": 100 }
```

The site sends `down_payment: 0` because it doesn't ask users for savings yet.

Response:

```json
{
  "zip": "77044",
  "monthly_rent": 2200.0,
  "down_payment": 0.0,
  "budget": 348064,
  "tier_summary": { "GOOD_BUY": 126, "NEGOTIATE": 6, "OVERPRICED": 4 },
  "total_found": 136,
  "results": [
    {
      "id": 28276795,
      "address": "12343 Haroldson Forest Dr, Houston, TX 77044",
      "zipcode": "77044",
      "price": 259999,
      "predicted_price": 569467,
      "delta_pct": -54.3,
      "tier": "GOOD_BUY",
      "beds": 6.0,
      "baths": 3.0,
      "sqft_living": 3351.0,
      "monthly_pi": 1517,
      "monthly_total": 2167,
      "photo": "https://photos.zillowstatic.com/fp/<hash>-p_e.jpg",
      "detail_url": "https://www.zillow.com/homedetails/..._zpid/"
    }
  ]
}
```

What the site uses: `id`, `address`, `zipcode`, `price`, `predicted_price`, `delta_pct`, `tier` (shown as "Good buy", "Room to negotiate", "Overpriced"), `beds`, `baths`, `sqft_living`, `photo`, `detail_url`. Results are shown in the order returned. No results: `{"results": [], "message": "..."}` with status 200.

`id` is the Zillow zpid. The site looks it up in `web/data/listings` (built from the same Houston CSV) to get every photo, coordinates for the map, lot size, home type, Zestimate, rent estimate and tax value. Homes not in that data still show, with the API's single photo and no map.

Search filters from the chat (bedrooms, bathrooms, size, lot, home type) are applied by the website after the response, so the site asks for 100 results to leave enough after filtering.

## Predict

`POST $MODEL_API_URL/predict`

```json
{
  "beds": 3, "baths": 2, "sqft_living": 1800, "home_type": "SINGLE_FAMILY",
  "lat": 29.76, "lon": -95.37, "rent_zestimate": 2000, "tax_assessed": 280000
}
```

Response: `{"predicted_price": 318776, "low_estimate": 207247, "high_estimate": 430305}`

Called for each home page (cached for an hour). The site leaves out fields it doesn't know instead of sending `null`, because the model gives very different answers for `null`. If the call fails, the page still renders without the model estimate.

## Deal score

`POST $MODEL_API_URL/deal-score`

```json
{ "area": "77044", "n_results": 40 }
```

The site only ever sends a zip as `area`. Free text matches loosely: `"all"` returns the Galleria, `"Spring Branch"` returns Spring, and an unknown word scores the whole city. The site drops the results unless the response's `area` is `"Zip <the zip it sent>"`.

Response fields used: `area`, `scoring_weights`, and per result `price`, `predicted`, `value_gap_pct`, `days_on_zillow`, `deal_score`, `rating` (stars stripped), `beds`, `baths`, `sqft_living`, `zipcode`, `detail_url`. Results have no `id`, so the site reads the zpid out of `detail_url` (`.../<zpid>_zpid/`) and skips results without one. Chat filters are applied after the response; the top 6 are shown.

## Offer price

`POST $MODEL_API_URL/offer-price`

```json
{
  "asking_price": 259999, "beds": 6, "baths": 3, "sqft_living": 3351, "days_on_zillow": 245,
  "home_type": "SINGLE_FAMILY", "lat": 29.899456, "lon": -95.22446
}
```

The endpoint fills in defaults for anything missing (`{"beds":3}` alone is priced as a $350,000 home), so the site sends every field and skips homes missing beds, baths, size or location. `days_on_zillow` is left out when unknown (the endpoint then assumes 30). Extra fields like `rent_zestimate` change the estimate a lot ($551K becomes $711K for the example above), so only the eight documented fields are sent. The site rejects a response whose `asking_price` differs from the one it sent.

Response fields used: `asking_price`, `model_estimate`, `confidence_range`, `value_verdict`, `negotiation_room`, `offers.{competitive,fair,negotiated}.{amount,reason}`, `reasoning.timing`. Em dashes in the text are shown as colons.

## Requests for the model team

- **Budget on the full monthly cost, not principal and interest only.** `budget` is set so `monthly_pi` matches the rent, but property tax and insurance add about 40% in Houston (`monthly_total` is around $3,000 for a $2,200 rent). Most results show as "a stretch" on the site for that reason.
- **Accept filters** on `/rent-to-own` (`min_beds`, `min_baths`, `min_sqft`, `min_lot_sqft`, `home_types`) so filtering happens before the top results are picked.
- **`/offer-price` suggests offers above the asking price** for underpriced homes ("negotiated" $485,158 and "fair" $551,316 on a $259,999 ask). The site shows them but flags each one as above asking. Capping offers at the asking price would make the advice usable.
- **Four different estimates for one home.** 12343 Haroldson Forest Dr: `/rent-to-own` $569,467, `/deal-score` $569,467, `/predict` $553,956, `/offer-price` $551,316. The home page shows the `/rent-to-own` figure in "Is the price fair?" and the `/offer-price` figure in "What to offer".
- **Validate inputs on `/offer-price` and `/deal-score`** instead of substituting defaults or loose matches, and return 400 for bad input.
- **Return an `id`** in `/deal-score` results.
- **Return `lat`, `lon` and `home_type`** in each `/rent-to-own` result, so homes missing from the site's copy of the data can still get a map.

## Running without the model

Leave `MODEL_API_URL` unset and the site uses a stand-in (`web/src/lib/model/mock.ts`): listings in or near the zip whose estimated monthly cost is at most 1.15x the rent, closest to the rent first.

Rebuild the listing data from the CSV with:

```sh
cd web && python3 -I scripts/build-listings.py /path/to/houston_housing_2024.csv
```
