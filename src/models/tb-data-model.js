/* =====================================================================
   TB data model: reads the shared data contract.

   The only TB source is data/cleaned_tb_data.csv, produced by
   the data preparation step and read by ContractLoader. It exports YEARS, yStatus, TB,
   tbVal, trendFor, TB_BREAKS and tbClass for the views.

   - Only city/municipality rows with an annual period go on the map.
     Other levels and period types are counted and reported.
   - Rows are matched to the NCR boundaries by geo_code (PSGC), then by
     geo_name. Contract field names are not renamed.
   - A city/year without a valid case_count is null ("unavailable").
     Missing is never 0, and another year is never substituted.
   - 2025 is always offered and selected first, even when it has no rows.
   - While the file is missing or rejected there is no TB data at all.
   ===================================================================== */

import { CITIES, CITY } from "./places-model.js";
import { NCR_GEO } from "./static-data-model.js";

export const DEFAULT_YEAR = 2025;

export const MAP_GEO_LEVELS = ["city", "municipality", "city_municipality", "city/municipality", "citymun"];

export const ANNUAL_PERIODS = ["annual", "year", "yearly"];

/* Filled by TbData.setData() before the app starts. */
export let YEARS = [DEFAULT_YEAR];

export let COMPLETE_YEARS = [];

export let TREND_FROM = null;
export let TREND_TO = null;

export const TB = {};

/* ---------- matching contract rows to the NCR boundary features ---------- */
export const GeoMatch = (() => {
  const byCode = {};
  for (const f of (NCR_GEO.features || [])) byCode[String(f.properties.psgc)] = f.properties.id;
  const NAME = [
    ["caloocan", /caloocan/], ["laspinas", /las pi(n|ñ)as/], ["makati", /makati/], ["malabon", /malabon/],
    ["mandaluyong", /mandaluyong/], ["manila", /^(city of )?manila( city)?$/], ["marikina", /marikina/],
    ["muntinlupa", /muntinlupa/], ["navotas", /navotas/], ["paranaque", /para(n|ñ)aque/], ["pasay", /pasay/],
    ["pasig", /pasig/], ["qc", /quezon city/], ["sanjuan", /san juan/], ["taguig", /taguig/],
    ["valenzuela", /valenzuela/], ["pateros", /pateros/]
  ];
  return {
    /* { id, by } or { id: null, reason }. A code and a name that point to different cities is a conflict. */
    match(code, name) {
      const c = code ? byCode[code.trim()] || null : null;
      const n = name ? (NAME.find(([, re]) => re.test(name.trim().toLowerCase())) || [null])[0] : null;
      if (c && n && c !== n) return { id: null, reason: "geo_code and geo_name point to different cities" };
      if (c) return { id: c, by: "geo_code" };
      if (n) return { id: n, by: "geo_name" };
      return { id: null, reason: "not one of the 17 NCR cities/municipality" };
    }
  };
})();

