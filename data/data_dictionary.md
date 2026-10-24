# Proximity — Data Dictionary (Device B outputs)

Produced by `clean.py` and `model.py` from the supplied `Tuberculosis_DS.zip`, plus `add_fhsis_2019.py` for 2019 from the DOH FHSIS 2019 annual report (`FHSIS2019.pdf`). All CSVs are UTF-8, comma-separated, with headers exactly as in the shared data contract. Missing CSV values are empty fields; missing JSON values are `null`.

## Scope and definitions

- **Geography:** National Capital Region (NCR / Metro Manila) only. There are 18 units: the NCR region total (`geo_level = region`) and its 17 LGUs, which are 16 cities plus the Municipality of Pateros (`geo_level = city_municipality`).
- **Geographic levels present:** `region`, `city_municipality`. **Not present:** `province` (NCR has no provinces) and `barangay` (no barangay-level TB data was supplied).
- **Geographic codes:** 10-digit PSGC codes, stored as strings. The 2024 and 2025 workbooks carry PSGC codes directly. The 2018–2023 sources have names only, so names were matched to the 2025 PSGC codes. The match ignores case and accents and treats "Malabon City" and "City of Malabon" as the same, for example. All 17 LGUs matched in every year.
- **Reporting period:** calendar year. `period_type = annual`, `period_start = YYYY-01-01`, `period_end = YYYY-12-31`.
- **How period and level were determined:** each used sheet's title states a single year (e.g. "Philippines, 2018", "Philippines, Annual 2025"), and its columns are yearly totals with no month or quarter breakdown. Geographic level comes from the sheet's own hierarchy: the NCR row is the region total, and the rows beneath it are its cities and Pateros.
- **Years present:** 2018–2025. 2019 was not in the zip; it comes from Table 1.E.4.1 of the FHSIS 2019 report PDF (title "Philippines, 2019").
- **Default display year 2025:** fully supported by `FINAL Tuberculosis_EB_2025.xlsx`, sheet `Annual`.
- **Coordinates and overcrowding:** not present in any supplied file. None were created.
- **What predictions are not:** `tb_predictions.csv` holds LGU-level aggregate notification-rate forecasts. They do not detect or measure TB transmission, do not diagnose individuals, and do not identify or prove TB hotspots. No overcrowding data was available, so no claim is made that overcrowding predicts TB cases.

## Source workbooks and sheets

| Year | source_file | source_sheet | Columns used |
|---|---|---|---|
| 2018 | ID TB 2018.xlsx | Table 2H.1 | Area, Population, TB Notified (All Forms) |
| 2019 | FHSIS2019.pdf | Table 1.E.4.1 | Area, Total Population, Notified TB cases all forms – Total (PDF page 478) |
| 2020 | ID TB 2020.xlsx | TB Table 1 | Area, Total Population, Notified TB cases all forms – Total |
| 2021 | ID TB 2021.xlsx | TB Table 1 | same as 2020 |
| 2022 | ID TB 2022.xlsx | Copy of cnr All Forms | same as 2020 |
| 2023 | ID TB 2023.xlsx | Copy of Copy of cnr All Forms | Area, Total Population, Notified TB cases all forms – Total (Male+Female+Unknown) |
| 2024 | Tuberculosis_EB 2024.xlsx | CNR | PSGC, Area, Total Population, Notified TB, All Forms – Total |
| 2025 | FINAL Tuberculosis_EB_2025.xlsx | Annual | PSGC 10, Region/Province/City/Municipality, Projected Population (All Ages), No. of notified TB cases, all forms – Total |

**Not used:** drug-resistant TB, treatment success rate (TSR), TB preventive treatment (TPT), testing (`Annual_tested`), the age-sex `Population` sheet, and the 2018 tables 2H.2–2H.6. These measure different things from the contract's `case_count`.

## Cleaning: record counts and handling rules

`clean.py` writes these counts to `cleaning_log.txt` on every run.

