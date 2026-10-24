/* =====================================================================
   AdminView: Admin panel shown after log in.
     - TB history: filters, chart and table by city and year
     - Crowding report: BestTime forecast busy hours by mall
   ===================================================================== */

import { CITIES, CITY, PLACES, busyLevel, cityName } from "../models/places-model.js";
import { DEFAULT_YEAR, TREND_FROM, TREND_TO, TbData, YEARS, tbVal, trendFor, yStatus } from "../models/tb-data-model.js";
import { $, $$, icon, opt } from "../utils/dom.js";
import { DOW, dateLabel, esc, fmt, hourLabel, parseIso, pct } from "../utils/format.js";
import { Charts } from "./helpers/charts.js";
import { CROWD_GRADIENT, crowdCSS } from "./helpers/map-scales.js";
import { besttimeSourceHTML } from "./helpers/source-notes.js";

export const ADMIN_TABS = { tb: "TB history", crowd: "Crowding report" };

export class AdminView {
  constructor(model) {
    this.model = model; this.handlers = {};
    this.f = { city: "all", measure: "count", compare: true, cCity: "all", cDate: model.state.date };
  }
  init(handlers) { this.handlers = handlers; }

  html(tab) {
    const tabs = Object.entries(ADMIN_TABS).map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" aria-selected="${tab === k}" aria-controls="adminPanel" tabindex="${tab === k ? 0 : -1}" data-tab="${k}">${l}</button>`).join("");
    const body = tab === "crowd" ? this.crowdHTML() : this.tbHTML();
    return `<div class="admin">
      <div class="tabs" role="tablist" aria-label="Admin">${tabs}</div>
      <div id="adminPanel" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="0">${body}</div></div>`;
  }

  /* ---------- TB history ---------- */
  tbHTML() {
    const f = this.f, cityOpts = opt("all", "All of NCR", f.city === "all") + CITIES.map(c => opt(c.id, cityName(c.id), f.city === c.id)).join("");
    const rows = CITIES.map(c => ({ c, v: YEARS.map(y => tbVal(c.id, y, f.measure)), t: trendFor(c.id) }))
      .sort((a, b) => (tbVal(b.c.id, DEFAULT_YEAR, f.measure) ?? -1) - (tbVal(a.c.id, DEFAULT_YEAR, f.measure) ?? -1));
    const cell = (v, y) => v == null ? `<td class="na" title="${esc(yStatus(y).label)}">–</td>` : `<td class="num${yStatus(y).s === "partial" ? " partial" : ""}">${f.measure === "rate" ? fmt(v, 1) : fmt(v)}${yStatus(y).s === "partial" ? "*" : ""}</td>`;
    return `${TbData.available() ? "" : `<p class="notice warn">${icon("i-info")}<span>${esc(TbData.unavailableText())} TB history fills in once data/cleaned_tb_data.csv is provided.</span></p>`}
      <div class="filters">
        <div class="field"><label for="afCity">City or municipality</label><select id="afCity">${cityOpts}</select></div>
        <div class="field"><span class="label" id="afMeasL">Measure</span><div class="seg" role="radiogroup" aria-labelledby="afMeasL">
          <button type="button" role="radio" aria-checked="${f.measure === "count"}" data-afm="count">Cases</button><button type="button" role="radio" aria-checked="${f.measure === "rate"}" data-afm="rate">Per 100,000</button></div></div>
        ${f.city !== "all" && f.measure === "rate" ? `<label class="check"><input type="checkbox" role="switch" class="switch" id="afCompare" ${f.compare ? "checked" : ""}> Compare with all of NCR</label>` : ""}
      </div>
      <div class="card">
        <h3>${f.measure === "rate" ? "TB cases per 100,000 people" : "TB cases"}: ${esc(cityName(f.city))}, ${YEARS[0]}–${YEARS[YEARS.length - 1]}</h3>
        <div class="chart" id="afChart"></div>
        <ul class="chart-key"><li><i style="background:#1F6FA3"></i>${esc(cityName(f.city))}</li>${f.city !== "all" && f.measure === "rate" && f.compare ? `<li><i style="background:#8A9AA6"></i>All of NCR</li>` : ""}<li><i class="gap"></i>No records for that year in cleaned_tb_data.csv</li></ul>
        ${f.city !== "all" ? `<p class="small">Trend ${TREND_FROM ?? "–"}–${TREND_TO ?? "–"} (complete years only): <b>${this.trend(trendFor(f.city))}</b>.</p>` : ""}
      </div>
      <div class="card">
        <h3>By city and year</h3>
        <div class="table-wrap" tabindex="0" role="region" aria-label="TB ${f.measure === "rate" ? "rates" : "cases"} by city and year"><table class="data">
          <thead><tr><th scope="col">City</th>${YEARS.map(y => `<th scope="col" class="num">${y}</th>`).join("")}<th scope="col">Trend ${TREND_FROM ?? "–"}–${TREND_TO ?? "–"}</th></tr></thead>
          <tbody>${rows.map(r => `<tr><th scope="row"><button type="button" class="link" data-afcity="${r.c.id}">${esc(r.c.name)}</button></th>${r.v.map((v, i) => cell(v, YEARS[i])).join("")}<td>${this.trend(r.t)}</td></tr>`).join("")}</tbody>
        </table></div>
        <p class="xs muted">– No valid value in cleaned_tb_data.csv for that city and year (never filled in). Sorted by ${DEFAULT_YEAR}. Rates are case_rate_per_100k as given in the file. Trend: yearly change in the rate, fitted over years where all 17 cities have values; above +3% a year is increasing, below −3% decreasing.</p>
      </div>`;
  }
  trend(t) { return t.dir === "Insufficient" ? "Not enough data" : `${t.dir} (${pct(t.pct)}/yr)`; }

