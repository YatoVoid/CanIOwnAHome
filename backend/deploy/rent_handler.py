import base64
import json
import os
from collections import Counter

import joblib
import numpy as np

HERE = os.path.dirname(__file__)
MODEL = joblib.load(os.path.join(HERE, "houston_model.joblib"))
FEATURES = list(MODEL.feature_names_in_)
LISTINGS = json.load(open(os.path.join(HERE, "listings.json")))
BY_ZIP = {}
for _l in LISTINGS:
    BY_ZIP.setdefault(_l["zipcode"], []).append(_l)

RATE, YEARS = 0.065, 30
TAX, INS = 0.025, 0.005


def _nan(v):
    return np.nan if v is None else float(v)


def _features(l):
    b, ba, s, ht = float(l["beds"]), float(l["baths"]), float(l["sqft_living"]), (l["home_type"] or "")
    f = {
        "beds": b, "baths": ba, "sqft_living": s, "lot_sqft": _nan(l["lot_sqft"]),
        "days_on_zillow": float(l["days_on_zillow"]), "rent_zestimate": _nan(l["rent_zestimate"]),
        "tax_assessed": _nan(l["tax_assessed"]), "lat": float(l["lat"]), "lon": float(l["lon"]),
        "log_sqft": np.log1p(s), "beds_per_bath": b / (ba + 0.001), "total_rooms": b + ba,
        "is_single_fam": int(ht == "SINGLE_FAMILY"), "is_condo": int(ht == "CONDO"),
        "is_townhouse": int(ht == "TOWNHOUSE"),
    }
    return [f[k] for k in FEATURES]


def _monthly_pi(price, down):
    r, n = RATE / 12, YEARS * 12
    return max(0.0, price - down) * (r * (1 + r) ** n) / ((1 + r) ** n - 1)


def _budget(rent, down):
    r, n = RATE / 12, YEARS * 12
    return rent * ((1 + r) ** n - 1) / (r * (1 + r) ** n) + down


def _resp(code, body):
    return {"statusCode": code, "headers": {"content-type": "application/json"}, "body": json.dumps(body)}


def handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "GET":
        return _resp(200, {"status": "ok", "usage": "POST JSON {zip|area, monthly_rent, down_payment?, n_results?}"})
    try:
        raw = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            raw = base64.b64decode(raw).decode()
        b = json.loads(raw)
        zipcode = str(b.get("zip", b.get("area", ""))).strip()
        rent = float(b.get("monthly_rent", b.get("monthlyRent")))
        down = float(b.get("down_payment", 20000))
        n = int(b.get("n_results", 10))
        if not (zipcode.isdigit() and len(zipcode) == 5):
            return _resp(400, {"error": "zip must be a 5-digit string"})

        budget = _budget(rent, down)
        pool = [l for l in BY_ZIP.get(zipcode, []) if l["price"] <= budget * 1.10]
        if not pool:
            return _resp(200, {"zip": zipcode, "monthly_rent": rent, "down_payment": down, "budget": round(budget),
                               "results": [], "message": "No listings found. Try a different zip or higher rent."})

        pred = MODEL.predict(np.array([_features(l) for l in pool], dtype=float))
        out = []
        for l, p in zip(pool, pred):
            price, over = l["price"], (l["price"] - p) / p
            if price <= budget:
                tier = "GOOD_BUY" if over <= 0.10 else "OVERPRICED"
            elif p <= budget:
                tier = "NEGOTIATE"
            else:
                continue
            pi = _monthly_pi(price, down)
            out.append({
                "id": l["id"], "address": l["address"], "zipcode": zipcode, "price": price,
                "predicted_price": round(float(p)), "delta_pct": round(over * 100, 1), "tier": tier,
                "beds": l["beds"], "baths": l["baths"], "sqft_living": l["sqft_living"],
                "monthly_pi": round(pi), "monthly_total": round(pi + price * (TAX + INS) / 12),
                "photo": l["photo"], "detail_url": l["url"],
            })
        out.sort(key=lambda r: -r["sqft_living"])
        return _resp(200, {
            "zip": zipcode, "monthly_rent": rent, "down_payment": down, "budget": round(budget),
            "tier_summary": dict(Counter(r["tier"] for r in out)), "total_found": len(out), "results": out[:n],
        })
    except Exception as e:
        return _resp(400, {"error": str(e)})
