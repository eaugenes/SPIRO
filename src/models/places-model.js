/* Places model: the 17 NCR cities (with 2025 projected population) and the malls with a BestTime
   foot-traffic forecast, the places of the crowding layer. Domain data and rules only; no DOM. */
import { BESTTIME, VENUE_BASE } from "./static-data-model.js";

/* =====================================================================
   AppModel: reference data (cities, TB series, public places) and app state.
   Views never change state directly; controllers call the setters below,
   and the model emits "change" with the list of keys that changed.
   ===================================================================== */

/* ---------- Cities: 2025 projected population (DOH FHSIS Annual 2025); pop2020 = PSA 2020 Census ---------- */
export const CITIES = [
  { id: "caloocan", name: "Caloocan", pop: 1743812, pop2020: 1661584 }, { id: "laspinas", name: "Las Piñas", pop: 628652, pop2020: 606293 },
  { id: "makati", name: "Makati", pop: 294960, pop2020: 629616 }, { id: "malabon", name: "Malabon", pop: 396996, pop2020: 380522 },
  { id: "mandaluyong", name: "Mandaluyong", pop: 442115, pop2020: 425758 }, { id: "manila", name: "Manila", pop: 1911556, pop2020: 1846513 },
  { id: "marikina", name: "Marikina", pop: 471918, pop2020: 456059 }, { id: "muntinlupa", name: "Muntinlupa", pop: 561640, pop2020: 543445 },
  { id: "navotas", name: "Navotas", pop: 260395, pop2020: 247543 }, { id: "paranaque", name: "Parañaque", pop: 716560, pop2020: 689992 },
  { id: "pasay", name: "Pasay", pop: 452062, pop2020: 440656 }, { id: "pasig", name: "Pasig", pop: 842708, pop2020: 803159 },
  { id: "qc", name: "Quezon City", pop: 3079478, pop2020: 2960048 }, { id: "sanjuan", name: "San Juan", pop: 128083, pop2020: 126347 },
  { id: "taguig", name: "Taguig", pop: 1271871, pop2020: 886722 }, { id: "valenzuela", name: "Valenzuela", pop: 745850, pop2020: 714978 },
  { id: "pateros", name: "Pateros", pop: 66990, pop2020: 65227, muni: true }
];

export const CITY = Object.fromEntries(CITIES.map(c => [c.id, c]));

export const cityName = id => id === "all" ? "All of NCR" : CITY[id].name + (CITY[id].muni ? " (municipality)" : "");

/* ---------- TB records ----------
   TB values come only from data/cleaned_tb_data.csv, loaded by
   src/services/contract-loader.js and src/models/tb-data-model.js
   (YEARS, yStatus, TB, tbVal, trendFor, TB_BREAKS, tbClass are defined there). */

/* ---------- Crowding places: malls with a BestTime forecast ----------
   The crowding layer covers only malls with a BestTime forecast (data/places/besttime-malls.json).
   Each value is a share (0–100) of that mall's own busiest hour in a typical week, from
   anonymised phone visit data: a forecast, not a live reading and not a headcount. Nothing is
   estimated for places without a forecast. Each mall keeps its BestTime record in `bt`.
   - One complex, one mall: BestTime lists some complexes in parts (SM Megamall Building A and
     B, SM Mall of Asia and its North Wing). A forecast mall within 320 m of a bigger one (more
     reviews) is folded into it (named in `bt.parts`) and not counted again.
   - A mall in the listed public places (data/places/public-places.json) gives its familiar name
     and id to the biggest forecast mall within 300 m, or else to a forecast mall with the same
     name within 1 km (listed coordinates are approximate). Listed places with no forecast
     (other malls, markets, stations, tourist spots) are not shown. */
/* Distance in metres between two { lat, lng } points (flat approximation, fine within NCR) */
export const distM = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos(14.6 * Math.PI / 180));

/* Same mall name, ignoring case, punctuation and generic words: "SM City Sucat" = "SM City Sucat",
   "TriNoma" = "TriNoma Mall", "Greenhills Shopping Center" = "Greenhills Mall". Every distinctive
   word of the shorter name must appear in the other. */
