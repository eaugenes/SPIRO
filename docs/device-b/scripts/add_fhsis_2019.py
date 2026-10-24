"""Step 1b: add the 2019 NCR rows to output/cleaned_tb_data.csv from the FHSIS 2019 annual report PDF.

2019 was not in Tuberculosis_DS.zip. The DOH FHSIS 2019 report (FHSIS2019.pdf) has it in
Table 1.E.4.1 "Case Notification Rate (All forms), Philippines, 2019". Needs pdftotext (poppler)
on PATH; standard library only. Run after clean.py (clean.py rewrites the file without 2019):

    python3 add_fhsis_2019.py FHSIS2019.pdf output
"""
import sys, re, csv, subprocess

PDF, OUT = sys.argv[1], sys.argv[2]
CSV_PATH = f"{OUT}/cleaned_tb_data.csv"
YEAR, SRC_FILE, SRC_SHEET = 2019, "FHSIS2019.pdf", "Table 1.E.4.1"
NCR_CODE = "1300000000"

def key(s):
    # The PDF's font drops the ñ (Las Pi?as, Para?aque), so drop non-ASCII letters on both sides
    s = re.sub(r"\bcity of\b|\bcity\b", "", str(s).lower())
    return re.sub(r"[^a-z]", "", s)

def num(s): return int(s.replace(",", ""))

text = subprocess.run(["pdftotext", "-raw", PDF, "-"], capture_output=True, check=True).stdout.decode("utf-8", "replace")
pages = [p for p in text.split("\f") if "Table 1.E.4.1" in p and "N C R" in p]
if len(pages) != 1: sys.exit(f"Expected one Table 1.E.4.1 page with the NCR rows, found {len(pages)}")
page = pages[0]
if not re.search(r"PHILIPPINES,\s*2019\b", page) or re.search(r"\b20(1[0-8]|2\d)\b", page):
    sys.exit("Table title does not name 2019 alone")

# Area, Total Population, Male, Female, Total, CNR per 100,000
ROW = re.compile(r"^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d.]+)$")
lines = [l.strip() for l in page.splitlines()]
start = next(i for i, l in enumerate(lines) if l.startswith("N C R "))
src = []
for l in lines[start:]:
    if l.startswith("C A R "): break
    m = ROW.match(l)
    if not m: sys.exit(f"Unreadable NCR line: {l!r}")
    src.append((m[1], num(m[2]), num(m[5]), float(m[6])))

with open(CSV_PATH, encoding="utf-8", newline="") as f:
    old = list(csv.DictReader(f))
    header = list(old[0].keys())
if any(r["year"] == str(YEAR) for r in old): sys.exit(f"{CSV_PATH} already has {YEAR} rows")

# Names and PSGC codes come from the rows clean.py wrote (2025 workbook spelling)
canon = {key(r["geo_name"]): r for r in old if r["year"] == "2025" and r["geo_level"] == "city_municipality"}
new, lgu_sum = [], 0
for i, (name, pop, cases, src_rate) in enumerate(src):
    if i == 0:
        level, code, gname, city = "region", NCR_CODE, "National Capital Region (NCR)", ""
        ncr_total = cases
    else:
        c = canon.get(key(name))
        if not c: sys.exit(f"No PSGC match for {name!r}")
        level, code, gname, city = "city_municipality", c["geo_code"], c["geo_name"], c["geo_name"]
        lgu_sum += cases
    rate = round(cases / pop * 100000, 4)
    if abs(rate - src_rate) > 0.5: sys.exit(f"{name}: calculated rate {rate} vs source {src_rate}")
    new.append({"record_id": f"{YEAR}-{code}-annual", "year": YEAR, "period_start": f"{YEAR}-01-01",
                "period_end": f"{YEAR}-12-31", "period_type": "annual", "geo_level": level, "geo_code": code,
                "geo_name": gname, "province": "", "city_municipality": city, "barangay": "", "case_count": cases,
                "population": pop, "case_rate_per_100k": rate, "source_file": SRC_FILE, "source_sheet": SRC_SHEET})

if len(new) != 18 or len({r["geo_code"] for r in new}) != 18: sys.exit(f"Expected 18 distinct NCR units, got {len(new)}")
if lgu_sum != ncr_total: sys.exit(f"LGU cases sum to {lgu_sum}, NCR total row says {ncr_total}")

rows = sorted(old + new, key=lambda r: int(r["year"]))   # stable: keeps each year's row order
with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=header, lineterminator="\r\n")
    w.writeheader(); w.writerows(rows)
print(f"Added {len(new)} rows for {YEAR} (NCR total {ncr_total:,} cases; LGUs sum to the same). {len(rows)} rows now.")
