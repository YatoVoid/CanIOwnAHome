import base64
import json
import os

import joblib
import numpy as np

MODEL = joblib.load(os.path.join(os.path.dirname(__file__), "houston_model.joblib"))
RESIDUAL_STD = 111529.0
FEATURES = list(MODEL.feature_names_in_)


def _num(v):
    return float(v) if v is not None else np.nan


def _row(b):
    beds, baths, sqft = float(b.get("beds", 3)), float(b.get("baths", 2)), float(b.get("sqft_living", 1800))
    ht = str(b.get("home_type", "SINGLE_FAMILY")).upper()
    f = {
        "beds": beds, "baths": baths, "sqft_living": sqft,
        "lot_sqft": _num(b.get("lot_sqft")),
        "days_on_zillow": float(b.get("days_on_zillow", 30)),
        "rent_zestimate": _num(b.get("rent_zestimate")),
        "tax_assessed": _num(b.get("tax_assessed")),
        "lat": float(b.get("lat", 29.76)), "lon": float(b.get("lon", -95.37)),
        "log_sqft": np.log1p(sqft), "beds_per_bath": beds / (baths + 0.001),
        "total_rooms": beds + baths,
        "is_single_fam": int(ht == "SINGLE_FAMILY"), "is_condo": int(ht == "CONDO"),
        "is_townhouse": int(ht == "TOWNHOUSE"),
    }
    return np.array([[f[k] for k in FEATURES]], dtype=float)


def _resp(code, body):
    return {"statusCode": code, "headers": {"content-type": "application/json"}, "body": json.dumps(body)}


def predict_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "GET":
        return _resp(200, {"status": "ok", "usage": "POST JSON {beds, baths, sqft_living, home_type, lat, lon, lot_sqft?, days_on_zillow?, rent_zestimate?, tax_assessed?}"})
    try:
        raw = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            raw = base64.b64decode(raw).decode()
        p = float(MODEL.predict(_row(json.loads(raw)))[0])
        return _resp(200, {"predicted_price": round(p), "low_estimate": round(max(0.0, p - RESIDUAL_STD)), "high_estimate": round(p + RESIDUAL_STD)})
    except Exception as e:
        return _resp(400, {"error": str(e)})


def handler(event, context):
    path = event.get("rawPath", "/").rstrip("/") or "/"
    if path == "/rent-to-own":
        import rent_handler
        return rent_handler.handler(event, context)
    if path in ("/", "/predict"):
        return predict_handler(event, context)
    return _resp(404, {"error": "not found", "routes": ["POST /predict", "POST /rent-to-own"]})