export const TbData = {
  state: "missing",          // ok | empty | missing | error | invalid (file state from ContractLoader)
  message: "",
  notices: [],               // plain-language problems found while reading the file
  sources: {},               // { year: Set of "source_file (sheet)" }

  setData(res) {
    this.state = res ? res.state : "missing"; this.message = res?.message || ""; this.notices = []; this.sources = {};
    const vals = {};
    if (res && res.state === "ok") {
      const skipLevel = {}, skipPeriod = {}, unmatched = [], conflicts = new Set(); let dups = 0;
      for (const r of res.rows) {
        /* NCR region totals are expected in the file (contract); they are not drawn per city, so skip them quietly. */
        if (r.geo_level.toLowerCase() === "region" && r.geo_code === "1300000000") continue;
        if (!MAP_GEO_LEVELS.includes(r.geo_level.toLowerCase())) { skipLevel[r.geo_level] = (skipLevel[r.geo_level] || 0) + 1; continue; }
        const pt = (r.period_type || "").toLowerCase();
        if (!ANNUAL_PERIODS.includes(pt)) { const k = r.period_type || "(empty)"; skipPeriod[k] = (skipPeriod[k] || 0) + 1; continue; }
        const m = GeoMatch.match(r.geo_code, r.geo_name);
        if (!m.id) { unmatched.push(`line ${r._line} (${[r.geo_code, r.geo_name].filter(Boolean).join(" ")}): ${m.reason}`); continue; }
        const y = r.year, rec = { count: r.case_count, rate: r.case_rate_per_100k, population: r.population, matchedBy: m.by, row: r, status: "complete" };
        vals[y] ||= {};
        if (m.id in vals[y]) {
          dups++;
          const prev = vals[y][m.id];
          if (!prev || prev.count !== rec.count || prev.rate !== rec.rate) { conflicts.add(`${CITY[m.id].name} ${y}`); vals[y][m.id] = null; }
          continue;
        }
        vals[y][m.id] = rec;
        if (r.source_file) (this.sources[y] ||= new Set()).add(r.source_file + (r.source_sheet ? ` (${r.source_sheet})` : ""));
      }
      const list = o => Object.entries(o).map(([k, v]) => `${v} with "${k}"`).join(", ");
      const few = (a, f) => a.slice(0, 3).map(f).join("; ") + (a.length > 3 ? "; …" : "");
      if (res.malformed.length) this.notices.push(`${res.malformed.length} malformed row(s) were skipped (${few(res.malformed, x => (x.line ? "line " + x.line + ": " : "") + x.reason)}).`);
      if (res.flagged.length) this.notices.push(`${res.flagged.length} value(s) were not valid and are treated as missing (${few(res.flagged, f => `line ${f.line} ${f.field}="${f.value}"`)}).`);
      if (Object.keys(skipLevel).length) this.notices.push(`Rows at a geographic level the map cannot show were left out: ${list(skipLevel)}.`);
      if (Object.keys(skipPeriod).length) this.notices.push(`Rows that are not annual were left out of the yearly map: ${list(skipPeriod)}.`);
      if (unmatched.length) this.notices.push(`${unmatched.length} row(s) did not match an NCR boundary (${few(unmatched, x => x)}).`);
      if (dups) this.notices.push(`${dups} duplicate city/year row(s) were found${conflicts.size ? `; conflicting values are shown as unavailable: ${[...conflicts].join(", ")}` : " (same values, kept once)"}.`);
    }
    /* Years: every year from the first record to the default (2025 always included). */
    const have = Object.keys(vals).map(Number);
    const lo = Math.min(DEFAULT_YEAR, ...have), hi = Math.max(DEFAULT_YEAR, ...have);
    YEARS = []; for (let y = lo; y <= hi; y++) YEARS.push(y);
    COMPLETE_YEARS = YEARS.filter(y => vals[y] && CITIES.every(c => vals[y][c.id]?.count != null));
    TREND_FROM = COMPLETE_YEARS[0] ?? null; TREND_TO = COMPLETE_YEARS[COMPLETE_YEARS.length - 1] ?? null;
    for (const c of CITIES) {
      TB[c.id] = {};
      for (const y of YEARS) {
        const r = vals[y]?.[c.id];
        TB[c.id][y] = r && r.count != null ? r : { count: null, rate: null, population: null, status: vals[y] ? "unavailable" : "missing" };
      }
    }
    this.years = have.sort((a, b) => a - b);
  },

  years: [],
  available() { return this.state === "ok" && this.years.length > 0; },
  unavailableText() {
    if (this.state === "ok") return "Cleaned TB data has no annual city rows that can be shown on the map.";
    return {
      empty: "Cleaned TB data not yet available: the file has no usable rows.",
      invalid: "Cleaned TB data not yet available: the file was rejected.",
      error: "Cleaned TB data not yet available: the file could not be read."
    }[this.state] || "Cleaned TB data not yet available.";
  },
  /* Ids of the NCR cities with at least one valid case_count in the file, in CITIES order. */
  citiesWithData() {
    if (!this.available()) return [];
    return CITIES.filter(c => this.years.some(y => TB[c.id]?.[y]?.count != null)).map(c => c.id);
  },
  sourceText(y) { return this.sources[y] ? [...this.sources[y]].join(", ") : null; }
};

/* Status of a year, as { s, label, note }. */
export function yStatus(y) {
  if (!TbData.available()) return { s: "unavailable", label: "Not yet available", note: TbData.unavailableText() };
  if (!TbData.years.includes(y)) return { s: "missing", label: "No records", note: `cleaned_tb_data.csv has no annual city rows for ${y}. Nothing is shown for that year and no other year is used in its place.` };
  const missing = CITIES.filter(c => TB[c.id][y].count == null).length;
  return missing
    ? { s: "complete", label: `${17 - missing} of 17 available`, note: `${missing} of 17 cities have no valid case count for ${y}; they are shown as unavailable.` }
    : { s: "complete", label: "Full year", note: "Annual rows for all 17 cities and municipality." };
}

