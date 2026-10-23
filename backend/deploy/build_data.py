"""Builds listings.json (cleaned listings with model features) from the raw Zillow CSV."""
import ast
import json
import sys

import numpy as np
import pandas as pd

src, out = sys.argv[1], sys.argv[2]
raw = pd.read_csv(src, low_memory=False)


def info(s):
    try:
        return ast.literal_eval(s)["homeInfo"]
    except Exception:
        return {}


h = raw["hdpData"].map(info)
g = lambda k: h.map(lambda d: d.get(k))
ll = raw["latLong"].map(lambda s: ast.literal_eval(s) if isinstance(s, str) else {})
d = pd.DataFrame({
    "id": raw["zpid"], "address": raw["address"], "zipcode": raw["addressZipcode"].astype("Int64").astype(str),
    "price": pd.to_numeric(raw["unformattedPrice"], errors="coerce"),
    "beds": raw["beds"], "baths": raw["baths"], "sqft_living": raw["area"],
    "lot_sqft": pd.to_numeric(g("lotAreaValue"), errors="coerce"),
    "days_on_zillow": pd.to_numeric(g("daysOnZillow"), errors="coerce"),
    "rent_zestimate": pd.to_numeric(g("rentZestimate"), errors="coerce"),
    "tax_assessed": pd.to_numeric(g("taxAssessedValue"), errors="coerce"),
    "lat": ll.map(lambda x: x.get("latitude")), "lon": ll.map(lambda x: x.get("longitude")),
    "home_type": g("homeType"), "url": raw["detailUrl"], "photo": raw["imgSrc"],
})
d = d.dropna(subset=["price", "beds", "baths", "sqft_living", "lat", "lon"])
d = d[(d.price > 0) & (d.sqft_living > 0)].drop_duplicates("id")
d["days_on_zillow"] = d["days_on_zillow"].fillna(30)
d = d.astype(object).where(d.notna(), None)
rows = [{k: (round(v, 6) if isinstance(v, float) else (int(v) if isinstance(v, (np.integer,)) else v)) for k, v in r.items()}
        for r in d.to_dict("records")]
json.dump(rows, open(out, "w"), separators=(",", ":"))
print(f"{len(rows)} listings -> {out}")
