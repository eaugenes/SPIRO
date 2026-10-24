/* =====================================================================
   PlaceDetailsView: the card for a selected city or mall.
   Shows TB figures (city), the city's malls (crowding layer), a mall's BestTime
   forecast, and a row of preventive and precautionary measures.
   ===================================================================== */

import { CATEGORY, CITIES, CITY, PLACE, busyLevel, cityMalls, cityName, daySummary } from "../models/places-model.js";
import { TB, TB_COLORS, TREND_FROM, TREND_TO, TbData, YEARS, tbClass, tbVal, trendFor, yStatus } from "../models/tb-data-model.js";
import { $, $$, icon, toast } from "../utils/dom.js";
import { DOW, esc, fmt, hourLabel, parseIso, pct, whenLabel } from "../utils/format.js";
import { Charts } from "./helpers/charts.js";
import { DataModelView } from "./data-model-view.js";
import { LEVEL_COLOR, MAP_MEASURE, crowdCSS } from "./helpers/map-scales.js";

/* Makati and Taguig: the EMBO barangays moved from Makati to Taguig, which shows in the data as a
   sharp population change between 2023 and 2024 (see data/data_dictionary.md). */
const EMBO = "the EMBO barangays moved from Makati to Taguig. Figures from 2023 and earlier cover a different area from 2024 onward, so compare them with care.";
const BOUNDARY_NOTE = {
  makati: `Between 2023 and 2024 Makati's population in the data falls by about half: ${EMBO}`,
  taguig: `Between 2023 and 2024 Taguig's population in the data rises by about 40%: ${EMBO}`
};
import { closedNoticeHTML } from "./helpers/crowd-notice.js";
import { besttimeSourceHTML } from "./helpers/source-notes.js";

/* Short, general guidance. Not personal medical advice. */
export const PREVENTION = [
  { id: "mask", icon: "p-mask", label: "Mask", text: "If you are coughing or feel unwell, wear a well-fitted mask around other people, especially indoors and in public transport. A mask also helps when you have to spend time close to someone who is coughing." },
  { id: "crowd", icon: "p-crowd", label: "Distance", text: "Avoid long periods in close contact in crowded indoor spaces when you can. TB spreads through the air, and risk grows with time spent close together in enclosed, poorly ventilated places. Choosing less busy hours helps." },
  { id: "vent", icon: "p-vent", label: "Ventilate", text: "Open windows and doors, and use fans that move air outdoors. Good airflow lowers the amount of TB bacteria in shared indoor air at home, at work and in vehicles." },
  { id: "cough", icon: "p-cough", label: "Cover cough", text: "Cover your mouth and nose with a tissue or the inside of your elbow when you cough or sneeze. Throw tissues away right after use." },
  { id: "checkup", card: false, icon: "p-checkup", label: "Get checked", text: "A cough lasting two weeks or more, fever, night sweats or weight loss can be signs of TB. Visit a barangay health station, city health office or TB DOTS facility. TB testing and treatment are free in public health facilities." },
  { id: "hands", icon: "p-hands", label: "Wash hands", text: "TB spreads through the air, not by touching surfaces. Washing your hands with soap and water is still a good habit that prevents many other infections." }
];

export class PlaceDetailsView {
  constructor(model) { this.model = model; this.handlers = {}; this.openTip = null; }
  init(handlers) { this.handlers = handlers; }

  render() {
    const s = this.model.state, card = $("#placeCard");
    if (!s.selected || !this.model.placeExists(s.selected) || s.route !== "map") { card.hidden = true; card.innerHTML = ""; card.classList.remove("pc-enter"); document.body.classList.remove("has-card"); this.lastKey = null; return; }
    const sel = s.selected, key = sel.type + ":" + sel.id, y = card.scrollTop;
    card.innerHTML = sel.type === "city" ? this.cityHTML(sel.id) : sel.type === "fac" ? this.facHTML(sel.id) : sel.type === "facgrp" ? this.facGroupHTML(sel.id) : sel.type === "facmiss" ? this.facMissingHTML() : this.placeHTML(PLACE[sel.id]);
    card.hidden = false; document.body.classList.add("has-card");
    this.bind(card, sel);
    card.scrollTop = key === this.lastKey ? y : 0;
    /* Slide in when a new city or place opens, not on every time change */
    if (key !== this.lastKey) { card.classList.remove("pc-enter"); void card.offsetWidth; card.classList.add("pc-enter"); }
    this.lastKey = key;
  }

