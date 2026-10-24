/* =====================================================================
   AppController: routes, the overlay menu, panels (Admin, data
   dictionary) and the front-end log-in.

   Routes (URL hash):
     #intro (or no hash)   introduction page, with the TB Health Guide
     #map                  map
     #guide                scrolls the introduction page to the TB Health Guide
     #dictionary           data dictionary
     #admin/tb | #admin/crowd   Admin (after log in)
   ===================================================================== */

import { MapController } from "./map-controller.js";
import { AppModel } from "../models/app-model.js";
import { FAC } from "../models/facilities-model.js";
import { CITIES, PLACES } from "../models/places-model.js";
import { Prefs } from "../models/settings-model.js";
import { DEFAULT_YEAR, YEARS, tbVal } from "../models/tb-data-model.js";
import { ContractData } from "../services/contract-loader.js";
import { $, toast } from "../utils/dom.js";
import { isoDate, parseIso } from "../utils/format.js";
import { ADMIN_TABS, AdminView } from "../views/admin-view.js";
import { DataModelView } from "../views/data-model-view.js";
import { IntroView } from "../views/intro-view.js";
import { applyTheme } from "../views/helpers/theme.js";
import { LoginView } from "../views/login-view.js";
import { AuthService } from "../services/auth-service.js";
import { MapView } from "../views/map-view.js";
import { NavigationView } from "../views/navigation-view.js";
import { PlaceDetailsView } from "../views/place-details-view.js";

export class AppController {
  constructor() {
    this.model = new AppModel();
    this.mapView = new MapView(this.model);
    this.navView = new NavigationView(this.model);
    this.placeView = new PlaceDetailsView(this.model);
    this.adminView = new AdminView(this.model);
    this.introView = new IntroView();
    this.mapCtl = new MapController(this.model, this.mapView, this.placeView, this);
    this.settings = Prefs.load(); applyTheme(this.settings.theme); Prefs.current = this.settings;
    this.pendingRoute = null;
  }

  start() {
    this.navView.init({
      onToggleNav: () => this.model.set({ navOpen: !this.model.state.navOpen }),
      onCloseNav: () => this.closeNav(true),
      onNavigate: route => { this.closeNav(false); this.navigate(route); },
      onFind: sel => { this.closeNav(false); this.navigate("map"); this.mapCtl.select(sel, true); setTimeout(() => $("#placeTitle")?.focus({ preventScroll: true }), 350); },
      onLogin: () => { this.closeNav(false); this.openLogin(null); },
      onLogout: () => { this.closeNav(false); this.logout(); },
      onPrefs: v => { this.settings = v; Prefs.current = v; Prefs.save(v); applyTheme(v.theme); this.mapView.drawLabels(); this.mapView.drawPlaces(); }
    });
    this.mapCtl.init();
    this.adminView.init({
      onTab: (tab, focus) => { this.navigate("admin/" + tab); if (focus) setTimeout(() => $("#tab-" + tab)?.focus(), 0); },
      onRerender: () => this.renderSheet(true),
      onOpenPlace: (sel, date) => {
        /* Open the map on the same date the report shows */
        const d = parseIso(date) || new Date();
        this.model.set({ layer: "crowd", day: d.getDay(), date: isoDate(d) }); this.navigate("map"); this.mapCtl.select(sel, true);
      }
    });

    this.model.on("change", changed => this.onModelChange(changed));

    $("#backBtn").addEventListener("click", () => this.navigate("intro"));
    $("#sheetClose").addEventListener("click", () => this.navigate("map"));
    $("#sheetScrim").addEventListener("click", () => this.navigate("map"));
    $("#modalScrim").addEventListener("click", () => LoginView.close());
    $("[data-skip]").addEventListener("click", e => { e.preventDefault(); $("#map").setAttribute("tabindex", "-1"); $("#map").focus(); });
    document.addEventListener("keydown", e => this.onKey(e));
    window.addEventListener("hashchange", () => this.applyRoute());
    window.addEventListener("resize", () => { clearTimeout(this._rz); this._rz = setTimeout(() => this.rerenderCharts(), 200); });
    this.placeCardSlot();
    this.applyRoute();
  }

  /* On wide screens the selected card floats in the top-right corner, under the logo and above
     the map controls; on narrow screens it sits under the map. */
  placeCardSlot() {
    const br = $(".br-stack"), set = () => document.documentElement.style.setProperty("--br-h", (br ? br.offsetHeight : 0) + "px");
    if (br && window.ResizeObserver) new ResizeObserver(set).observe(br); set();
    this.mapView.invalidate();
  }

