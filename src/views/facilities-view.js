/* Facilities view: pins, facility cards, the left-column panel and the legend for the
   TB Screening Facilities layer. It adds methods to MapView and PlaceDetailsView (a mixin),
   so those classes stay focused on the TB and crowding layers. */
import { FAC, FAC_BY, FAC_FILTER, FAC_GROUP, FAC_GROUPS, FAC_KIND, FAC_META, FAC_PAST, FAC_SECTOR, facAddress, facColor, facDirections, facIsoLabel, facName, facPin, facStatus, facVisible } from "../models/facilities-model.js";
import { cityName } from "../models/places-model.js";
import { $$, icon } from "../utils/dom.js";
import { esc } from "../utils/format.js";
import { MapView } from "./map-view.js";
import { PlaceDetailsView } from "./place-details-view.js";

/* Phone links only for numbers that are clearly a PH mobile (09xxxxxxxxx) or Metro Manila landline (8xxx-xxxx). */
export function facPhone(t) {
  if (!t) return "";
  return esc(t).split(/\s*\/\s*/).map(part => {
    const d = part.replace(/[^\d]/g, "");
    const tel = /^09\d{9}$/.test(d) ? "+63" + d.slice(1) : /^8\d{7}$/.test(d) && !/loc/i.test(part) ? "+632" + d : null;
    return tel ? `<a href="tel:${tel}">${part}</a>` : part;
  }).join(" / ");
}

/* ---------- map: pins ---------- */
MapView.prototype.drawFacilities = function () {
  if (this.mode !== "leaflet") return;
  if (this.layers.fac) this.map.removeLayer(this.layers.fac);
  this.layers.fac = null;
  const s = this.model.state;
  if (s.layer !== "fac") return;
  const z = this.map.getZoom(), big = z >= 12.5, size = big ? 28 : z >= 11.5 ? 20 : 15;
  const selKey = s.selected?.type === "facgrp" ? s.selected.id : s.selected?.type === "fac" ? (FAC_GROUPS.find(g => g.ids.includes(s.selected.id))?.key) : null;
  const pins = [];
  for (const g of FAC_GROUPS) {
    const fs = g.ids.map(id => FAC_BY[id]).filter(facVisible);
    if (!fs.length) continue;
    const lead = fs.slice().sort((a, b) => FAC_KIND[b.k].rank - FAC_KIND[a.k].rank)[0];
    const anyOk = fs.some(f => facStatus(f).ok), gov = fs.filter(f => f.g === "G").length;
    const color = !anyOk ? FAC_PAST : gov >= fs.length - gov ? FAC_SECTOR.G.color : FAC_SECTOR.P.color;
    const sel = selKey === g.key;
    const label = fs.length === 1 ? `${facName(fs[0])}, ${FAC_KIND[fs[0].k].label}, ${FAC_SECTOR[fs[0].g].label}. ${/^barangay/i.test(g.b) || fs[0].pp === "district" ? g.b : "Barangay " + g.b}.` : `${fs.length} TB-DOTS facilities in ${g.b}, ${cityName(g.city)}.`;
    const mk = L.marker([g.lat, g.lng], { keyboard: true, title: label, alt: label, riseOnHover: true, zIndexOffset: sel ? 1000 : fs.length > 1 ? 400 : 300,
      icon: L.divIcon({ className: "fp-wrap", iconSize: [size, size * 1.25], iconAnchor: [size / 2, size * 1.2],
        html: `<span class="fp${sel ? " on" : ""}${anyOk ? "" : " past"}" style="--c:${color};--s:${size}px">${big ? icon(FAC_KIND[lead.k].icon) : ""}${fs.length > 1 ? `<b>${fs.length}</b>` : ""}</span>` }) });
    mk.bindTooltip(fs.length === 1 ? `<b>${esc(facName(fs[0]))}</b><br>${esc(FAC_KIND[fs[0].k].label)} · ${esc(FAC_SECTOR[fs[0].g].label)}<br><small>Pin: ${esc(facPin(fs[0]).short)}</small>`
      : `<b>${fs.length} facilities</b> in ${esc(g.b)}, ${esc(cityName(g.city))}<br><small>Pin: ${esc(facPin(fs[0]).short)}</small>`, { className: "tt", direction: "top", offset: [0, -size] });
    mk.on("click", () => this.handlers.onSelect(fs.length === 1 ? { type: "fac", id: String(fs[0].id) } : { type: "facgrp", id: g.key }));
    pins.push(mk);
  }
  this.layers.fac = L.layerGroup(pins).addTo(this.map);
};

