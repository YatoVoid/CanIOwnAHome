"""Split the Houston Zillow CSV into per-zip JSON files the site reads at runtime.

Usage: python3 -I scripts/build-listings.py <houston_housing.csv> [out_dir]

Writes <out_dir>/<zip>.json (compact rows, cheapest first) and <out_dir>/meta.json
({"ids": {listing id: zip}, "zips": {zip: [lat, lng]}}), so a request only loads
the zips it needs.
"""
import ast
import csv
import json
import os
import re
import sys
from collections import defaultdict

MAX_PHOTOS = 12
KEEP_TYPES = {"SINGLE_FAMILY", "CONDO", "TOWNHOUSE", "MULTI_FAMILY", "MANUFACTURED"}
PHOTO_RE = re.compile(r"/fp/([0-9a-f]{32})-")


def num(v):
    try:
        f = float(v)
        return f if f == f else None
    except (TypeError, ValueError):
        return None


def main(src, out_dir):
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
        if not price or price < 10_000:
            continue
        try:
            photos = [PHOTO_RE.search(p["url"]).group(1) for p in ast.literal_eval(row["carouselPhotos"] or "[]")]
        except (ValueError, SyntaxError, AttributeError, TypeError):
            photos = []
        if not photos and row.get("imgSrc"):
            m = PHOTO_RE.search(row["imgSrc"])
            photos = [m.group(1)] if m else []
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

    os.makedirs(out_dir, exist_ok=True)
    for name in os.listdir(out_dir):
        if name.endswith(".json"):
            os.remove(os.path.join(out_dir, name))

    meta = {"ids": {}, "zips": {}}
    for zip_code, homes in by_zip.items():
        if not re.fullmatch(r"\d{5}", zip_code):
            continue
        homes.sort(key=lambda h: h["p"])
        with open(os.path.join(out_dir, f"{zip_code}.json"), "w") as f:
            json.dump(homes, f, separators=(",", ":"))
        located = [h for h in homes if h["la"] is not None and h["lo"] is not None]
        if located:
            meta["zips"][zip_code] = [
                round(sum(h["la"] for h in located) / len(located), 5),
                round(sum(h["lo"] for h in located) / len(located), 5),
            ]
        for h in homes:
            meta["ids"][h["id"]] = zip_code

    with open(os.path.join(out_dir, "meta.json"), "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    print(f"{len(meta['ids'])} listings across {len(by_zip)} zips -> {out_dir}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "data/listings")
