/* Source lines shown under the legend and on cards (presentation of model metadata). */

import { BESTTIME } from "../../models/static-data-model.js";

/** "Forecast: BestTime ... downloaded <date>" for the malls that have a BestTime forecast, or "" without the file. */
export function besttimeSourceHTML() {
  if (!BESTTIME) return "";
  const d = new Date(BESTTIME.fetched).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  return `Forecast: <a href="https://besttime.app" target="_blank" rel="noopener">BestTime</a>, from anonymised phone visit data, downloaded ${d}.`;
}