/* ---------- cards ---------- */
Object.assign(PlaceDetailsView.prototype, {
  facSrc(f) {
    return `<p class="fc-src">Source: PhilHealth, <a href="${FAC_META.url}" target="_blank" rel="noopener">${esc(FAC_META.title)}</a>, updated ${facIsoLabel(FAC_META.updated)}${f ? ` (page ${f.p}, no. ${f.id})` : ""}.</p>`;
  },
  facHTML(id) {
    const f = FAC_BY[id], st = facStatus(f), g = FAC_GROUPS.find(x => x.ids.includes(String(f.id)));
    return `${this.head(`${FAC_KIND[f.k].label} · ${FAC_SECTOR[f.g].label}`, facName(f))}
      <section class="pc-sec fc">
        <p class="fc-status${st.ok ? "" : " past"}">${icon(st.ok ? "i-check" : "i-info")}<span>${esc(st.text)}</span></p>
        <dl class="fc-kv">
          <dt>Address</dt><dd class="fc-addr"><span>${esc(facAddress(f))}</span><button type="button" class="icon-btn fc-copy" data-copy="${esc(facAddress(f))}" aria-label="Copy address" title="Copy address">${icon("i-copy")}</button></dd>
          <dt>TB services</dt><dd>TB-DOTS clinic (TB treatment under the DOTS strategy), PhilHealth-accredited</dd>
          <dt>Phone</dt><dd>${f.t ? facPhone(f.t) : `<span class="muted">Not provided in the list</span>`}</dd>
          <dt>Email</dt><dd>${f.em ? f.em.split(" / ").map(e => `<a href="mailto:${esc(e)}">${esc(e)}</a>`).join("<br>") : `<span class="muted">Not provided in the list</span>`}</dd>
          <dt>Map pin</dt><dd>${g ? esc(facPin(f).long) : `<span class="muted">Not on the map: the address could not be matched to a barangay.</span>`}</dd>
        </dl>
        <a class="btn fc-dir" href="${facDirections(f)}" target="_blank" rel="noopener">${icon("i-arrow")}Get directions</a>
        ${g && g.ids.length > 1 ? `<button type="button" class="link fc-back" data-fac="${g.key}" data-factype="facgrp">${g.ids.length} facilities share this pin</button>` : ""}
        ${this.facSrc(f)}
      </section>`;
  },
  facRow(f) {
    const st = facStatus(f);
    return `<li><button type="button" class="fc-row" data-fac="${f.id}"><span class="fc-dot" style="--c:${facColor(f)}">${icon(FAC_KIND[f.k].icon)}</span>
      <span><b>${esc(facName(f))}</b><small>${esc(FAC_KIND[f.k].label)} · ${esc(FAC_SECTOR[f.g].label)}${st.ok ? "" : " · expired"}</small></span></button></li>`;
  },
  facGroupHTML(key) {
    const g = FAC_GROUP[key], fs = g.ids.map(id => FAC_BY[id]);
    return `${this.head("TB-DOTS facilities", `${g.b}, ${cityName(g.city)}`)}
      <section class="pc-sec fc">
        <p class="small muted">${fs.length} facilities share this pin (${esc(facPin(fs[0]).short)}). Select one for details.</p>
        <ul class="fc-list">${fs.map(f => this.facRow(f)).join("")}</ul>
        ${this.facSrc(null)}
      </section>`;
  },
  facMissingHTML() {
    const miss = FAC.filter(f => f.lat == null);
    const by = {};
    miss.forEach(f => (by[f.c] = by[f.c] || []).push(f));
    return `${this.head("TB-DOTS facilities", "Not on the map")}
      <section class="pc-sec fc">
        <p class="small muted">${miss.length} listed facilities have no pin because their address could not be matched to a barangay. Their details and directions still work.</p>
        ${Object.entries(by).sort((a, b) => cityName(a[0]).localeCompare(cityName(b[0]))).map(([c, fs]) => `<h3 class="fc-h">${esc(cityName(c))} <span class="muted">(${fs.length})</span></h3><ul class="fc-list">${fs.map(f => this.facRow(f)).join("")}</ul>`).join("")}
        ${this.facSrc(null)}
      </section>`;
  },
  cityFacHTML(id) {
    const fs = FAC.filter(f => f.c === id);
    return `${this.head("", cityName(id))}
      <section class="pc-sec fc">
        <div class="kpi"><span class="kpi-l">PhilHealth-accredited TB-DOTS facilities</span><span class="kpi-v">${fs.length}</span></div>
        ${fs.length ? `<ul class="fc-list">${fs.sort((a, b) => FAC_KIND[b.k].rank - FAC_KIND[a.k].rank || facName(a).localeCompare(facName(b))).map(f => this.facRow(f)).join("")}</ul>` : `<p class="empty-state">No facility in this city is on the list.</p>`}
        ${this.facSrc(null)}
      </section>`;
  }
});

