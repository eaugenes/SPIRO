"""Step 2: train/evaluate, write output/tb_predictions.csv and output/model_evaluation.json."""
import sys, json, hashlib, datetime as dt
import numpy as np, pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

OUT = sys.argv[1]
PRED_HEADER = ["prediction_id","generated_at","target_period_start","target_period_end","target_period_type",
               "geo_level","geo_code","geo_name","target_variable","predicted_value","prediction_unit",
               "model_name","model_version","training_data_end","lower_bound","upper_bound"]
MODEL_NAME, MODEL_VERSION, ALPHA = "ridge_mean_reversion_log_ratio", "1.0.0", 5.0
FEATS = ["log_rate_dev_from_ncr_mean_lag1"]
BREAKS = {("1380300000", 2024), ("1381500000", 2024)}  # Makati, Taguig denominator change 2023->2024

d = pd.read_csv(f"{OUT}/cleaned_tb_data.csv", dtype={"geo_code": str})
d = d[d.geo_level == "city_municipality"]
R = d.pivot(index="geo_code", columns="year", values="case_rate_per_100k")
names = d.drop_duplicates("geo_code").set_index("geo_code").geo_name

def feat(t_prev):
    l = np.log(R[t_prev]); return l - l.mean()

rows = []
for t in sorted(R.columns):
    if t - 1 not in R.columns: continue          # only consecutive-year pairs
    f = feat(t - 1)
    for g in R.index:
        if (g, t) in BREAKS: continue
        rows.append({"geo_code": g, "t": t, FEATS[0]: f[g], "prev": R.loc[g, t - 1], "actual": R.loc[g, t],
                     "y": np.log(R.loc[g, t] / R.loc[g, t - 1])})
D = pd.DataFrame(rows)

# rolling-origin validation: for each test year T, train only on target years < T
TEST_YEARS = [2023, 2024, 2025]
oof = []
for T in TEST_YEARS:
    tr, te = D[D.t < T], D[D.t == T]
    m = Ridge(alpha=ALPHA, fit_intercept=False).fit(tr[FEATS], tr.y)
    te = te.assign(pred=te.prev * np.exp(m.predict(te[FEATS])), n_train=len(tr))
    oof.append(te)
O = pd.concat(oof)
def mets(p, a):
    return {"mae": round(float(mean_absolute_error(a, p)), 3),
            "rmse": round(float(np.sqrt(mean_squared_error(a, p))), 3),
            "r2": round(float(r2_score(a, p)), 4)}
model_m, base_m = mets(O.pred, O.actual), mets(O.prev, O.actual)
per_year = {int(T): {"model": mets(g.pred, g.actual), "persistence": mets(g.prev, g.actual),
                     "train_rows": int(g.n_train.iloc[0]), "test_rows": int(len(g))} for T, g in O.groupby("t")}
resid = np.log(O.actual / O.pred)
q_lo, q_hi = np.quantile(resid, 0.10), np.quantile(resid, 0.90)

# final model: all transitions through 2025 -> predict 2026
final = Ridge(alpha=ALPHA, fit_intercept=False).fit(D[FEATS], D.y)
f25 = feat(2025)
now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
RUN_ID = now + "_" + hashlib.sha256(open(f"{OUT}/cleaned_tb_data.csv", "rb").read()).hexdigest()[:12]
preds = []
for g in R.index:
    p = float(R.loc[g, 2025] * np.exp(final.coef_[0] * f25[g]))
    preds.append({"prediction_id": f"2026-{g}-case_rate_per_100k", "generated_at": now,
        "target_period_start": "2026-01-01", "target_period_end": "2026-12-31", "target_period_type": "annual",
        "geo_level": "city_municipality", "geo_code": g, "geo_name": names[g],
        "target_variable": "case_rate_per_100k", "predicted_value": round(p, 2), "prediction_unit": "cases per 100,000 population",
        "model_name": MODEL_NAME, "model_version": MODEL_VERSION, "training_data_end": "2025-12-31",
        "lower_bound": round(p * np.exp(q_lo), 2), "upper_bound": round(p * np.exp(q_hi), 2)})
pd.DataFrame(preds)[PRED_HEADER].to_csv(f"{OUT}/tb_predictions.csv", index=False, encoding="utf-8")

