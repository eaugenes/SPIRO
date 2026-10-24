/* Colour scales and legend rows shared by the map, legend, cards and charts (presentation only). */
import { TB_BREAKS, TB_COLORS } from "../../models/tb-data-model.js";
import { fmt } from "../../utils/format.js";

/* The one TB indicator drawn on the map: cases per 100,000 people (case_rate_per_100k), so big
   cities are not darker just because more people live there. The legend, colours, labels and
   tooltips all read it from here, so they can't disagree. */
export const MAP_MEASURE = "rate";

/* Legend rows built from the same edges tbClass() uses to colour the map. */
export function tbLegendRows(measure) {
  const e = TB_BREAKS[measure].edges, f = v => fmt(v), sh = v => v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v);
  return TB_COLORS.map((color, i) => ({
    color,
    long: i === 0 ? `Under ${f(e[0])}` : i === e.length ? `${f(e[i - 1])} or more` : `${f(e[i - 1])}–${f(e[i] - 1)}`,
    short: i === 0 ? `<${sh(e[0])}` : `${sh(e[i - 1])}+`
  }));
}

export const CROWD_STOPS = [[0, "#2E9D4F"], [0.4, "#F2D43D"], [0.7, "#F28A1E"], [1, "#D42A1F"]];

export const CROWD_LUT = (() => {
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), out = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let k = 0;
    while (k < CROWD_STOPS.length - 2 && t > CROWD_STOPS[k + 1][0]) k++;
    const [t0, c0] = CROWD_STOPS[k], [t1, c1] = CROWD_STOPS[k + 1], f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const a = hex(c0), b = hex(c1); out.push(a.map((x, j) => Math.round(x + (b[j] - x) * f)));
  }
  return out;
})();

export const crowdRGB = t => CROWD_LUT[Math.max(0, Math.min(255, Math.round(t * 255)))];

export const crowdCSS = t => `rgb(${crowdRGB(t).join(",")})`;

export const CROWD_GRADIENT = `linear-gradient(90deg,${CROWD_STOPS.map(([t, c]) => `${c} ${t * 100}%`).join(",")})`;

export const LEVEL_COLOR = { Low: crowdCSS(0.2), Moderate: crowdCSS(0.5), High: crowdCSS(0.8), "Very high": crowdCSS(1), Closed: "#9AA6AE" };
