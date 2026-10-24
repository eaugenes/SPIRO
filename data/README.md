# data/

Data files the website reads. Do not edit them by hand and do not put test data here
(test fixtures live in `tests/fixtures/`).

| File | What it is | Made by |
|---|---|---|
| `cleaned_tb_data.csv` | Notified TB cases and population per NCR city, 2018–2025 (DOH FHSIS) | Data cleaning script (`docs/device-b/scripts/clean.py`); 2019 added from the FHSIS 2019 report PDF by `add_fhsis_2019.py` |
| `tb_predictions.csv` | 2026 predicted TB case rate per 100,000 per city | Model script (`docs/device-b/scripts/model.py`) |
| `model_evaluation.json` | Back-test results and limitations of that model | Data preparation |
| `data_dictionary.md` | Column definitions for the files above | Data preparation |
| `facilities/facilities.json` | The same facility records as JSON; this is the file the website loads | Converted from `facilities.csv` |
| `facilities/facilities.csv` | PhilHealth-accredited TB-DOTS facilities in NCR (list updated Sep 30, 2026) | Extracted from the PhilHealth PDF (`docs/tb-facilities.md`) |
| `places/besttime-malls.json` | NCR malls known to BestTime, with typical-week forecasts for those forecast so far; the Crowding layer uses only these | `tools/fetch-besttime.ps1` (see `docs/foot-traffic.md`) |

The map's fixed reference files are in `geo/` (NCR city boundaries, outline and label points, from PSA PSGC 2023) and `places/` (the 52 listed public places, which lend their names to the malls BestTime covers).
The columns of the four cleaned files are fixed by `docs/data-contract.md`; the site checks them on load and shows "missing" or "invalid" instead of guessing.