const GENERIC = new Set(["sm", "city", "mall", "malls", "the", "shopping", "center", "centre", "by", "ayala", "of", "at", "and", "building", "a", "b"]);
const words = n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !GENERIC.has(w));
export function sameName(a, b) {
  const [x, y] = [words(a), words(b)].sort((p, q) => p.length - q.length);
  return x.length > 0 && x.every(w => y.includes(w));
}

/* Every crowding place is a mall; the label is shown on cards, markers and in search */
export const CATEGORY = { mall: { label: "Mall" } };

export const PLACES = (() => {
  /* Biggest first, so each complex keeps its main mall and folds the smaller parts into it */
  const forecast = [];
  for (const v of (BESTTIME?.venues || []).filter(v => v.week && CITY[v.city]).sort((a, b) => b.reviews - a.reviews)) {
    const main = forecast.find(m => distM(m, v) < 320);
    if (main) main.parts.push(v.name); else forecast.push({ ...v, parts: [] });
  }
  /* Listed malls lend their name and id: the biggest forecast mall within 300 m, failing that the nearest one with the same name within 1 km */
  const listedFor = new Map();
  for (const v of VENUE_BASE.filter(v => v.cat === "mall")) {
    const free = forecast.filter(b => !listedFor.has(b.id));
    const bt = free.filter(b => distM(v, b) < 300)[0] || free.filter(b => distM(v, b) < 1000 && sameName(v.name, b.name)).sort((a, b) => distM(v, a) - distM(v, b))[0];
    if (bt) listedFor.set(bt.id, v);
  }
  return forecast.map(b => { const v = listedFor.get(b.id);
    return { id: v ? v.id : b.id, name: v ? v.name : b.name, cat: "mall", city: b.city, lat: b.lat, lng: b.lng, week: b.week, bt: b }; });
})();

export const PLACE = Object.fromEntries(PLACES.map(p => [p.id, p]));

/* Malls with a BestTime forecast (every crowding place), and those in one city (biggest first) */
export const FORECAST_MALLS = PLACES;
export const cityMalls = id => FORECAST_MALLS.filter(p => p.city === id).sort((a, b) => b.bt.reviews - a.bt.reviews);

/* How many of these malls are open at day d, hour h, and the hour of day d when they are busiest
   together (highest sum of their forecasts; null if all closed that day) */
export const openCount = (malls, d, h) => malls.filter(p => p.week[d][h] != null).length;
export function busiestHour(malls, d) {
  let best = null, top = 0;
  for (let h = 0; h < 24; h++) { const v = malls.reduce((a, p) => a + (p.week[d][h] ?? 0), 0); if (v > top) { top = v; best = h; } }
  return best;
}
/* True when most (more than half) of these malls are closed at day d, hour h */
export const mostClosed = (malls, d, h) => malls.length > 0 && openCount(malls, d, h) * 2 < malls.length;

/* The city the crowding map shows: the selected city, or the city of the selected place */
export const crowdCity = sel => sel?.type === "city" ? sel.id : sel?.type === "place" && PLACE[sel.id] ? PLACE[sel.id].city : null;

/* One weekday of a forecast week: busiest hour, busy hours (High or more, 70%+) and quieter open hours (Low, under 40%) */
export function daySummary(week, d) {
  const row = week[d], open = [...row.keys()].filter(h => row[h] != null);
  if (!open.length) return null;
  const top = open.reduce((a, h) => row[h] > row[a] ? h : a, open[0]);
  return { top, topValue: row[top], busy: hourRanges(open.filter(h => row[h] >= 70)), quiet: hourRanges(open.filter(h => row[h] < 40)) };
}

/* Hours (0–23) as short ranges: [10, 11, 12, 15] → [[10, 13], [15, 16]] (end exclusive). */
export function hourRanges(hours) {
  const out = [];
  for (const h of [...new Set(hours)].sort((a, b) => a - b)) { const last = out[out.length - 1]; if (last && last[1] === h) last[1] = h + 1; else out.push([h, h + 1]); }
  return out;
}

export function busyLevel(p) { if (p == null) return "Closed"; if (p < 40) return "Low"; if (p < 70) return "Moderate"; if (p < 90) return "High"; return "Very high"; }
