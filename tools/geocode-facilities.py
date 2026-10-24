"""Place TB-DOTS facilities that have no map position, using OpenStreetMap Nominatim.

    python -I tools/geocode-facilities.py              # City of Manila (default)
    python -I tools/geocode-facilities.py --city qc    # another city id from facilities.csv
    python -I tools/geocode-facilities.py --dry-run    # look up and report, change nothing

Only rows with an empty lat/lng in data/facilities/facilities.csv are looked up. For each one,
the most precise answer that lies inside the city's boundary (data/geo/ncr-cities.geojson) wins:

  1. place     the facility itself, found in OpenStreetMap by its name
  2. street    the first street of the listed address, in the listed district
  3. barangay  the barangay number in the address ("BRGY 884")
  4. district  the listed district ("TONDO, MANILA"), as a last resort

The result is written to facilities.csv (lat, lng, position_precision, barangay_psgc_2023,
how_located) and to facilities.json (lat, lng, b, mt and pp = precision), which the site loads.
Nominatim's usage policy allows at most 1 request per second with an identifying User-Agent;
answers are cached in tools/geocode-cache.json so a rerun does not ask again.
"""
import argparse, csv, json, re, sys, time, unicodedata, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data/facilities/facilities.csv"
JSON_PATH = ROOT / "data/facilities/facilities.json"
GEO_PATH = ROOT / "data/geo/ncr-cities.geojson"
CACHE_PATH = ROOT / "tools/geocode-cache.json"
URL = "https://nominatim.openstreetmap.org/search"
UA = "SPIRO-TB-map/1.0 (facility positions for a Metro Manila TB map)"

HEALTH_TYPES = {"hospital", "clinic", "doctors", "healthcare", "health_post", "health_centre", "health_center", "community_centre", "public_building", "townhall"}
GENERIC = {"health", "center", "centre", "hospital", "medical", "clinic", "inc", "and", "the", "of", "lying", "in", "general", "memorial", "manila", "city", "ng", "sa"}