| Source sheet | Non-empty rows in sheet | Rows kept |
|---|---|---|
| ID TB 2018.xlsx / Table 2H.1 | 202 | 18 |
| FHSIS2019.pdf / Table 1.E.4.1 | NCR block only | 18 |
| ID TB 2020.xlsx / TB Table 1 | 207 | 18 |
| ID TB 2021.xlsx / TB Table 1 | 208 | 18 |
| ID TB 2022.xlsx / Copy of cnr All Forms | 208 | 18 |
| ID TB 2023.xlsx / Copy of Copy of cnr All Forms | 149 | 18 |
| Tuberculosis_EB 2024.xlsx / CNR | 1750 | 18 |
| FINAL Tuberculosis_EB_2025.xlsx / Annual | 1753 | 18 |
| **Total** | | **144** |

- **Why rows were dropped:** the sheets cover the whole Philippines and include titles, headers, legends and footnotes. Only the NCR region row and its 17 LGU rows are kept. No NCR row was dropped.
- **Year check:** each sheet's title must name the year assigned to it, and no other year. The run stops if this fails.
- **Invalid values:** a negative or non-whole case count, or a population of zero or less, is left empty and logged. None occurred.
- **Rate rule:** `case_rate_per_100k` is calculated only when both the count and a positive population from the same row exist.
- **Duplicates:** the run stops if any (year, geo_code) pair or record_id repeats. None occurred.
- **Levels:** the region total and LGU rows are different `geo_level`s. They must not be summed together.
- **No synthetic rows:** no monthly, quarterly or barangay rows are created.

## File 1: `cleaned_tb_data.csv` (144 rows = 18 units × 8 years)

Every row is an **observed** record. No row contains a prediction. Source columns per year are listed in "Source workbooks and sheets" above.

| Field | Type | Meaning / unit | Kind | Source or derivation | Missing values | Period / geography assumptions |
|---|---|---|---|---|---|---|
| record_id | string | Unique row key `{year}-{geo_code}-annual` | identifier | Built from year and geo_code | Never empty | One row per unit per year |
| year | integer | Reporting calendar year | observed | Year stated in the sheet title (checked on every run) | Never empty | 2018–2025 |
| period_start | date YYYY-MM-DD | First day of the reporting year | calculated | `{year}-01-01` | Never empty | Annual reporting only |
| period_end | date YYYY-MM-DD | Last day of the reporting year | calculated | `{year}-12-31` | Never empty | Annual reporting only |
| period_type | string | Reporting frequency, always `annual` | definition | Sheets report calendar-year totals only | Never empty | No monthly or quarterly data exists |
| geo_level | string | `region` (NCR total) or `city_municipality` (LGU) | definition | Row's position in the source hierarchy | Never empty | Do not sum region and LGU rows together |
| geo_code | string | 10-digit PSGC code, leading zeros kept. NCR = `1300000000` | identifier | 2024–2025: PSGC column in source. 2018–2023: name matched to 2025 PSGC | Never empty | Join key for maps and predictions |
| geo_name | string | Standardized name, e.g. "City of Caloocan"; region row = "National Capital Region (NCR)" | identifier | 2025 workbook spelling | Never empty | NCR only |
| province | string | Province name | unavailable | NCR has no provinces | Always empty | — |
| city_municipality | string | LGU name | identifier | Same as geo_name for LGU rows | Empty on region rows | NCR's 16 cities + Pateros |
| barangay | string | Barangay name | unavailable | No barangay-level data in any workbook | Always empty | — |
| case_count | integer | Notified TB cases, all forms, in the year (cases) | **observed** | Source "notified TB all forms" total column | Empty if source blank, negative or non-whole (none occurred) | 2024 labelled "New and Relapse" |
| population | number | Projected population (persons) used by the source as the denominator | observed (source projection) | Source population column, same row. Whole numbers written without decimals; fractional projections kept to 2 decimals | Empty if blank or ≤ 0 (none occurred) | Same area and year as case_count |
| case_rate_per_100k | number | Case notification rate (cases per 100,000 population) | **calculated** | `case_count / population × 100000`, 4 decimals | Empty if either input is empty | Same area and year |
| source_file | string | Workbook filename inside the supplied zip | provenance | — | Never empty | — |
| source_sheet | string | Worksheet name | provenance | — | Never empty | — |

