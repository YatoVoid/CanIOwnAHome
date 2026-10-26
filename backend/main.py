"""
Houston HomeLens — FastAPI Server
==================================
Loads a pre-trained model (houston_model.joblib) and clean dataset
(houston_clean.csv) from the same directory, then serves the API.

Place these files in the same folder before running:
    houston_model.joblib
    houston_clean.csv

Local:
    pip install fastapi uvicorn pandas numpy scikit-learn joblib
    python houston_api.py
    http://localhost:8000/docs

Railway:
    Commits houston_model.joblib + houston_clean.csv to the repo.
    Railway reads PORT from environment automatically.
"""

import os
import sys
import warnings
warnings.filterwarnings("ignore")

import joblib
import numpy as np
import pandas as pd
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

# ── Config ─────────────────────────────────────────────────────────────────
MODEL_FILE    = os.path.join(os.path.dirname(__file__), "houston_model.joblib")
DATA_FILE     = os.path.join(os.path.dirname(__file__), "houston_clean.csv")
RANDOM_STATE  = 42
INTEREST_RATE = 0.065
LOAN_YEARS    = 30
PROPERTY_TAX  = 0.025
INSURANCE     = 0.005
RESIDUAL_STD  = 111529.0   # RMSE from training run — update if you retrain

FEATURES = [
    "beds", "baths", "sqft_living", "lot_sqft",
    "days_on_zillow", "rent_zestimate", "tax_assessed",
    "lat", "lon",
    "log_sqft", "beds_per_bath", "total_rooms",
    "is_single_fam", "is_condo", "is_townhouse",
]

NEIGHBORHOOD_MAP = {
    "heights":         ["77008", "77009"],
    "the heights":     ["77008", "77009"],
    "midtown":         ["77002", "77006"],
    "montrose":        ["77006"],
    "river oaks":      ["77019", "77027"],
    "galleria":        ["77056", "77057"],
    "downtown":        ["77002", "77010"],
    "eado":            ["77003"],
    "museum district": ["77004", "77005"],
    "west university": ["77005"],
    "rice village":    ["77005"],
    "memorial":        ["77024", "77079"],
    "energy corridor": ["77077", "77079"],
    "katy":            ["77449", "77450", "77494"],
    "sugar land":      ["77478", "77479", "77498"],
    "pearland":        ["77581", "77584"],
    "spring":          ["77373", "77379", "77388"],
    "woodlands":       ["77380", "77381", "77382"],
    "the woodlands":   ["77380", "77381", "77382"],
    "cypress":         ["77429", "77433"],
    "friendswood":     ["77546"],
    "league city":     ["77573", "77574"],
    "humble":          ["77338", "77346"],
    "stafford":        ["77477"],
    "bellaire":        ["77401"],
    "kingwood":        ["77339", "77345"],
    "clear lake":      ["77058", "77059"],
    "pasadena":        ["77502", "77503", "77504", "77505"],
    "baytown":         ["77520", "77521"],
}

# ── Global state ────────────────────────────────────────────────────────────
model   = None
df      = None
metrics = {}


# ── Startup ─────────────────────────────────────────────────────────────────
def load():
    global model, df, metrics

    for path, label in [(MODEL_FILE, "houston_model.joblib"),
                         (DATA_FILE,  "houston_clean.csv")]:
        if not os.path.exists(path):
            print(f"ERROR: '{label}' not found.")
            print(f"Expected at: {path}")
            print("Commit both files to your repo alongside houston_api.py.")
            sys.exit(1)

    print("Loading model ...")
    model = joblib.load(MODEL_FILE)

    print("Loading data ...")
    df = pd.read_csv(DATA_FILE, low_memory=False)
    df["zipcode"] = df["zipcode"].astype(str)

    metrics.update({
        "mae":   50448,
        "rmse":  int(RESIDUAL_STD),
        "r2":    0.8953,
        "rows":  len(df),
    })

    print(f"Ready — {len(df):,} Houston listings loaded.")


# ── Mortgage helpers ─────────────────────────────────────────────────────────
def _monthly_pi(price: float, down: float) -> float:
    loan = max(0.0, price - down)
    r, n = INTEREST_RATE / 12, LOAN_YEARS * 12
    return loan * (r * (1 + r) ** n) / ((1 + r) ** n - 1)

