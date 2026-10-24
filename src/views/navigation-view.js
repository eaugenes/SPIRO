/* =====================================================================
   NavigationView: hamburger menu (overlay panel) and the
   account button in the top bar.
   ===================================================================== */

import { FAC, FAC_KIND, facAddress, facName } from "../models/facilities-model.js";
import { CATEGORY, CITIES, PLACE, PLACES, cityName } from "../models/places-model.js";
import { Prefs } from "../models/settings-model.js";
import { $, $$, icon, opt } from "../utils/dom.js";
import { esc } from "../utils/format.js";

export class NavigationView {
  constructor(model) { this.model = model; this.handlers = {}; }

  init(handlers) {
    this.handlers = handlers;
    $("#navBtn").addEventListener("click", () => handlers.onToggleNav());
    $("#navScrim").addEventListener("click", () => handlers.onCloseNav());
    $("#topLogout").addEventListener("click", () => handlers.onLogout());
    this.renderSearch();
    this.render(["navOpen", "isAdmin", "route"]);
  }

  render(changed) {
    const c = new Set(changed), s = this.model.state;
    if (c.has("isAdmin") || c.has("route") || c.has("navOpen")) this.renderPanel();
    if (c.has("isAdmin") || c.has("route") || c.has("adminTab")) this.renderAdminBox();
    if (c.has("navOpen")) this.setOpen(s.navOpen);
  }

  /* LGU Admin card in the map's left column: visible only when logged in, one click to each admin page.
     While logged in, the Log out button takes the SPIRO logo's place in the top-right corner. */
  renderAdminBox() {
    const s = this.model.state, box = $("#adminBox");
    box.hidden = !s.isAdmin;
    $(".logo-ph[href]").hidden = s.isAdmin; $("#topLogout").hidden = !s.isAdmin;
    if (!s.isAdmin) { box.innerHTML = ""; return; }
    const cur = s.route === "admin" ? s.adminTab : null;
    const item = (tab, ic, label, sub) => `<a class="adm-item${cur === tab ? " on" : ""}" href="#admin/${tab}" data-route="admin/${tab}"${cur === tab ? ' aria-current="page"' : ""}>${icon(ic)}<span><b>${label}</b><small>${sub}</small></span></a>`;
    box.innerHTML = `<div class="adm-head"><h2 class="ctrl-title" id="adminBoxTitle">LGU Admin</h2></div>
      <div class="adm-list">
        ${item("tb", "i-chart", "TB history", "Cases and rates by year")}
        ${item("crowd", "i-people", "Crowding report", "Busy hours by mall")}
      </div>`;
    $$("[data-route]", box).forEach(a => a.addEventListener("click", e => { e.preventDefault(); this.handlers.onNavigate(a.dataset.route); }));  }

  renderPanel() {
    const s = this.model.state, cur = s.route === "admin" ? "admin/" + s.adminTab : s.route, v = Prefs.current;
    const item = (route, ic, label, sub) => `<a class="np-item${cur === route ? " on" : ""}" href="#${route}" data-route="${route}"${cur === route ? ' aria-current="page"' : ""}>${icon(ic)}<span><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</span></a>`;
    const o = (val, l) => opt(val, l, (v.theme || "system") === val);
    $("#navPanel").innerHTML = `
      <div class="np-head">
        <h2 id="setTitle">Settings</h2>
        <button type="button" class="icon-btn" id="navClose" aria-label="Close settings">${icon("i-close")}</button>
      </div>
      <div class="np-group">
        <p class="np-label">Pages</p>
        ${item("intro", "i-book", "Home", "TB Health Guide and quick links")}
        ${item("map", "i-map", "Map", "TB cases and crowding")}
      </div>
      <div class="np-group">
        <p class="np-label">Display</p>
        <label class="np-set"><span>Theme</span><select id="setTheme">${o("system", "Device setting")}${o("light", "Light")}${o("dark", "Dark")}</select></label>
        <label class="np-set"><span>City names and values<small>Shown when zoomed in</small></span><input type="checkbox" role="switch" class="switch" id="setLabels"${v.labels !== false ? " checked" : ""}></label>
      </div>
      <div class="np-group">
        ${s.isAdmin ? `
          <p class="np-label">Admin</p>
          <p class="np-note">Logged in. The LGU Admin tools are in the left panel of the map.</p>`
        : `<button type="button" class="btn np-login" id="npLogin">Log In</button>`}
      </div>`;
    const p = $("#navPanel");
    $("#navClose").addEventListener("click", () => this.handlers.onCloseNav());
    $$("[data-route]", p).forEach(a => a.addEventListener("click", e => { e.preventDefault(); this.handlers.onNavigate(a.dataset.route); }));
    const upd = () => this.handlers.onPrefs({ theme: $("#setTheme").value, labels: $("#setLabels").checked });
    ["#setTheme", "#setLabels"].forEach(id => $(id).addEventListener("change", upd));
    $("#npLogin")?.addEventListener("click", () => this.handlers.onLogin());  }

