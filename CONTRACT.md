# Model APIs

The model team runs one AWS Lambda function URL with two paths. The website calls it from the server only, through `web/src/lib/model/client.ts`. Set the base URL as `MODEL_API_URL` in Vercel (and in `web/.env.local` for local runs):

```
MODEL_API_URL=https://25ycvhxvy2wzeccub6izcv3i7i0shtyj.lambda-url.us-east-1.on.aws
```

| Path | Purpose |
| --- | --- |
| `POST /rent-to-own` | Homes for a zip and rent |
| `POST /predict` | Predicted price for one home |

The Lambda doesn't send CORS headers, so browsers can't call it directly. The site's own routes forward to it, and the pages call those routes from the browser, so every model call shows in DevTools → Network:

| Browser calls | Forwards to | Response |
| --- | --- | --- |
| `POST /api/rent-to-own` `{"zip","monthly_rent","filters"}` | `$MODEL_API_URL/rent-to-own` | `upstream` (the Lambda URL), `model` (the Lambda's raw JSON), `homes` (enriched listings) |
| `POST /api/predict` (same body as `/predict`) | `$MODEL_API_URL/predict` | `upstream`, `prediction` |
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

## Requests for the model team

- **Budget on the full monthly cost, not principal and interest only.** `budget` is set so `monthly_pi` matches the rent, but property tax and insurance add about 40% in Houston (`monthly_total` is around $3,000 for a $2,200 rent). Most results show as "a stretch" on the site for that reason.
- **Accept filters** on `/rent-to-own` (`min_beds`, `min_baths`, `min_sqft`, `min_lot_sqft`, `home_types`) so filtering happens before the top results are picked.
- **Return `lat`, `lon` and `home_type`** in each `/rent-to-own` result, so homes missing from the site's copy of the data can still get a map.

## Running without the model

Leave `MODEL_API_URL` unset and the site uses a stand-in (`web/src/lib/model/mock.ts`): listings in or near the zip whose estimated monthly cost is at most 1.15x the rent, closest to the rent first.

Rebuild the listing data from the CSV with:

```sh
cd web && python3 -I scripts/build-listings.py /path/to/houston_housing_2024.csv
```
