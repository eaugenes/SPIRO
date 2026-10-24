/* ---------- The model ---------- */
import { FAC_BY, FAC_GROUP } from "./facilities-model.js";
import { CITY, PLACE, cityName } from "./places-model.js";
import { DEFAULT_YEAR } from "./tb-data-model.js";
import { Emitter } from "../utils/emitter.js";
import { isoDate } from "../utils/format.js";
import { session } from "../utils/storage.js";

export class AppModel extends Emitter {
  constructor() {
    super();
    const now = new Date();
    this.state = {
      route: "map",           // intro | map | admin | dictionary
      adminTab: "tb",         // tb | crowd | reports
      layer: "tb",            // tb | crowd
      year: DEFAULT_YEAR,     // 2025 by default
      // the map shows one TB indicator, case_count. The Cases | Per 100k switch was
      // removed; per-100k values stay in the staff tables, card and charts.
      date: isoDate(now),     // chosen calendar date (sets the weekday)
      day: now.getDay(),
      hour: now.getHours(), minute: now.getMinutes(), second: 0,
      selected: null,         // { type: "city" | "place", id }
      navOpen: false,
      isAdmin: session.get("tbmap.adminSession", false) === true
    };
  }
  get(key) { return this.state[key]; }
  set(patch) {
    const changed = Object.keys(patch).filter(k => this.state[k] !== patch[k]);
    if (!changed.length) return;
    Object.assign(this.state, patch);
    if (changed.includes("isAdmin")) this.state.isAdmin ? session.set("tbmap.adminSession", true) : session.remove("tbmap.adminSession");
    this.emit("change", changed);
  }

  /* Place lookups shared by map, cards and the report form. */
  placeLabel(sel) {
    if (!sel) return "";
    return sel.type === "city" ? cityName(sel.id) : `${PLACE[sel.id].name}, ${CITY[PLACE[sel.id].city].name}`;
  }
  placeExists(sel) { return !!sel && (sel.type === "city" ? !!CITY[sel.id] : sel.type === "fac" ? !!FAC_BY[sel.id] : sel.type === "facgrp" ? !!FAC_GROUP[sel.id] : sel.type === "facmiss" ? true : !!PLACE[sel.id]); }
  busyAt(place) { return place.week[this.state.day][this.state.hour]; }
}
