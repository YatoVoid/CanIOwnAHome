"""Build data/mock-listings.json from the Houston Zillow CSV.

Usage: python3 -I scripts/build-mock-listings.py <houston_housing.csv> [out.json]

The mock model only needs a spread of prices per zip, so each zip keeps at most
PER_ZIP listings, evenly sampled across its price range.
"""
import ast
import csv
import json
import re
import sys
from collections import defaultdict

PER_ZIP = 45
MAX_PHOTOS = 12
KEEP_TYPES = {"SINGLE_FAMILY", "CONDO", "TOWNHOUSE", "MULTI_FAMILY", "MANUFACTURED"}
PHOTO_RE = re.compile(r"/fp/([0-9a-f]{32})-")


def num(v):
    try:
        f = float(v)
        return f if f == f else None
    except (TypeError, ValueError):
        return None


def main(src, out):
    csv.field_size_limit(10**9)
    by_zip = defaultdict(list)
    for row in csv.DictReader(open(src, newline="")):
        try:
            info = ast.literal_eval(row["hdpData"])["homeInfo"]
        except (ValueError, SyntaxError, KeyError):
            continue
        if info.get("homeType") not in KEEP_TYPES:
            continue
        price = num(info.get("price"))
        if not price or price < 40_000 or price > 1_500_000:
            continue
        try:
            photos = [PHOTO_RE.search(p["url"]).group(1) for p in ast.literal_eval(row["carouselPhotos"] or "[]")]
        except (ValueError, SyntaxError, AttributeError, TypeError):
            photos = []
        if not photos:
            continue
        lot = num(info.get("lotAreaValue"))
        if lot and info.get("lotAreaUnit") == "acres":
            lot *= 43_560
        by_zip[row["addressZipcode"]].append({
            "id": row["zpid"],
            "s": info.get("streetAddress") or row["addressStreet"],
            "c": info.get("city") or row["addressCity"],
            "z": row["addressZipcode"],
            "p": int(price),
            "bd": num(info.get("bedrooms")),
            "ba": num(info.get("bathrooms")),
            "sf": num(info.get("livingArea")),
            "lot": round(lot) if lot else None,
            "t": info["homeType"],
            "la": info.get("latitude"),
            "lo": info.get("longitude"),
            "ze": num(info.get("zestimate")),
            "rz": num(info.get("rentZestimate")),
            "tx": num(info.get("taxAssessedValue")),
            "dom": info.get("daysOnZillow"),
            "br": row.get("brokerName") or None,
            "u": row.get("detailUrl") or None,
            "ph": photos[:MAX_PHOTOS],
        })

    listings = []
    for homes in by_zip.values():
        homes.sort(key=lambda h: h["p"])
        if len(homes) > PER_ZIP:
            step = (len(homes) - 1) / (PER_ZIP - 1)
            homes = [homes[round(i * step)] for i in range(PER_ZIP)]
        listings.extend(homes)

    with open(out, "w") as f:
        json.dump(listings, f, separators=(",", ":"))
    print(f"{len(listings)} listings across {len(by_zip)} zips -> {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "data/mock-listings.json")