  /* Search box in the top bar: cities with TB records in cleaned_tb_data.csv, the malls
     with a BestTime forecast (crowding layer) and the TB-DOTS facilities. */
  renderSearch() {
    /* Cities first, then malls, then facilities. Each row shows the name and its address as far
       as the data goes (city, Metro Manila); malls show no street address. */
    const NCR_ADDR = "Metro Manila (NCR), Philippines";
    const cities = CITIES.map(c => ({ name: cityName(c.id), addr: NCR_ADDR, group: "City / municipality", sel: { type: "city", id: c.id } }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const places = PLACES.map(p => ({ name: p.name, addr: `${CATEGORY[p.cat].label} · ${cityName(p.city)}, ${NCR_ADDR}`, group: "Mall", sel: { type: "place", id: p.id } }))
      .sort((a, b) => cityName(PLACE[a.sel.id].city).localeCompare(cityName(PLACE[b.sel.id].city)) || a.name.localeCompare(b.name));
    const facs = FAC.map(f => ({ name: facName(f), addr: `${FAC_KIND[f.k].label} · ${facAddress(f)}`, group: "TB facility", sel: { type: "fac", id: String(f.id) } }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.findIndex = [...cities, ...places, ...facs];
    const inp = $("#topFind"), list = $("#topFindList"), msg = $("#topFindMsg");
    let hits = [], act = -1;
    const norm = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const match = q => {
      if (!q) return cities;
      const n = norm(q);
      const score = o => { const a = norm(o.name), b = norm(o.addr); return a.startsWith(n) ? 0 : a.split(/[\s(-]+/).some(w => w.startsWith(n)) ? 1 : a.includes(n) ? 2 : b.includes(n) ? 3 : -1; };
      return this.findIndex.map((o, i) => [o, score(o), i]).filter(x => x[1] >= 0).sort((x, y) => (GROUP_RANK[x[0].group] - GROUP_RANK[y[0].group]) || x[1] - y[1] || x[2] - y[2]).map(x => x[0]).slice(0, 12);
    };
    const GROUP_RANK = { "City / municipality": 0, "Mall": 1, "TB facility": 2 };
    const box = inp.closest(".top-search");
    const close = () => { list.hidden = true; box.classList.remove("open"); inp.setAttribute("aria-expanded", "false"); inp.removeAttribute("aria-activedescendant"); act = -1; };
    const hl = t => { const q = inp.value.trim(); if (!q) return esc(t); const i = norm(t).indexOf(norm(q)); return i < 0 ? esc(t) : esc(t.slice(0, i)) + "<mark>" + esc(t.slice(i, i + q.length)) + "</mark>" + esc(t.slice(i + q.length)); };
    const paint = () => {
      let g = "";
      list.innerHTML = hits.map((o, i) => {
        const head = o.group !== g ? `<li class="ts-group" role="presentation">${o.group === "Mall" ? "Malls (crowding forecasts)" : o.group === "TB facility" ? "TB Screening Facilities" : "Cities and municipality"}</li>` : ""; g = o.group;
        return `${head}<li role="option" id="tsOpt${i}" data-i="${i}" aria-selected="${i === act}" class="ts-opt${i === act ? " on" : ""}">${icon(o.sel.type === "city" ? "i-map" : o.sel.type === "fac" ? "i-building" : "i-pin")}<span><b>${hl(o.name)}</b><small>${esc(o.addr)}</small></span></li>`;
      }).join("");
      list.hidden = !hits.length; box.classList.toggle("open", !!hits.length); inp.setAttribute("aria-expanded", String(!!hits.length));
      if (act >= 0) { inp.setAttribute("aria-activedescendant", "tsOpt" + act); $("#tsOpt" + act)?.scrollIntoView({ block: "nearest" }); } else inp.removeAttribute("aria-activedescendant");
    };
    const suggest = () => { msg.hidden = true; hits = match(inp.value.trim()); act = -1; paint(); if (!hits.length && inp.value.trim()) { msg.textContent = "No matching city, mall or facility."; msg.hidden = false; } };
    const pick = o => { inp.value = o.name; close(); inp.blur(); this.handlers.onFind(o.sel); };
    inp.addEventListener("input", suggest);
    inp.addEventListener("focus", suggest);
    inp.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (list.hidden) suggest(); if (!hits.length) return; act = (act + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length; paint(); }
      else if (e.key === "Enter") { e.preventDefault(); const o = hits[act >= 0 ? act : 0]; if (o) pick(o); else if (inp.value.trim()) { msg.textContent = "No matching city, mall or facility."; msg.hidden = false; } }
      else if (e.key === "Escape") { if (!list.hidden) close(); else { inp.value = ""; msg.hidden = true; } }
    });
    list.addEventListener("mousedown", e => e.preventDefault());
    list.addEventListener("click", e => { const li = e.target.closest("[data-i]"); if (li) pick(hits[+li.dataset.i]); });
    inp.addEventListener("blur", () => setTimeout(() => { close(); msg.hidden = true; }, 150));
  }

  /* Cities come only from cleaned_tb_data.csv (cities with at least one valid case
     count). Malls are the crowding layer's places, each with a BestTime forecast. */
  setOpen(open) {
    const p = $("#navPanel"), btn = $("#navBtn");
    p.hidden = !open; $("#navScrim").hidden = !open;
    btn.setAttribute("aria-expanded", open);
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) { requestAnimationFrame(() => (p.querySelector(".np-item.on") || p.querySelector(".np-item"))?.focus()); }
  }
}