  /* ---------- crowding ---------- */
  crowdHTML() {
    const f = this.f, cd = parseIso(f.cDate) || new Date(), day = cd.getDay();
    const list = PLACES.filter(p => f.cCity === "all" || p.city === f.cCity).sort((a, b) => CITY[a.city].name.localeCompare(CITY[b.city].name) || b.bt.reviews - a.bt.reviews);
    const hours = [...Array(19).keys()].map(i => i + 5);
    const cityOpts = opt("all", "All of NCR", f.cCity === "all") + CITIES.filter(c => PLACES.some(p => p.city === c.id)).map(c => opt(c.id, c.name, f.cCity === c.id)).join("");
    return `<div class="filters">
        <div class="field"><label for="acCity">City</label><select id="acCity">${cityOpts}</select></div>
        <div class="field"><label for="acDate">Date</label><span class="tf-box">${icon("i-calendar")}<input type="date" id="acDate" value="${esc(f.cDate)}" required></span></div>
      </div>
      <div class="card">
        <h3>Usual crowding by hour, ${esc(dateLabel(f.cDate))} (${list.length} mall${list.length === 1 ? "" : "s"})</h3>
        <p class="small muted">BestTime forecast for a typical ${DOW[day]}, as a share of each mall's own busiest hour. Not a headcount and not live. Select a mall to open it on the map. ${besttimeSourceHTML()}</p>
        ${list.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Usual crowding by hour"><table class="grid-tbl">
          <thead><tr><th scope="col">Mall</th>${hours.map(h => `<th scope="col"><span>${h % 12 || 12}${h < 12 ? "a" : "p"}</span></th>`).join("")}<th scope="col">Busiest</th></tr></thead>
          <tbody>${list.map(p => { const row = p.week[day], mx = Math.max(...row.filter(x => x != null)), hi = row.indexOf(mx);
            return `<tr><th scope="row"><button type="button" class="link" data-acplace="${p.id}">${esc(p.name)}</button><small>${esc(CITY[p.city].name)}</small></th>${hours.map(h => row[h] == null ? `<td class="gc closed" title="${hourLabel(h)}: closed">·</td>` : `<td class="gc" style="background:${crowdCSS(row[h] / 100)}" title="${hourLabel(h)}: ${row[h]}% (${busyLevel(row[h])})"><span class="sr-only">${hourLabel(h)} ${row[h]}%</span></td>`).join("")}<td class="xs">${hi >= 0 ? hourLabel(hi) : "–"}</td></tr>`; }).join("")}</tbody>
        </table></div>
        <div class="lg-inline"><span>Less busy</span><span class="lg-ramp" style="background:${CROWD_GRADIENT}"></span><span>Busier</span><span class="closed-key">· Closed</span></div>` : `<p class="small">${PLACES.length ? "No malls in this city have a forecast yet." : "No BestTime mall forecasts are loaded."}</p>`}
        <p class="remind">Reminder: A busy place is not evidence that TB is spreading there.</p>
      </div>`;
  }

  /* ---------- events and charts ---------- */
  bind(root, tab) {
    const h = this.handlers, re = () => h.onRerender();
    $$("[data-tab]", root).forEach(b => {
      b.addEventListener("click", () => h.onTab(b.dataset.tab));
      b.addEventListener("keydown", e => {
        const keys = Object.keys(ADMIN_TABS), i = keys.indexOf(b.dataset.tab);
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = keys[(i + (e.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length]; h.onTab(n, true); }
      });
    });
    const on = (sel, evt, fn) => { const el = $(sel, root); if (el) el.addEventListener(evt, fn); };
    on("#afCity", "change", e => { this.f.city = e.target.value; re(); });
    $$("[data-afm]", root).forEach(b => b.addEventListener("click", () => { this.f.measure = b.dataset.afm; re(); }));
    on("#afCompare", "change", e => { this.f.compare = e.target.checked; re(); });
    $$("[data-afcity]", root).forEach(b => b.addEventListener("click", () => { this.f.city = b.dataset.afcity; re(); $("#afCity")?.focus(); }));
    on("#acCity", "change", e => { this.f.cCity = e.target.value; re(); });
    on("#acDate", "change", e => { if (parseIso(e.target.value)) { this.f.cDate = e.target.value; re(); } else e.target.value = this.f.cDate; });
    $$("[data-acplace]", root).forEach(b => b.addEventListener("click", () => h.onOpenPlace({ type: "place", id: b.dataset.acplace }, this.f.cDate)));

    const ch = $("#afChart", root);
    if (ch) {
      const f = this.f, series = [{ name: cityName(f.city), color: "#1F6FA3", values: YEARS.map(y => tbVal(f.city, y, f.measure)), partial: i => yStatus(YEARS[i]).s === "partial" }];
      if (f.city !== "all" && f.measure === "rate" && f.compare) series.push({ name: "All of NCR", color: "#8A9AA6", values: YEARS.map(y => tbVal("all", y, "rate")), partial: i => yStatus(YEARS[i]).s === "partial" });
      Charts.line(ch, { labels: YEARS.map(String), height: 240, series, gaps: YEARS.map((y, i) => ["missing", "unavailable"].includes(yStatus(y).s) ? i : null).filter(i => i != null),
        fmt: x => f.measure === "rate" ? fmt(x, 1) : fmt(x), tipNote: i => yStatus(YEARS[i]).label, aria: `TB ${f.measure === "rate" ? "cases per 100,000" : "cases"} by year for ${cityName(f.city)}` });
    }
  }
}
