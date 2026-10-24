/* Intro view: the introduction page and its still background map. Draws only; the controller supplies the numbers and handlers. */
import { NCR_GEO, NCR_OUTLINE } from "../models/static-data-model.js";
import { TB_COLORS, tbClass, tbVal } from "../models/tb-data-model.js";
import { $, $$, icon } from "../utils/dom.js";
import { fmt } from "../utils/format.js";
import { MAP_MEASURE } from "./helpers/map-scales.js";
import { HealthGuideView } from "./health-guide-view.js";

export class IntroView {
  constructor() { this.introLf = null; this.introFit = null; this.introRO = null; }

  /* Background map for the introduction: a Leaflet map with the same OpenStreetMap tiles,
     grey outside-NCR mask, NCR outline and TB classes as the map's overview, for the given year.
     It is a still picture: no dragging or zooming. Clicking it opens the full map (bindMapClick). */
  introMap(y) {
    return `<figure class="in-map" aria-hidden="true"><div class="in-lf" id="inLeaflet"></div>
      <figcaption>TB cases per 100,000 people by city, ${y} ·<b>Click the map to open it</b></figcaption></figure>`;
  }

  /* The page content sits on top of the background map, so a click counts as "on the map" when it
     lands inside the map's area and not on text, a card or a control. Keyboard users have the buttons. */
  bindMapClick(onOpen) {
    const intro = $("#intro"), fig = $("#intro .in-map");
    if (!fig) return;
    const CONTENT = "a, button, input, select, label, p, h1, h2, h3, ul, .in-sec, .in-stats, .in-brand";
    const onMap = e => {
      if (e.target.closest(CONTENT) && !e.target.closest(".leaflet-container")) return false;
      const r = fig.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    intro.onclick = e => { if (!e.target.closest(".leaflet-control-attribution") && onMap(e)) onOpen(); };
    intro.onmousemove = e => intro.classList.toggle("over-map", onMap(e));
  }
  initIntroMap(y) {
    if (this.introLf) { this.introLf.remove(); this.introLf = null; }
    const el = $("#inLeaflet");
    if (!el || typeof L === "undefined") return;
    const m = L.map(el, { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, tap: false, zoomSnap: 0.25 });
    m.attributionControl.setPrefix(false);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, referrerPolicy: "strict-origin-when-cross-origin", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(m);
    const WORLD = [[-10, 90], [-10, 150], [35, 150], [35, 90]];
    L.polygon([WORLD, ...NCR_OUTLINE], { interactive: false, stroke: false, fillColor: "#7D8A92", fillOpacity: 0.5 }).addTo(m);
    const geo = L.geoJSON(NCR_GEO, { interactive: false, style: f => {
      const v = tbVal(f.properties.id, y, MAP_MEASURE), k = tbClass(v, MAP_MEASURE);
      return { color: "#FFFFFF", weight: 1.1, opacity: 0.9, fillColor: k < 0 ? "#9AA6AE" : TB_COLORS[k], fillOpacity: k < 0 ? 0.35 : 0.8 };
    } }).addTo(m);
    L.polygon(NCR_OUTLINE, { interactive: false, fill: false, color: "#FFFFFF", weight: 6, opacity: 0.85 }).addTo(m);
    L.polygon(NCR_OUTLINE, { interactive: false, fill: false, color: "#122D40", weight: 2, opacity: 1 }).addTo(m);
    this.introLf = m;
    /* Does nothing once this map has been replaced, so a late timer or resize never touches a removed map. */
    const fit = () => { if (this.introLf !== m) return; m.invalidateSize(); const W = el.clientWidth, wide = W >= 900;
      m.fitBounds(geo.getBounds(), wide ? { paddingTopLeft: [Math.round(W * 0.48), 70], paddingBottomRight: [Math.round(W * 0.06), 40], animate: false } : { paddingTopLeft: [16, 60], paddingBottomRight: [16, 24], animate: false }); };
    this.introFit = fit;
    fit(); setTimeout(fit, 80);
    /* One observer for every redraw; it always calls the current map's fit. */
    if (!this.introRO && window.ResizeObserver) { this.introRO = new ResizeObserver(() => this.introFit?.()); }
    this.introRO?.disconnect(); this.introRO?.observe(el);
  }

  /* Introduction page: the first screen a citizen sees. It leads with the things a resident
     wants to do (get checked, check a place, see their city, learn the signs), followed by
     the TB Health Guide. Numbers come from the loaded files; nothing is typed in by hand. */
  render({ year: y, firstYear, total: n, cityCount: nc, placeCount, facCount, facMapped, isAdmin }, { onNavigate, onOpenMap, onLogin }) {
    const stat = (v, l) => `<div class="in-stat"><b class="num">${v}</b><span>${l}</span></div>`;
    /* A quick action opens the map on one layer (data-layer) or another page (href). */
    const task = (layer, ic, title, text, go) => `<a class="in-task" href="#map" data-layer="${layer}">
      <span class="in-task-ic">${icon(ic, 26)}</span><span class="in-task-t"><b>${title}</b><span>${text}</span></span>
      <span class="in-task-go">${go}${icon("i-arrow")}</span></a>`;
    $("#intro").innerHTML = `${this.introMap(y)}
      <header class="in-top"><span class="in-brand"><img class="logo" src="assets/img/spiro-logo.png" alt="" width="256" height="256"><b>SPIRO</b></span>
        ${isAdmin ? `<a class="btn np-login in-login" href="#admin/tb">Admin</a>` : `<button type="button" class="btn np-login in-login" id="inLogin">Log In</button>`}</header>
      <div class="in-wrap">
        <div class="in-hero">
          <p class="eyebrow">For Metro Manila residents and commuters</p>
          <h1 id="introTitle">SPIRO</h1>
          <p class="in-lead">Stay safe from tuberculosis (TB) in Metro Manila. Find a place to get checked for free, see when malls are usually crowded, and see how many TB cases your city reports.</p>
          <div class="cta"><a class="btn primary lg in-go" href="#map" data-layer="fac">${icon("i-hosp")}Find a TB screening facility${icon("i-arrow")}</a><a class="btn lg" href="#map" data-layer="tb">${icon("i-map")}Explore the map</a></div>
        </div>

        <div class="in-stats">
          ${stat(n == null ? "—" : fmt(n), n == null ? `reported TB cases, ${y} (data not loaded)` : `reported TB cases in Metro Manila, ${y}`)}
          ${stat(facCount, "TB screening facilities")}
          ${stat(placeCount, "malls with crowding forecasts")}
        </div>

        <section class="in-sec in-tasks-sec" aria-labelledby="inTasks"><h2 id="inTasks">What would you like to do?</h2>
          <div class="in-tasks">
            ${task("fac", "i-hosp", "Get checked for TB", `${facCount} TB-DOTS facilities listed, ${facMapped} of them on the map. Testing and treatment are free in public health centers.`, "Find a facility")}
            ${task("crowd", "i-people", "Check if a mall is busy", `Usual crowding at ${placeCount} malls, from BestTime forecasts. Pick a city, a day and a time before you go.`, "Check crowding")}
            ${task("tb", "i-chart", "See TB cases in my city", `Reported TB cases for ${nc} cities and municipality, ${firstYear}–${y}.`, "View my city")}
            <a class="in-task" href="#in-guide" data-jump="in-guide"><span class="in-task-ic">${icon("i-book", 26)}</span><span class="in-task-t"><b>Learn about TB</b><span>Signs to watch for, how TB spreads, and how to protect your family.</span></span>
              <span class="in-task-go">Read the guide${icon("i-arrow")}</span></a>
          </div></section>

        <section class="in-sec in-guide" id="in-guide" aria-labelledby="inGuide" tabindex="-1"><h2 id="inGuide">${HealthGuideView.title}</h2>
          ${HealthGuideView.html()}</section>

        <p class="in-note">${icon("i-info")}<span>Crowding is a BestTime forecast of a usual week at malls, not live. A busy place does not mean TB is spreading there. Wear a mask, keep windows open and cover your cough in crowded indoor places.</span></p>
        <p class="in-src">Data: DOH Field Health Services Information System (FHSIS) TB tables · PhilHealth TB-DOTS facility list · PSA PSGC 2023 boundaries · © OpenStreetMap contributors.</p>
      </div>`;
    /* Links that jump within the page (the TB Health Guide) are handled by HealthGuideView.bind. */
    $$("#intro a[href^='#']:not([data-jump])").forEach(a => a.addEventListener("click", e => {
      e.preventDefault();
      if (a.dataset.layer) onOpenMap(a.dataset.layer); else onNavigate(a.getAttribute("href").slice(1));
    }));
    HealthGuideView.bind($("#intro"));
    this.bindMapClick(() => onOpenMap("tb"));
    $("#inLogin")?.addEventListener("click", onLogin);
    this.initIntroMap(y);
  }

}