/* ---------- left column, legend, city style ---------- */
Object.assign(MapView.prototype, {
  renderFacBox(box) {
    const on = FAC.filter(f => f.lat != null);
    const cnt = k => on.filter(f => f.k === k).length;
    box.innerHTML = `<h2 class="ctrl-title fac-title" id="timeTitle">TB Screening Facilities</h2>
      <div class="fac-stats"><p><b class="num">${FAC.length}</b><span>PhilHealth-accredited TB-DOTS in NCR</span></p><p><b class="num">${on.length}</b><span>on the map</span></p></div>
      <p class="fac-cap" id="facCap">Show on the map <span>pins</span></p>
      <div class="fac-filter" role="group" aria-labelledby="facCap">
        ${["hospital", "center", "clinic"].map(k => `<label class="fac-ft"><span class="fc-dot" style="--c:${FAC_SECTOR.G.color}">${icon(FAC_KIND[k].icon)}</span><span>${FAC_KIND[k].label}<small class="num">${cnt(k)}</small></span><input type="checkbox" role="switch" class="switch" data-fk="${k}"${FAC_FILTER[k] !== false ? " checked" : ""}></label>`).join("")}
      </div>
`;
    $$("[data-fk]", box).forEach(c => c.addEventListener("change", () => { FAC_FILTER[c.dataset.fk] = c.checked; this.drawFacilities(); }));
  },
  facLegend() {
    const past = FAC.some(f => !facStatus(f).ok);
    const pin = (c, ic) => `<span class="fc-dot lg-fp" style="--c:${c}">${ic ? icon(ic) : ""}</span>`;
    return `<h3 class="lg-title">TB Screening Facilities</h3>
      <ul class="lg-classes">
        <li>${pin(FAC_SECTOR.G.color)}<span>Government</span><span class="lg-n num">${FAC.filter(f => f.g === "G").length}</span></li>
        <li>${pin(FAC_SECTOR.P.color)}<span>Private</span><span class="lg-n num">${FAC.filter(f => f.g === "P").length}</span></li>
        ${past ? `<li>${pin(FAC_PAST)}<span>Expired</span><span class="lg-n num">${FAC.filter(f => !facStatus(f).ok).length}</span></li>` : ""}
      </ul>
      <ul class="lg-classes lg-kinds">${["hospital", "center", "clinic"].map(k => `<li>${pin("#5E6E78", FAC_KIND[k].icon)}<span>${FAC_KIND[k].label}</span></li>`).join("")}</ul>
      <p class="lg-note">A number on a pin = facilities sharing one position. PhilHealth list, ${facIsoLabel(FAC_META.updated)}.</p>`;
  },
  facCityStyle(id) {
    const sel = this.model.state.selected?.type === "city" && this.model.state.selected.id === id;
    return { color: sel ? "#3A2785" : "#5B3CC4", weight: sel ? 3 : 1, opacity: sel ? 1 : 0.55, fillColor: "#5B3CC4", fillOpacity: sel ? 0.08 : 0.03 };
  },
  facCityTip(id) {
    const n = FAC.filter(f => f.c === id).length;
    return `<b>${esc(cityName(id))}</b><br>${n} TB-DOTS facilit${n === 1 ? "y" : "ies"} on the PhilHealth list`;
  },
  facZoom(sel) {
    if (sel.type === "facmiss") return true;
    const g = sel.type === "facgrp" ? FAC_GROUP[sel.id] : FAC_GROUPS.find(x => x.ids.includes(sel.id));
    if (g) { this.map.setView([g.lat, g.lng], Math.max(this.map.getZoom(), 14)); return true; }
    const f = FAC_BY[sel.id];
    if (f) this.layers.cities.eachLayer(l => { if (l.feature.properties.id === f.c) this.map.fitBounds(l.getBounds(), { ...this.pad(), maxZoom: 12.5 }); });
    return true;
  }
});