  head(eyebrow, title) {
    return `<div class="pc-head"><div>${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}<h2 id="placeTitle" tabindex="-1"${eyebrow ? "" : ' class="city-name"'}>${esc(title)}</h2></div>
      <button type="button" class="icon-btn" id="pcClose" aria-label="Close place details">${icon("i-close")}</button></div>`;
  }

  cityHTML(id) {
    const l = this.model.state.layer; return l === "fac" ? this.cityFacHTML(id) : l === "crowd" ? this.cityCrowdHTML(id) : this.cityTbHTML(id);
  }

  /* Latest TB observation for a city, from the period columns of cleaned_tb_data.csv.
     Never the current date or a file date. */
  latestTb(id) {
    const ys = (TbData.years || []).filter(y => TB[id]?.[y]?.count != null);
    if (!ys.length) return null;
    const y = ys[ys.length - 1], row = TB[id][y].row || {}, raw = row.period_end, st = row.period_start;
    const d = raw instanceof Date ? raw : (typeof raw === "string" && parseIso(raw.slice(0, 10)));
    const type = (row.period_type || "annual").toLowerCase();
    if (!d) return { y, text: `${y} (${type} total; end date not given)` };
    const sd = st instanceof Date ? st : (typeof st === "string" ? parseIso(st.slice(0, 10)) : null);
    const span = sd ? `${sd.toLocaleDateString("en-PH", { month: "short", year: "numeric" })} to ${d.toLocaleDateString("en-PH", { month: "short", year: "numeric" })}` : `${y}`;
    return { y, text: `${d.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}`, sub: `${type} total, ${span}` };
  }

  cityTbHTML(id) {
    const s = this.model.state, y = s.year, d = TB[id][y], admin = s.isAdmin;
    const k = tbClass(tbVal(id, y, MAP_MEASURE), MAP_MEASURE), tr = trendFor(id), last = this.latestTb(id);
    const ranked = CITIES.map(c => [c.id, TB[c.id][y].rate]).filter(p => p[1] != null).sort((a, b) => b[1] - a[1]), rk = ranked.findIndex(p => p[0] === id);
    const noFile = !TbData.available();
    return `${this.head("", cityName(id))}
      <section class="pc-sec" aria-label="TB summary">
        ${d.count == null
          ? `<p class="empty-state">${noFile ? "No TB case data has been loaded yet." : `No TB case count for ${esc(CITY[id].name)} in ${y}.`}</p>`
          : `<div class="kpi"><span class="kpi-l">TB cases per 100,000 people, ${y}</span><span class="kpi-v">${k >= 0 ? `<span class="sw" style="background:${TB_COLORS[k]}"></span>` : ""}${d.rate == null ? "–" : fmt(d.rate)}</span></div>`}
        <dl class="pc-kv">
          ${d.count != null ? `<dt>Notified TB cases, ${y}</dt><dd>${fmt(d.count)}</dd>` : ""}
          ${d.population != null ? `<dt>Population, ${y}</dt><dd>${fmt(d.population)} <small class="muted">(projected)</small></dd>` : `<dt>Population</dt><dd>${fmt(CITY[id].pop)} <small class="muted">(2025 projected)</small></dd>`}
          <dt>Last updated</dt><dd>${last ? `${esc(last.text)}${last.sub ? `<br><small class="muted">${esc(last.sub)}</small>` : ""}` : "No observation available"}</dd>
          ${admin && d.rate != null ? `<dt>Rank by rate</dt><dd>${rk + 1} of ${ranked.length}</dd><dt>Trend ${TREND_FROM ?? "–"}–${TREND_TO ?? "–"}</dt><dd>${this.trendText(tr)}</dd>` : ""}
        </dl>
        ${BOUNDARY_NOTE[id] ? `<p class="notice">${icon("i-info")}<span>${BOUNDARY_NOTE[id]}</span></p>` : ""}
        ${admin ? DataModelView.cityPredictionsHTML(id) : ""}
        ${admin ? `<div class="chart" id="pcSpark" data-city="${id}"></div>` : ""}
      </section>
      ${this.preventionHTML()}`;
  }