def words(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return [w for w in re.split(r"[^a-z0-9]+", s) if w and w not in GENERIC and len(w) > 1]


def inside(lat, lng, geom):
    """Ray casting over every outer ring of a Polygon or MultiPolygon."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    hit = False
    for poly in polys:
        ring = poly[0]
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
            if (y1 > lat) != (y2 > lat) and lng < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                hit = not hit
    return hit


class Geocoder:
    def __init__(self, dry):
        self.cache = json.loads(CACHE_PATH.read_text(encoding="utf-8")) if CACHE_PATH.exists() else {}
        self.last = 0.0

    def search(self, q):
        if q in self.cache:
            return self.cache[q]
        wait = 1.1 - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        url = URL + "?" + urllib.parse.urlencode({"q": q, "format": "jsonv2", "limit": 5, "countrycodes": "ph", "addressdetails": 1})
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
            res = json.load(r)
        self.last = time.time()
        self.cache[q] = res
        CACHE_PATH.write_text(json.dumps(self.cache, ensure_ascii=False, indent=1), encoding="utf-8")
        return res


def district_of(muni):
    """'TONDO, MANILA' -> 'Tondo'; 'STA. ANA, MANILA' -> 'Santa Ana'."""
    d = muni.split(",")[0].strip().title()
    return re.sub(r"^Sta\.?\s", "Santa ", d)


def first_street(street):
    s = re.sub(r"\b(BRGY\.?|BARANGAY)\s*\d+.*$", "", street, flags=re.I)        # drop "BRGY 884 ..." tails
    s = re.split(r"\b(?:COR\.?|CORNER)\b|,", s, flags=re.I)[0]                    # first street of a corner
    s = re.sub(r"^\s*(\d+[-\w]*|BLOCK\s+\S+|INT\.?)\s+", "", s, flags=re.I)        # house number, "INT."
    s = re.sub(r"\bSTS?\.?$", "Street", s.strip(), flags=re.I)
    s = re.sub(r"\bAVE\.?$", "Avenue", s, flags=re.I)
    return s.strip().title() if len(s.strip()) > 2 else None


def barangay_no(street):
    m = re.search(r"\b(?:BRGY\.?|BARANGAY)\s*(\d{1,3})\b", street, flags=re.I) or re.search(r",\s*(\d{2,3})\s+ZONE\b", street, flags=re.I)
    return m.group(1) if m else None


def osm_barangay(res):
    a = res.get("address", {})
    for k in ("quarter", "neighbourhood", "suburb", "village"):
        if re.match(r"^Barangay \d+", a.get(k, "")):
            return a[k]
    m = re.search(r"Barangay \d+", res.get("display_name", ""))
    return m.group(0) if m else None


def locate(row, geo, geom):
    name, dist = row["facility_name"], district_of(row["municipality"])
    ok = lambda r: inside(float(r["lat"]), float(r["lon"]), geom)
    want = set(words(name))
    # 1. the facility itself, by name
    for q in (f"{name}, {dist}, Manila", f"{name}, Manila"):
        for r in geo.search(q):
            got = set(words(r.get("name") or r["display_name"].split(",")[0]))
            if ok(r) and r.get("type") in HEALTH_TYPES and want and want <= got:
                return r, "place", f"OpenStreetMap: the facility itself, found by name ({r['type']})"
    # 2. the first street of the address, in the district
    st = first_street(row["street"])
    if st:
        for r in geo.search(f"{st}, {dist}, Manila"):
            if ok(r) and r.get("category") == "highway" and set(words(st)) <= set(words(r.get("name") or "")):
                return r, "street", f"OpenStreetMap: {r.get('name')}, the first street in the address"
    # 3. the barangay number in the address
    no = barangay_no(row["street"])
    if no:
        for r in geo.search(f"Barangay {no}, {dist}, Manila") + geo.search(f"Barangay {no}, Manila"):
            if ok(r) and (r.get("name") or "").strip() == f"Barangay {no}":
                return r, "barangay", f"OpenStreetMap: Barangay {no}, from the address"
    # 4. the district
    for r in geo.search(f"{dist}, Manila"):
        if ok(r) and r.get("category") in ("boundary", "place"):
            return r, "district", f"OpenStreetMap: centre of {dist} district (no closer match)"
    return None, None, "not found in OpenStreetMap"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="manila")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    geom = next(f["geometry"] for f in json.loads(GEO_PATH.read_text(encoding="utf-8"))["features"] if f["properties"]["id"] == args.city)
    with CSV_PATH.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        fields, rows = reader.fieldnames, list(reader)
    todo = [r for r in rows if r["city_id"] == args.city and not r["lat"]]
    print(f"{len(todo)} facilities in {args.city} without a position")

    geo, found = Geocoder(args.dry_run), {}
    for r in todo:
        res, prec, how = locate(r, geo, geom)
        print(f"  {r['list_no']} {r['facility_name'][:44]:44} {prec or '-':9} {how}")
        if res:
            b = osm_barangay(res) or district_of(r["municipality"])
            found[int(r["list_no"])] = dict(lat=round(float(res["lat"]), 6), lng=round(float(res["lon"]), 6), prec=prec, b=b, how=how)

    counts = {p: sum(1 for v in found.values() if v["prec"] == p) for p in ("place", "street", "barangay", "district")}
    print(f"placed {len(found)} of {len(todo)}: {counts}")
    if args.dry_run or not found:
        return

    for r in rows:
        v = found.get(int(r["list_no"]))
        if v:
            r.update(lat=v["lat"], lng=v["lng"], position_precision={"place": "facility (OpenStreetMap)", "street": "street (OpenStreetMap)", "barangay": "barangay (OpenStreetMap)", "district": "district centre (OpenStreetMap)"}[v["prec"]],
                     barangay_psgc_2023=v["b"], how_located=v["how"])
    with CSV_PATH.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, lineterminator="\n")
        w.writeheader(); w.writerows(rows)

    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    for f in data["facilities"]:
        v = found.get(f["id"])
        if v:
            f.update(lat=v["lat"], lng=v["lng"], b=v["b"], mt=v["how"], pp=v["prec"])
    JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("updated", CSV_PATH.relative_to(ROOT), "and", JSON_PATH.relative_to(ROOT))


if __name__ == "__main__":
    sys.exit(main())