  /* ---------- routing ---------- */
  navigate(route, opts = {}) {
    if (location.hash.slice(1) === route) this.applyRoute(); else location.hash = route;
  }
  parse() {
    const h = location.hash.replace(/^#/, "");
    if (h.startsWith("admin")) return { route: "admin", tab: ADMIN_TABS[h.split("/")[1]] ? h.split("/")[1] : "tb" };
    if (h === "dictionary") return { route: h };                  /* #report and #overview removed; they open the map */
    if (h === "guide") return { route: "intro", jump: "in-guide" }; /* The guide now lives on the introduction page */
    if (h === "" || h === "intro") return { route: "intro" };       /* The introduction is the first page on opening the site */
    return { route: "map" };
  }
  applyRoute() {
    const r = this.parse();
    if (r.route === "admin" && !this.model.state.isAdmin) {
      history.replaceState(null, "", "#map");
      this.model.set({ route: "map" });
      this.showRoute();
      this.openLogin("admin/" + r.tab);
      return;
    }
    /* Leaving the map closes map popups and the Settings overlay. */
    const leave = r.route !== this.model.state.route;
    this.model.set({ route: r.route, ...(r.tab ? { adminTab: r.tab } : {}), ...(leave ? { navOpen: false } : {}), ...(leave && r.route !== "map" ? { selected: null } : {}) });
    this.showRoute();
    if (r.jump) {
      history.replaceState(null, "", "#intro");
      const t = document.getElementById(r.jump);
      if (t) { t.scrollIntoView({ block: "start" }); t.focus({ preventScroll: true }); }
    }
  }
  showRoute() {
    const route = this.model.state.route;
    this.mapView.invalidate();
    const sheetOpen = ["admin", "dictionary"].includes(route);
    $("#sheet").hidden = !sheetOpen; $("#sheetScrim").hidden = !sheetOpen;
    document.body.classList.toggle("sheet-open", sheetOpen);
    if (sheetOpen) { this.renderSheet(false); $("#sheet").focus({ preventScroll: true }); }
    const intro = route === "intro", ib = $("#intro");
    if (intro) { this.renderIntro(); if (ib.hidden) { ib.hidden = false; ib.scrollTop = 0; ib.focus({ preventScroll: true }); } } else ib.hidden = true;
    $("#mapStage").toggleAttribute("inert", intro); $("#mapStage").setAttribute("aria-hidden", String(intro));
    this.placeView.render();
    document.title = { intro: "SPIRO · Metro Manila TB map", map: "SPIRO", admin: "Admin · SPIRO", dictionary: "Data dictionary · SPIRO" }[route];
    if (ContractData.source.test) document.title = "[TEST DATA] " + document.title;
  }

  renderSheet(keepScroll) {
    const s = this.model.state, body = $("#sheetBody"), y = body.scrollTop;
    const active = document.activeElement && document.activeElement.id;
    $("#sheet").dataset.kind = s.route;
    if (s.route === "dictionary") { $("#sheetTitle").textContent = "Data dictionary"; body.innerHTML = DataModelView.dictionaryHTML(); }
    else if (s.route === "admin") { $("#sheetTitle").textContent = "Admin: " + ADMIN_TABS[s.adminTab]; body.innerHTML = this.adminView.html(s.adminTab); this.adminView.bind(body, s.adminTab); }
    body.scrollTop = keepScroll ? y : 0;
    if (keepScroll && active && document.getElementById(active)) document.getElementById(active).focus({ preventScroll: true });
  }

  /* ---------- model changes ---------- */
  onModelChange(changed) {
    const c = new Set(changed);
    /* The menu/Settings overlay closes when something is selected on the map. */
    if (c.has("selected") && this.model.state.selected && this.model.state.navOpen) this.model.set({ navOpen: false });
    this.mapView.render(changed);
    this.navView.render(changed);
    if (["selected", "year", "day", "hour", "date", "minute", "second", "isAdmin", "layer"].some(k => c.has(k))) this.placeView.render();
    if (c.has("selected") && !c.has("route")) this.mapView.invalidate();
  }
  rerenderCharts() {
    this.placeView.render();
    if (["admin"].includes(this.model.state.route)) this.renderSheet(true);
    this.mapView.invalidate();
  }

  /* ---------- menu ---------- */
  closeNav(returnFocus) { if (!this.model.state.navOpen) return; this.model.set({ navOpen: false }); if (returnFocus) $("#navBtn").focus(); }

  /* ---------- log in / log out for the one admin account (AuthService) ----------
     No sign-up. The log-in lasts for this browser tab (app-model.js keeps it in sessionStorage). */
  openLogin(route) {
    this.pendingRoute = route;
    LoginView.open({ onSubmit: form => this.submitAuth(form) }, null);
  }
  async submitAuth({ username, password }) {
    await AuthService.logIn(username, password);
    this.finishLogin();
  }
  /* Logging in does not open the Admin panel: the admin tools appear in the map's left column.
     Only an admin page asked for before logging in (an #admin/... link) opens. */
  finishLogin() {
    LoginView.close();
    this.model.set({ isAdmin: true });
    toast("Logged in. LGU Admin tools are in the left panel of the map.");
    if (this.pendingRoute) this.navigate(this.pendingRoute);
    else if (this.model.state.route !== "map") this.navigate("map");
    this.pendingRoute = null;
  }
  async logout() {
    await AuthService.logOut();
    this.model.set({ isAdmin: false });
    toast("Logged out.");
    if (this.model.state.route === "admin") this.navigate("map");
  }

  /* Introduction page: the controller gathers the numbers, IntroView draws them. */
  renderIntro() {
    const y = DEFAULT_YEAR;
    this.introView.render(
      { year: y, firstYear: YEARS[0], total: tbVal("all", y, "count"), cityCount: CITIES.length, placeCount: PLACES.length,
        facCount: FAC.length, facMapped: FAC.filter(f => f.lat != null).length, isAdmin: this.model.state.isAdmin },
      {
        onNavigate: route => this.navigate(route),
        /* Quick actions open the map on one layer: tb | crowd | fac. */
        onOpenMap: layer => { this.model.set({ layer, selected: null }); this.navigate("map"); },
        onLogin: () => this.openLogin(null)
      }
    );
  }

  /* ---------- keyboard ---------- */
  onKey(e) {
    if (e.key !== "Escape") return;
    if (LoginView.isOpen()) { LoginView.close(); return; }
    if (this.model.state.navOpen) { this.closeNav(true); return; }
    if (!$("#sheet").hidden) { this.navigate("map"); return; }
    if (this.model.state.selected) this.mapCtl.clear();
  }
}