/* Count or rate for a city or "all". Rates come from case_rate_per_100k; the NCR rate uses
   cities where both case_count and population are valid. */
export function tbVal(id, y, measure) {
  if (id === "all") {
    const have = CITIES.map(c => TB[c.id]?.[y]).filter(d => d && d.count != null);
    if (!have.length) return null;
    if (measure !== "rate") return have.reduce((a, d) => a + d.count, 0);
    const withPop = have.filter(d => d.population != null && d.population > 0);
    if (!withPop.length) return null;
    return withPop.reduce((a, d) => a + d.count, 0) / withPop.reduce((a, d) => a + d.population, 0) * 1e5;
  }
  const d = TB[id]?.[y]; if (!d) return null;
  return measure === "rate" ? d.rate : d.count;
}

/* Trend: log-linear slope of the rate over complete years. Above +3%/yr is increasing, below −3%/yr decreasing. */
export function trendFor(id) {
  const pts = COMPLETE_YEARS.map(y => [y, tbVal(id, y, "rate")]).filter(p => p[1] > 0);
  if (pts.length < 3) return { dir: "Insufficient", pct: null };
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + Math.log(p[1]), 0) / n;
  let num = 0, den = 0; for (const [x, v] of pts) { num += (x - mx) * (Math.log(v) - my); den += (x - mx) ** 2; }
  const p = Math.exp(num / den) - 1;
  return { dir: p > 0.03 ? "Increasing" : p < -0.03 ? "Decreasing" : "Stable", pct: p };
}

/* Fixed TB classes, the same for every year. */
export const TB_COLORS = ["#CDEFEA", "#86D0C8", "#3AA6B0", "#1F6FA3", "#173F7A"];

export const TB_BREAKS = {
  count: { edges: [1000, 2500, 5000, 10000], labels: ["Under 1,000", "1,000–2,499", "2,500–4,999", "5,000–9,999", "10,000 or more"], short: ["<1k", "1k+", "2.5k+", "5k+", "10k+"] },
  /* Per 100,000: city rates run from about 140 (2020) to about 1,240 (2025), so these edges keep every year spread over the classes */
  rate: { edges: [400, 600, 800, 1000], labels: ["Under 400", "400–599", "600–799", "800–999", "1,000 or more"], short: ["<400", "400+", "600+", "800+", "1k+"] }
};

export const tbClass = (v, measure) => v == null ? -1 : TB_BREAKS[measure].edges.filter(e => v >= e).length;

/* ---------- predictions (tb_predictions.csv): kept apart from observed records ---------- */
export const PredData = {
  state: "missing", message: "", rows: [], byCity: {}, notices: [],
  setData(res) {
    this.rows = []; this.byCity = {}; this.notices = [];
    this.state = res ? res.state : "missing"; this.message = res?.message || "";
    if (!res || res.state !== "ok") return;
    const skip = {}; let unmatched = 0;
    for (const r of res.rows) {
      if (!MAP_GEO_LEVELS.includes(r.geo_level.toLowerCase())) { skip[r.geo_level] = (skip[r.geo_level] || 0) + 1; continue; }
      const m = GeoMatch.match(r.geo_code, r.geo_name);
      if (!m.id) { unmatched++; continue; }
      const p = { ...r, cityId: m.id };
      this.rows.push(p); (this.byCity[m.id] ||= []).push(p);
    }
    if (res.malformed.length) this.notices.push(`${res.malformed.length} malformed prediction row(s) were skipped.`);
    if (res.flagged.length) this.notices.push(`${res.flagged.length} prediction value(s) were not valid and are treated as missing.`);
    if (Object.keys(skip).length) this.notices.push(`Predictions at levels the map cannot show were left out: ${Object.entries(skip).map(([k, v]) => `${v} with "${k}"`).join(", ")}.`);
    if (unmatched) this.notices.push(`${unmatched} prediction row(s) did not match an NCR boundary.`);
  },
  periodLabel(p) {
    if (p.target_period_start && p.target_period_end) return `${p.target_period_start} to ${p.target_period_end}`;
    return p.target_period_start || p.target_period_end || "period not given";
  }
};
