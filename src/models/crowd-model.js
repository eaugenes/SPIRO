/* =====================================================================
   Crowding indicator from BestTime: the indicator for the crowding heatmap.
   Only malls with a BestTime forecast count (data/places/besttime-malls.json, made by
   tools/fetch-besttime.ps1); nothing is estimated for places without one.
   A forecast is a share (0–100) of that mall's own busiest hour, so a small mall at its peak
   reads 100% like a big one. To compare malls, each is weighted by the square root of its
   number of Google reviews (at least 100), a stated stand-in for how many people it draws.
   The surface at a point = sum over malls of (weight x forecast share for the hour) x distance
   falloff (sigma 350 m), divided by a fixed NCR reference so colours mean the same in every city.
   ===================================================================== */
import { FORECAST_MALLS } from "./places-model.js";

export const Crowd = (() => {
  const SIGMA = 350, cosk = Math.cos(14.6 * Math.PI / 180);
  const W = new Map(FORECAST_MALLS.map(p => [p.id, Math.sqrt(Math.max(100, p.bt.reviews || 0))]));
  const value = (p, s) => { const b = p.week[s.day][s.hour]; return b == null ? 0 : W.get(p.id) * b / 100; };
  /* Reference level: the 95th percentile of the indicator at the malls themselves, every
     mall at its busiest hour. 100% on the scale = that level. */
  const ref = (() => {
    const vals = FORECAST_MALLS.map(p => FORECAST_MALLS.reduce((v, q) => {
      const dy = (q.lat - p.lat) * 111320, dx = (q.lng - p.lng) * 111320 * cosk;
      return v + W.get(q.id) * Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
    }, 0)).sort((a, b) => a - b);
    return vals.length ? vals[Math.floor(vals.length * 0.95)] || 1 : 1;
  })();
  return {
    SIGMA,
    ready: () => FORECAST_MALLS.length > 0,
    count: () => FORECAST_MALLS.length,
    /* Indicator (0..1, 1 = reference level) for each cell of a w x h grid of S-pixel cells, from the given malls */
    grid(map, s, malls, w, h, S) {
      const out = new Float32Array(w * h), mpp = 156543.03 * cosk / Math.pow(2, map.getZoom());
      const sig = SIGMA / mpp / S, R = Math.ceil(sig * 3), inv = 1 / (2 * sig * sig);
      for (const p of malls) {
        const v = value(p, s); if (!v) continue;
        const q = map.latLngToContainerPoint([p.lat, p.lng]), cx = q.x / S, cy = q.y / S;
        if (cx < -R || cy < -R || cx > w + R || cy > h + R) continue;
        const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(w - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(h - 1, Math.ceil(cy + R));
        for (let y = y0; y <= y1; y++) { const dy = y - cy, row = y * w; for (let x = x0; x <= x1; x++) { const dx = x - cx; out[row + x] += v * Math.exp(-(dx * dx + dy * dy) * inv); } }
      }
      for (let i = 0; i < out.length; i++) out[i] = Math.min(1, out[i] / ref);
      return out;
    }
  };
})();