**Validation performed:**
- In every year, the 17 LGU case counts sum exactly to the workbook's NCR total row.
- The calculated rates match the workbook's own CNR column to within 0.5 per 100k, with one exception (2019 checked the same way, no exceptions). For City of Manila in 2024 the calculated rate is 764.42 and the source shows 765.49. The calculated value is kept.

**Known data caveats:**
- **Makati and Taguig denominators:** both change sharply between 2023 and 2024. Makati falls from about 638k to about 298k and Taguig rises from about 917k to about 1.27M. This is consistent with the transfer of the EMBO barangays from Makati to Taguig. Rates for these two cities are not comparable across 2023 and 2024.
- **COVID-19:** 2020–2021 notifications are depressed by COVID-era service disruption.
- **2024 label difference:** the 2024 workbook labels counts as "Notified TB, All Forms (New and Relapse)", while the other years say "all forms". The files don't say whether the definition actually differs. The values are used as supplied.
- **Notification is not incidence:** these are notified cases, which reflect case-finding effort as well as disease burden.

## File 2: `tb_predictions.csv` (17 rows)

Every row is a **model prediction** produced by running `model.py`. These are not observations.

| Field | Type | Meaning / unit | Kind | Source or derivation | Missing values | Period / geography assumptions |
|---|---|---|---|---|---|---|
| prediction_id | string | Unique key `2026-{geo_code}-case_rate_per_100k` | identifier | Built from target year, geo_code and target | Never empty | — |
| generated_at | timestamp ISO 8601 (UTC) | When this model run happened | metadata | System clock at run time | Never empty | — |
| target_period_start | date YYYY-MM-DD | Start of predicted period, `2026-01-01` | metadata | Last observed year + 1 | Never empty | One year ahead |
| target_period_end | date YYYY-MM-DD | End of predicted period, `2026-12-31` | metadata | Last observed year + 1 | Never empty | One year ahead |
| target_period_type | string | `annual` | metadata | Matches observed frequency | Never empty | No monthly predictions |
| geo_level | string | `city_municipality` | metadata | Model level | Never empty | No NCR-total, barangay or non-NCR predictions |
| geo_code | string | 10-digit PSGC, same codes as File 1 | identifier | From File 1 | Never empty | Join key to File 1 |
| geo_name | string | Same names as File 1 | identifier | From File 1 | Never empty | — |
| target_variable | string | `case_rate_per_100k` | metadata | Same definition as File 1 | Never empty | — |
| predicted_value | number | Predicted 2026 notified TB rate (cases per 100,000) | **predicted** | `rate_2025 × exp(coef × (log rate_2025 − NCR mean log rate_2025))`; coef fitted by ridge | Never empty for exported rows | Assumes 2026 resembles past year-to-year change |
| prediction_unit | string | `cases per 100,000 population` (contains a comma; quote-aware CSV parsing needed) | metadata | — | Never empty | — |
| model_name | string | `ridge_mean_reversion_log_ratio` | metadata | model.py | Never empty | — |
| model_version | string | `1.0.0`; run ID is in model_evaluation.json notes | metadata | model.py | Never empty | — |
| training_data_end | date YYYY-MM-DD | `2025-12-31`, last observed period used | metadata | Last year in File 1 | Never empty | — |
| lower_bound | number | Lower end of approx. 80% interval (cases per 100,000) | **predicted** | `predicted_value × exp(10th pct of out-of-sample log errors)` | Never empty for exported rows | Empirical, not calibrated |
| upper_bound | number | Upper end of the same interval | **predicted** | Same, 90th percentile | Never empty for exported rows | Empirical, not calibrated |

**Not predicted:**
- **2026 case counts:** no 2026 population projection was supplied, so counts cannot be derived.
- **The NCR total, barangays and other regions:** outside the model's supported scope.

## File 4: `model_evaluation.json`

This follows the contract structure exactly, with `status = completed`. It records:
- the actual rolling-origin metrics for the model and the persistence baseline
- the features used and the columns excluded
- the limitations, including that **the model does not beat the persistence baseline**
- per-year results, recorded in `notes`