  /* The city's malls with a BestTime forecast, busiest at the chosen time first. No single
     level is given to the whole city: the malls are not a measure of the city's crowding. */
  cityCrowdHTML(id) {
    const s = this.model.state, malls = cityMalls(id).map(p => [p, this.model.busyAt(p)]).sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1));
    return `${this.head("", cityName(id))}
      <section class="pc-sec fc" aria-labelledby="pcMalls">
        <h3 id="pcMalls">Malls, ${esc(whenLabel(s))}</h3>
        ${malls.length ? closedNoticeHTML(id, s) : ""}
        ${malls.length ? `<ul class="fc-list">${malls.map(([p, b]) => { const lv = busyLevel(b);
          return `<li><button type="button" class="fc-row" data-place="${esc(p.id)}"><span class="lvl" style="--c:${LEVEL_COLOR[lv]}">${lv}</span><span><b>${esc(p.name)}</b><small>${b == null ? "Usually closed at this hour" : `${b}% of its busiest hour`}</small></span></button></li>`; }).join("")}</ul>
          <p class="pc-src">Each mall's own forecast for a typical ${DOW[s.day]}, not live. ${besttimeSourceHTML()}</p>`
        : `<p class="empty-state">BestTime has no mall forecasts for ${esc(CITY[id].name)} yet.</p>`}
        <p class="remind">Reminder: A busy place is not evidence that TB is spreading there.</p>
      </section>
      ${this.preventionHTML()}`;
  }

  placeHTML(p) {
    const s = this.model.state, b = this.model.busyAt(p), lv = busyLevel(b);
    return `${this.head(`${esc(CATEGORY[p.cat].label)} · ${esc(cityName(p.city))}`, p.name)}
      <section class="pc-sec" aria-labelledby="pcBusy">
        <h3 id="pcBusy">Crowding, ${esc(whenLabel(s))}</h3>
        <p class="big-num"><span class="lvl" style="--c:${LEVEL_COLOR[lv]}">${lv}</span><small>${b == null ? "usually closed at this hour" : `${b}% of its busiest hour`}</small></p>
        <div class="chart" id="pcDay" data-place="${p.id}"></div>
        ${this.forecastHTML(p)}
        <p class="remind">Reminder: A busy place is not evidence that TB is spreading there.</p>
      </section>
      ${this.preventionHTML()}`;
  }

  /* From the mall's BestTime forecast for the chosen weekday: busiest hour, busy and quieter open hours, typical visit length. */
  forecastHTML(p) {
    const d = this.model.state.day, h12 = h => hourLabel(h % 24), range = ([a, b]) => b - a === 1 ? h12(a) : `${h12(a)}–${h12(b)}`;
    const sm = daySummary(p.week, d), dw = p.bt.dwell;
    return `<dl class="pc-kv">
        ${sm ? `<dt>Busiest on ${DOW[d]}s</dt><dd>${h12(sm.top)} <small class="muted">(${sm.topValue}%)</small></dd>
        <dt>Busy hours</dt><dd>${sm.busy.length ? sm.busy.map(range).join(", ") : "None (never above 70%)"}</dd>
        <dt>Quieter hours</dt><dd>${sm.quiet.length ? sm.quiet.map(range).join(", ") : "None while open"}</dd>` : `<dt>${DOW[d]}</dt><dd>Usually closed</dd>`}
        ${dw ? `<dt>Typical visit</dt><dd>${fmt(dw.min)}–${fmt(dw.max)} min</dd>` : ""}
        ${p.bt.parts.length ? `<dt>Includes</dt><dd>${p.bt.parts.map(esc).join("<br>")} <small class="muted">(same complex, counted once)</small></dd>` : ""}
      </dl>
      <p class="pc-src">A typical ${DOW[d]} at this mall, not live. ${besttimeSourceHTML()}</p>`;
  }

  trendText(t) { return t.dir === "Insufficient" ? "Not enough data" : `${t.dir} (${pct(t.pct)}/yr)`; }

  preventionHTML() {
    return `<section class="pc-sec" aria-labelledby="pcPrev">
      <h3 id="pcPrev">Take Precautionary Measures</h3>
      <div class="prev-row" role="group" aria-label="Preventive measures. Select one to read more.">
        ${PREVENTION.filter(p => p.card !== false).map(p => `<button type="button" class="prev-btn" data-prev="${p.id}" title="${p.label}" aria-expanded="${this.openTip === p.id}" aria-controls="prevDesc"><span class="prev-ic">${icon(p.icon)}</span><span class="prev-lb">${p.label}</span></button>`).join("")}
      </div>
      <div id="prevDesc" class="prev-desc" ${this.openTip ? "" : "hidden"} role="region" aria-live="polite">${this.openTip ? this.prevText(this.openTip) : ""}</div>
    </section>`;
  }
  prevText(id) { const p = PREVENTION.find(x => x.id === id); return `<b>${p.label}.</b> ${esc(p.text)} <a href="#guide" data-route="guide">TB Health Guide</a>`; }

  bind(card, sel) {
    $("#pcClose", card).addEventListener("click", () => this.handlers.onClose());
    $$("[data-copy]", card).forEach(b => b.addEventListener("click", async () => {
      const t = b.dataset.copy;
      try { await navigator.clipboard.writeText(t); }
      catch { const ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } finally { ta.remove(); } }
      b.innerHTML = icon("i-check"); b.classList.add("done"); b.setAttribute("aria-label", "Address copied"); toast("Address copied.");
      setTimeout(() => { b.innerHTML = icon("i-copy"); b.classList.remove("done"); b.setAttribute("aria-label", "Copy address"); }, 1600);
    }));
    $$("[data-fac]", card).forEach(b => b.addEventListener("click", () => this.handlers.onSelect({ type: b.dataset.factype || "fac", id: b.dataset.fac })));
    $$("[data-place]", card).forEach(b => b.tagName === "BUTTON" && b.addEventListener("click", () => this.handlers.onSelect({ type: "place", id: b.dataset.place })));
    $$("[data-route]", card).forEach(a => a.addEventListener("click", e => { e.preventDefault(); this.handlers.onNavigate(a.dataset.route); }));
    $$("[data-jump-hour]", card).forEach(b => b.addEventListener("click", () => this.handlers.onTime(+b.dataset.jumpHour, 0, 0)));
    $$(".prev-btn", card).forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.prev; this.openTip = this.openTip === id ? null : id;
      $$(".prev-btn", card).forEach(x => x.setAttribute("aria-expanded", x.dataset.prev === this.openTip));
      const d = $("#prevDesc", card); d.hidden = !this.openTip; d.innerHTML = this.openTip ? this.prevText(this.openTip) : "";
      $$("[data-route]", d).forEach(a => a.addEventListener("click", e => { e.preventDefault(); this.handlers.onNavigate(a.dataset.route); }));
    }));
    const sp = $("#pcSpark", card);
    if (sp) {
      const id = sp.dataset.city, s = this.model.state;
      Charts.line(sp, { labels: YEARS.map(String), height: 150, hiIdx: YEARS.indexOf(s.year), gaps: YEARS.map((y, i) => ["missing", "unavailable"].includes(yStatus(y).s) ? i : null).filter(i => i != null),
        series: [{ name: "Per 100,000", color: "#1F6FA3", values: YEARS.map(y => tbVal(id, y, "rate")), partial: i => yStatus(YEARS[i]).s === "partial" }],
        fmt: x => fmt(x, 1), tipNote: i => yStatus(YEARS[i]).label, aria: `TB cases per 100,000 in ${CITY[id].name} by year` });
    }
    const dy = $("#pcDay", card);
    if (dy) {
      const p = PLACE[dy.dataset.place], s = this.model.state, row = p.week[s.day];
      Charts.bars(dy, { labels: [...Array(24).keys()].map(h => h % 6 === 0 ? hourLabel(h).replace(" ", "") : ""), labelEvery: 1, values: row, max: 100, ticks: [0, 50, 100], unit: "%", height: 130, hi: s.hour,
        color: (i, v) => crowdCSS(v / 100), tip: i => `${hourLabel(i)}<br><b>${row[i] == null ? "Closed" : row[i] + "% · " + busyLevel(row[i])}</b>`, aria: `Forecast crowding at ${p.name} through ${DOW[s.day]}` });
    }
  }
}
