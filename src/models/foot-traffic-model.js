/* =====================================================================
   Foot-traffic indicator from OpenStreetMap: the indicator for crowding.
   OpenStreetMap has no visitor counts. What it does have is where the places that
   draw foot traffic are: malls, supermarkets, public markets, train and bus stations,
   schools and universities, and places of worship. The browser downloads those places
   for Metro Manila from the free Overpass API (no key), keeps them for 7 days, and the
   crowding heatmap becomes: sum over nearby places of (type weight x typical share of
   that type's busiest hour) x distance falloff (sigma 350 m). Type weights and hourly
   shapes are stated assumptions, not measurements.
   Source: (c) OpenStreetMap contributors, ODbL, https://www.openstreetmap.org/copyright
   ===================================================================== */
import { APP_CONFIG } from "../config/app-config.js";
import { NCR_GEO } from "./static-data-model.js";

export const OsmFoot = (() => {
  const KEY = "spiro.osm.foot.v1", MAX_AGE = 7 * 864e5, SIGMA = 350;
  const ENDPOINT = APP_CONFIG.overpassEndpoint;
  const BBOX = "14.34,120.88,14.79,121.14";
  const QUERY = `[out:json][timeout:90];(
    nwr["shop"~"^(mall|department_store|supermarket)$"](${BBOX});
    nwr["amenity"~"^(marketplace|bus_station|university|college|school|place_of_worship)$"](${BBOX});
    nwr["railway"="station"](${BBOX});
    nwr["public_transport"="station"](${BBOX});
  );out center tags;`;
  const g = (h, mu, s) => Math.exp(-((h - mu) ** 2) / (2 * s * s));
  /* Type, assumed relative pull at its busiest hour, opening hours, and typical-day shape.
     Sources (see docs/foot-traffic.md):
     - rail and bus: weekday peaks 7–9 AM and 5–7 PM, the MRT-3 peak periods reported by Camus (2014).
     - mall: weekend daily visits about 1.5 times weekday (ratio 1.51, Palmiano, Kurokawa & Sigua, 1999);
       the weekend curve is scaled so its daily total is 1.51 times the weekday total.
     - market, college, supermarket, school, worship: no published hourly figures found; stated assumptions. */
  const TYPES = {
    mall: { label: "Malls and department stores", w: 10, open: [10, 22], f: (h, we, d) => we ? 1.16 * (.45 + .9 * g(h, 15.5, 3)) : (.25 + .45 * g(h, 13, 2.5) + .75 * g(h, 18.5, 2)) * (d === 5 && h >= 17 ? 1.12 : 1) },
    rail: { label: "Train stations", w: 9, open: [5, 23], f: (h, we) => we ? .15 + .55 * g(h, 15, 4) : .22 + 1.0 * g(h, 7.5, 1.3) + .95 * g(h, 18, 1.5) },
    market: { label: "Public markets", w: 7, open: [4, 20], f: (h, we) => we ? .2 + 1.0 * g(h, 7.5, 2.2) + .45 * g(h, 16, 2) : .15 + .9 * g(h, 7, 2) + .4 * g(h, 17, 2) },
    bus: { label: "Bus terminals and other stations", w: 5, open: [4, 23], f: (h, we) => we ? .15 + .55 * g(h, 15, 4) : .22 + 1.0 * g(h, 7.5, 1.3) + .95 * g(h, 18, 1.5) },
    college: { label: "Universities and colleges", w: 5, open: [7, 21], f: (h, we, d) => d === 0 ? 0 : (we ? .25 : 1) * (.3 + .8 * g(h, 10, 2.5) + .6 * g(h, 16, 2.5)) },
    supermarket: { label: "Supermarkets", w: 2, open: [8, 22], f: (h, we) => (we ? 1.1 : 1) * (.3 + .6 * g(h, 11, 2.5) + .8 * g(h, 18, 2)) },
    school: { label: "Schools", w: 2, open: [6, 18], f: (h, we) => we ? 0 : .2 + 1.0 * g(h, 7, 1) + .8 * g(h, 16.5, 1.2) + .3 * g(h, 12, 1) },
    worship: { label: "Places of worship", w: 1.5, open: [5, 21], f: (h, we, d) => d === 0 ? .2 + 1.0 * g(h, 9, 2) + .6 * g(h, 17, 2) : .1 + .25 * g(h, 18, 1.5) }
  };
  const ORDER = Object.keys(TYPES);
  /* Each type's shape as a share (0..1) of its own busiest hour in the week */
  const PEAK = Object.fromEntries(ORDER.map(k => { let m = 0; for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) m = Math.max(m, TYPES[k].f(h, d === 0 || d === 6, d)); return [k, m]; }));
  const share = (k, d, h) => { const t = TYPES[k]; return h >= t.open[0] && h < t.open[1] ? Math.max(0, t.f(h, d === 0 || d === 6, d)) / PEAK[k] : 0; };

  function classify(t) {
    if (!t) return null;
    if (t.shop === "mall" || t.shop === "department_store") return "mall";
    if (t.shop === "supermarket") return "supermarket";
    if (t.amenity === "marketplace") return "market";
    if (t.railway === "station" || (t.public_transport === "station" && (t.train === "yes" || t.subway === "yes" || t.light_rail === "yes" || t.monorail === "yes"))) return "rail";
    if (t.amenity === "bus_station" || t.public_transport === "station") return "bus";
    if (t.amenity === "university" || t.amenity === "college") return "college";
    if (t.amenity === "school") return "school";
    if (t.amenity === "place_of_worship") return "worship";
    return null;
  }
  /* Keep only points inside the NCR city polygons */
  function inNCR(lat, lng) {
    for (const f of NCR_GEO.features) for (const poly of f.geometry.coordinates) {
      let inside = false; const r = poly[0];
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside; }
      if (inside) { for (let k = 1; k < poly.length; k++) { let hole = false; const hr = poly[k]; for (let i = 0, j = hr.length - 1; i < hr.length; j = i++) { const [xi, yi] = hr[i], [xj, yj] = hr[j]; if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) hole = !hole; } if (hole) inside = false; } }
      if (inside) return true;
    }
    return false;
  }

  let data = null, state = "idle", error = "", waiters = [], ref = 1;
  function setData(d) {
    data = d; state = "ok";
    /* Reference level: the 95th percentile of the indicator at the places themselves,
       each type at its busiest hour. 100% on the scale = that level, so the colours do
       not depend on zoom or on the chosen hour. */
    const pts = d.items, cosk = Math.cos(14.6 * Math.PI / 180), vals = [];
    const cell = 0.02, grid = new Map();
    pts.forEach((p, i) => { const k = Math.floor(p[0] / cell) + ":" + Math.floor(p[1] / cell); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
    for (const p of pts) {
      let v = 0; const gy = Math.floor(p[0] / cell), gx = Math.floor(p[1] / cell);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of grid.get((gy + a) + ":" + (gx + b)) || []) {
        const q = pts[j], dy = (q[0] - p[0]) * 111320, dx = (q[1] - p[1]) * 111320 * cosk;
        v += TYPES[ORDER[q[2]]].w * Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
      }
      vals.push(v);
    }
    vals.sort((a, b) => a - b);
    ref = vals.length ? vals[Math.floor(vals.length * 0.95)] || 1 : 1;
  }
  function load() {
    try { const c = JSON.parse(localStorage.getItem(KEY) || "null"); if (c && c.items?.length && Date.now() - Date.parse(c.fetched) < MAX_AGE) { setData(c); return Promise.resolve(); } } catch { /* Storage unavailable */ }
    state = "loading";
    return fetch(ENDPOINT, { method: "POST", body: "data=" + encodeURIComponent(QUERY), headers: { "Content-Type": "application/x-www-form-urlencoded" } })
      .then(r => { if (!r.ok) throw new Error("Overpass API answered " + r.status); return r.json(); })
      .then(j => {
        const seen = new Set(), items = [];
        for (const e of j.elements || []) {
          const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon, k = classify(e.tags);
          if (lat == null || lng == null || !k || !inNCR(lat, lng)) continue;
          const key = k + ":" + lat.toFixed(4) + "," + lng.toFixed(4);
          if (seen.has(key)) continue; seen.add(key);   // a station mapped as node and area counts once
          items.push([+lat.toFixed(5), +lng.toFixed(5), ORDER.indexOf(k)]);
        }
        if (!items.length) throw new Error("no places returned");
        const d = { fetched: new Date().toISOString(), osmBase: j.osm3s?.timestamp_osm_base || null, items };
        try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* Too big or blocked: keep in memory only */ }
        setData(d);
      })
      .catch(e => { state = "error"; error = e.message || String(e); });
  }
  return {
    TYPES, ORDER,
    /* Pure helpers, exported for tests: a type's share of its busiest hour, and OSM tag → type. */
    share, classify,
    ready: () => state === "ok",
    status: () => ({ state, error, n: data?.items.length || 0, fetched: data?.fetched, osmBase: data?.osmBase }),
    counts: () => { const c = Object.fromEntries(ORDER.map(k => [k, 0])); (data?.items || []).forEach(p => c[ORDER[p[2]]]++); return c; },
    ensure(cb) {
      if (state === "ok" || state === "error") return;
      if (cb) waiters.push(cb);
      if (state === "loading") return;
      load().then(() => { const w = waiters; waiters = []; w.forEach(f => f()); });
    },
    retry(cb) { state = "idle"; this.ensure(cb); },
    /* Indicator (0..1, 1 = reference level) for each cell of a w x h grid of S-pixel cells */
    grid(map, s, w, h, S) {
      const out = new Float32Array(w * h), mpp = 156543.03 * Math.cos(14.6 * Math.PI / 180) / Math.pow(2, map.getZoom());
      const sig = SIGMA / mpp / S, R = Math.ceil(sig * 3), inv = 1 / (2 * sig * sig);
      const sh = ORDER.map(k => TYPES[k].w * share(k, s.day, s.hour));
      for (const p of data.items) {
        const v = sh[p[2]]; if (!v) continue;
        const q = map.latLngToContainerPoint([p[0], p[1]]), cx = q.x / S, cy = q.y / S;
        if (cx < -R || cy < -R || cx > w + R || cy > h + R) continue;
        const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(w - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(h - 1, Math.ceil(cy + R));
        for (let y = y0; y <= y1; y++) { const dy = y - cy, row = y * w; for (let x = x0; x <= x1; x++) { const dx = x - cx; out[row + x] += v * Math.exp(-(dx * dx + dy * dy) * inv); } }
      }
      for (let i = 0; i < out.length; i++) out[i] = Math.min(1, out[i] / ref);
      return out;
    },
    levelAt(lat, lng, s) {
      if (state !== "ok") return null;
      const cosk = Math.cos(14.6 * Math.PI / 180); let v = 0;
      for (const p of data.items) { const dy = (p[0] - lat) * 111320, dx = (p[1] - lng) * 111320 * cosk, d2 = dx * dx + dy * dy; if (d2 < 9 * SIGMA * SIGMA) v += TYPES[ORDER[p[2]]].w * share(ORDER[p[2]], s.day, s.hour) * Math.exp(-d2 / (2 * SIGMA * SIGMA)); }
      return Math.round(100 * Math.min(1, v / ref));
    }
  };
})();