def _total_monthly(price: float, down: float) -> float:
    return _monthly_pi(price, down) + price * (PROPERTY_TAX + INSURANCE) / 12

def _budget_from_rent(rent: float, down: float) -> float:
    r, n = INTEREST_RATE / 12, LOAN_YEARS * 12
    return rent * ((1 + r) ** n - 1) / (r * (1 + r) ** n) + down

def _resolve_area(area: str):
    key = area.strip().lower()
    if key in NEIGHBORHOOD_MAP:
        return NEIGHBORHOOD_MAP[key], area.title()
    if area.strip().isdigit() and len(area.strip()) == 5:
        return [area.strip()], f"Zip {area.strip()}"
    fuzzy = [k for k in NEIGHBORHOOD_MAP if key in k or k in key]
    if fuzzy:
        return NEIGHBORHOOD_MAP[fuzzy[0]], fuzzy[0].title()
    return None, area


# ── Feature builder ──────────────────────────────────────────────────────────
def _build_row(
    beds, baths, sqft_living,
    lot_sqft=None, days_on_zillow=30,
    rent_zestimate=None, tax_assessed=None,
    lat=29.76, lon=-95.37,
    home_type="SINGLE_FAMILY",
) -> pd.DataFrame:
    ht = home_type.upper()
    return pd.DataFrame([{
        "beds":           float(beds),
        "baths":          float(baths),
        "sqft_living":    float(sqft_living),
        "lot_sqft":       float(lot_sqft)       if lot_sqft       is not None else np.nan,
        "days_on_zillow": float(days_on_zillow),
        "rent_zestimate": float(rent_zestimate)  if rent_zestimate is not None else np.nan,
        "tax_assessed":   float(tax_assessed)    if tax_assessed   is not None else np.nan,
        "lat":            float(lat),
        "lon":            float(lon),
        "log_sqft":       np.log1p(float(sqft_living)),
        "beds_per_bath":  float(beds) / (float(baths) + 0.001),
        "total_rooms":    float(beds) + float(baths),
        "is_single_fam":  int(ht == "SINGLE_FAMILY"),
        "is_condo":       int(ht == "CONDO"),
        "is_townhouse":   int(ht == "TOWNHOUSE"),
    }])


# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Houston HomeLens API",
    description="AI-powered Houston housing market intelligence — 2024 data",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ──────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    beds:           float          = Field(3,               example=3)
    baths:          float          = Field(2,               example=2)
    sqft_living:    float          = Field(1800,            example=1800)
    home_type:      str            = Field("SINGLE_FAMILY", example="SINGLE_FAMILY")
    lat:            float          = Field(29.76,           example=29.76)
    lon:            float          = Field(-95.37,          example=-95.37)
    lot_sqft:       Optional[float]= Field(None,            example=6000)
    days_on_zillow: Optional[float]= Field(30,              example=30)
    rent_zestimate: Optional[float]= Field(None,            example=1800)
    tax_assessed:   Optional[float]= Field(None,            example=280000)

class RentToOwnRequest(BaseModel):
    monthly_rent: float = Field(2000,    example=2000)
    down_payment: float = Field(20000,   example=20000)
    area:         str   = Field("77008", example="77008",
                                description="Zip code or neighborhood name e.g. 'heights', 'katy'")
    n_results:    int   = Field(10,      example=10)

class ComparablesRequest(BaseModel):
    beds:        float = Field(3,               example=3)
    sqft_living: float = Field(1800,            example=1800)
    home_type:   str   = Field("SINGLE_FAMILY", example="SINGLE_FAMILY")
    n:           int   = Field(8,               example=8)


# ── Routes ───────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def health():
    return {
        "status":    "ok",
        "model":     "HistGradientBoosting",
        "data":      "Houston 2024 active listings",
        "metrics":   metrics,
        "endpoints": [
            "GET  /",
            "POST /predict",
            "POST /rent-to-own",
            "POST /comparables",
            "GET  /docs",
        ],
    }


