/* "Most malls are closed at this hour" notice for the crowding legend and city card, with a
   button that jumps to the hour when those malls are busiest that day (data-jump-hour). */

import { CITY, FORECAST_MALLS, busiestHour, cityMalls, mostClosed, openCount } from "../../models/places-model.js";
import { DOW, esc, hourLabel, pad2 } from "../../utils/format.js";

/** Notice HTML for a city (or all of NCR when cityId is null), or "" when most of its malls are open. */
export function closedNoticeHTML(cityId, s) {
  const malls = cityId ? cityMalls(cityId) : FORECAST_MALLS;
  if (!mostClosed(malls, s.day, s.hour)) return "";
  const open = openCount(malls, s.day, s.hour), where = cityId ? `${esc(CITY[cityId].name)}'s malls` : "NCR's forecast malls";
  const h = busiestHour(malls, s.day);
  const text = `${open ? `Most of ${where} are` : `All of ${where} are`} usually closed on ${DOW[s.day]}s at ${pad2(s.hour)}:00, so there is little to show.`;
  const btn = cityId && h != null ? ` <button type="button" class="link" data-jump-hour="${h}">Show ${hourLabel(h)}, the busiest hour</button>` : "";
  return `<p class="crowd-closed" role="status">${text}${btn}</p>`;
}
