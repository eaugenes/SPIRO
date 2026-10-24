/* =====================================================================
   MapController: map layer, filters and place selection.
   ===================================================================== */

import { $ } from "../utils/dom.js";
import { parseIso } from "../utils/format.js";

export class MapController {
  constructor(model, mapView, placeView, app) {
    this.model = model; this.view = mapView; this.placeView = placeView; this.app = app;
  }

  init() {
    this.view.init({
      /* Switching layer closes the open card and the Settings overlay. */
      onLayer: layer => { if (layer !== this.model.state.layer) this.model.set({ layer, selected: null, navOpen: false }); },
      onYear: year => this.model.set({ year }),
      onDate: date => this.model.set({ date, day: parseIso(date).getDay() }),
      onTime: (hour, minute, second) => this.model.set({ hour, minute, second }),
      onSelect: sel => this.select(sel, false)
    });
    this.placeView.init({
      onClose: () => this.clear(),
      onSelect: sel => this.select(sel, true),
      onNavigate: route => this.app.navigate(route),
      onTime: (hour, minute, second) => this.model.set({ hour, minute, second })
    });
  }

  select(sel, zoom) {
    this.model.set(sel.type === "place" ? { selected: sel, layer: "crowd" } : sel.type.startsWith("fac") ? { selected: sel, layer: "fac" } : { selected: sel });
    if (zoom) this.view.zoomTo(sel);
    if (window.innerWidth < 900) setTimeout(() => $("#placeCard")?.scrollTo({ top: 0 }), 0);
  }
  clear() { this.model.set({ selected: null }); $("#map").focus?.(); }
}