beats = model_m["mae"] < base_m["mae"]
YRS = sorted(int(y) for y in R.columns)
missing = sorted(set(range(YRS[0], YRS[-1] + 1)) - set(YRS))
ev = {
 "status": "completed",
 "target_variable": "case_rate_per_100k",
 "prediction_horizon": "1 year ahead (annual notified TB case rate, all forms)",
 "geographic_level": "city_municipality",
 "feature_columns": FEATS + ["case_rate_per_100k_lag1 (persistence anchor; offset, not a fitted coefficient)"],
 "excluded_columns": ["record_id","period_start","period_end","period_type","province","barangay",
                      "population (used only as the rate denominator)","case_count (used only via the rate)",
                      "source_file","source_sheet","geo_name","geo_code (identifier only)"],
 "model_name": MODEL_NAME,
 "baseline_name": "persistence (predict previous year's observed case_rate_per_100k)",
 "validation_method": "Rolling-origin (expanding window) by year: for each test year in 2023, 2024, 2025, train on all consecutive-year transitions with target year < test year; metrics pooled over the three test years on the case_rate_per_100k scale.",
 "training_rows": int(len(D)),
 "testing_rows": int(len(O)),
 "metrics": model_m,
 "baseline_metrics": base_m,
 "limitations": [
  "Very small dataset: 17 NCR LGUs x %d observed years (%d-%d%s), so only %d consecutive-year transitions exist (%d modelling rows after exclusions)." % (
   len(YRS), YRS[0], YRS[-1], "; missing: " + ", ".join(map(str, missing)) if missing else "", D.t.nunique(), len(D)),
  ("The model does NOT outperform the persistence baseline on pooled MAE; predictions should be treated as roughly equivalent to 'next year looks like this year, nudged slightly toward the NCR average'." if not beats else
   "The model only marginally outperforms the persistence baseline on pooled MAE across just three test years; the difference is not statistically established."),
  "Model configuration (no intercept, single mean-reversion feature, alpha=5) was chosen after comparing several Ridge variants on the same 2023-2025 test years, so reported metrics are optimistic. Ridge models with an intercept or lagged-growth features performed substantially worse than persistence.",
  "2020-2022 notifications were heavily disrupted by COVID-19 (drop then rebound); these transitions are in the training data and the model cannot represent such shocks.",
  "Makati and Taguig population denominators change sharply between 2023 and 2024 (Makati ~638k -> ~298k; Taguig ~917k -> ~1.27M), consistent with the Makati-Taguig EMBO barangay jurisdiction change; the 2023->2024 transitions for these two LGUs are excluded from training and evaluation.",
  "Predicts notified case rate (a measure of detection/reporting as well as disease burden), not true incidence. Changes in case-finding effort change the target.",
  "No 2026 population projection was supplied, so case counts are not predicted; only rates are exported.",
  "No barangay-level data and no overcrowding/occupancy data exist in the supplied files; the model uses no such features.",
  "Scope: predictions are LGU-level aggregate notification rates only. They do not detect or measure TB transmission, do not diagnose individuals, and do not identify or prove TB hotspots; overcrowding is not used and no claim is made that it predicts TB cases.",
  "Prediction intervals (lower_bound/upper_bound) are empirical 10th-90th percentile ranges of out-of-fold log-ratio residuals (n=%d); they are approximate 80%% intervals, not calibrated guarantees." % len(O)],
 "notes": [
  "Model: Ridge regression (scikit-learn, alpha=5, fit_intercept=False). Target = log(rate_t / rate_{t-1}). Feature = log(rate_{t-1}) minus the NCR cross-LGU mean of log(rate_{t-1}). Prediction = rate_{t-1} * exp(coef * feature).",
  "Final fitted coefficient on the mean-reversion feature: %.4f (negative = LGUs above the NCR average are predicted to move toward it)." % final.coef_[0],
  "Final model trained on all %d transitions with target years %d-%d; predictions are for calendar year 2026 for the 17 NCR LGUs only. NCR region-level, barangay-level and other periods are not predicted." % (len(D), D.t.min(), D.t.max()),
  "Per-test-year results: " + json.dumps(per_year),
  "Observed data source: case_rate_per_100k in cleaned_tb_data.csv (notified TB, all forms / projected population x 100,000).",
  "Run identifier: %s (generated_at plus the first 12 hex digits of the SHA-256 of the input cleaned_tb_data.csv). The fitted model is not saved as a file: it has one coefficient (above) and is reproduced exactly by re-running model.py on the same input." % RUN_ID,
  "Generated at %s." % now]
}
json.dump(ev, open(f"{OUT}/model_evaluation.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(json.dumps({"model": model_m, "baseline": base_m, "per_year": per_year, "coef": final.coef_.tolist(),
                  "q": [q_lo, q_hi], "rows": len(D)}, indent=1))