@app.post("/predict", tags=["Model"])
def predict(req: PredictRequest):
    """
    Predict a Houston home's market value.
    Returns predicted price and a confidence range (±1 RMSE).
    """
    try:
        X         = _build_row(
            req.beds, req.baths, req.sqft_living,
            req.lot_sqft, req.days_on_zillow,
            req.rent_zestimate, req.tax_assessed,
            req.lat, req.lon, req.home_type,
        )
        predicted = float(model.predict(X)[0])
        low       = max(0.0, predicted - RESIDUAL_STD)
        high      = predicted + RESIDUAL_STD

        return {
            "predicted_price":  round(predicted),
            "low_estimate":     round(low),
            "high_estimate":    round(high),
            "confidence_range": f"${low:,.0f} – ${high:,.0f}",
            "inputs":           req.dict(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/rent-to-own", tags=["Tools"])
def rent_to_own(req: RentToOwnRequest):
    """
    Find Houston listings where mortgage payment matches your rent.
    Each listing is classified by the ML model as:
      GOOD_BUY  — within budget and fairly priced
      NEGOTIATE — slightly over asking but model says worth less
      OVERPRICED — within budget but model flags as overpriced
    """
    try:
        budget       = _budget_from_rent(req.monthly_rent, req.down_payment)
        budget_slack = budget * 1.10

        zips, label = _resolve_area(req.area)
        subset = df[df["zipcode"].isin(zips)].copy() if zips else df.copy()
        subset = subset[(subset["price"] <= budget_slack) & (subset["price"] > 0)].copy()

        if len(subset) == 0:
            return {
                "budget":  round(budget),
                "area":    label,
                "results": [],
                "message": "No listings found. Try a different area or higher rent.",
            }

        subset["predicted"]     = model.predict(subset[FEATURES])
        subset["monthly_pi"]    = subset["price"].apply(lambda p: _monthly_pi(p, req.down_payment))
        subset["monthly_total"] = subset["price"].apply(lambda p: _total_monthly(p, req.down_payment))
        subset["delta_pct"]     = (
            (subset["price"] - subset["predicted"]) / subset["predicted"] * 100
        ).round(1)

        def classify(row):
            over = (row["price"] - row["predicted"]) / row["predicted"]
            if   row["price"] <= budget and over <= 0.10: return "GOOD_BUY"
            elif row["price"] <= budget and over >  0.10: return "OVERPRICED"
            elif row["price"] >  budget and row["predicted"] <= budget: return "NEGOTIATE"
            return "OTHER"

        subset["tier"] = subset.apply(classify, axis=1)

        keep_cols = [
            "address", "price", "predicted", "delta_pct", "tier",
            "beds", "baths", "sqft_living", "zipcode",
            "monthly_pi", "monthly_total",
        ]
        if "detail_url" in subset.columns:
            keep_cols.append("detail_url")

        results = (
            subset[subset["tier"] != "OTHER"]
            .nlargest(req.n_results, "sqft_living")
            [keep_cols]
            .round(0)
            .fillna("")
            .to_dict(orient="records")
        )

        return {
            "monthly_rent":   req.monthly_rent,
            "down_payment":   req.down_payment,
            "budget":         round(budget),
            "search_ceiling": round(budget_slack),
            "area":           label,
            "tier_summary":   subset[subset["tier"] != "OTHER"]["tier"].value_counts().to_dict(),
            "total_found":    len(subset[subset["tier"] != "OTHER"]),
            "results":        results,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/comparables", tags=["Tools"])
def comparables(req: ComparablesRequest):
    """
    Find similar active Houston listings by beds, sqft, and home type.
    """
    try:
        mask = (
            df["beds"].between(req.beds - 1, req.beds + 1) &
            df["sqft_living"].between(req.sqft_living * 0.80, req.sqft_living * 1.20) &
            df["home_type"].isin([req.home_type.upper()])
        )
        pool  = df[mask]
        comps = pool.sample(min(req.n, len(pool)), random_state=RANDOM_STATE)

        keep_cols = ["address", "price", "beds", "baths", "sqft_living", "zipcode", "days_on_zillow"]
        if "detail_url" in comps.columns:
            keep_cols.append("detail_url")

        return {
            "query":   req.dict(),
            "count":   len(comps),
            "results": comps[keep_cols].round(0).fillna("").to_dict(orient="records"),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    load()
    port = int(os.environ.get("PORT", 8000))
    print("\n  Houston HomeLens API")
    print("  ─────────────────────────────────────")
    print(f"  Local : http://localhost:{port}")
    print(f"  Docs  : http://localhost:{port}/docs")
    print("  ─────────────────────────────────────\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
