/* Facilities model: PhilHealth-accredited TB-DOTS facilities in NCR, grouped by map position,
   with the accreditation-status rule and name/address formatting. No DOM; the facilities view renders it. */
import { TB_FACILITIES, TB_FAC_META } from "./static-data-model.js";
import { isoDate, parseIso } from "../utils/format.js";

/* =====================================================================
   TB screening facilities layer.
   Source: PhilHealth, "List of Accredited TB DOTS Clinics for CY 2026",
   updated September 30, 2026 (NCR rows nos. 599–983), and
   https://www.philhealth.gov.ph/partners/providers/
   Positions: each address was matched to its PSGC 2023 barangay and the pin
   sits at that barangay's centre. The City of Manila has no barangay
   boundaries in this build, so its facilities were placed with OpenStreetMap
   by tools/geocode-facilities.py; their `pp` field says how close the pin is.
   Facilities with no position are listed but not drawn. Nothing here is typed in by hand.
   ===================================================================== */
export const FAC_META = TB_FAC_META;

/* How close a pin is to the building, by `pp` (absent = PSGC barangay centre).
   short: tooltips and group lists; long: the facility card. */
export function facPin(f) {
  const b = f.b || "the barangay";
  switch (f.pp) {
    case "place": return { short: "the facility's own position (OpenStreetMap)", long: "The facility's own position in OpenStreetMap, found by its name." };
    case "street": return { short: "on the listed street, not the exact building", long: "On the first street of the listed address (OpenStreetMap). Not the exact building." };
    case "barangay": return { short: `centre of ${b}, not the exact building`, long: `Centre of ${b} in OpenStreetMap, from the address. Not the exact building.` };
    case "district": return { short: `centre of ${b} district, may be some distance away`, long: `Centre of the ${b} district: OpenStreetMap had no closer match, so the facility may be some distance from the pin.` };
    default: return { short: `centre of ${b}, not the exact building`, long: `Centre of ${b}, matched from the address. Not the exact building.` };
  }
}

export const FAC = TB_FACILITIES;

export const FAC_BY = Object.fromEntries(FAC.map(f => [String(f.id), f]));

export const FAC_KIND = {
  hospital: { label: "Hospital", icon: "f-hosp", rank: 3 },
  clinic: { label: "Clinic", icon: "f-clinic", rank: 2 },
  center: { label: "Health center", icon: "f-center", rank: 1 }
};

export const FAC_SECTOR = { G: { label: "Government", color: "#5B3CC4" }, P: { label: "Private", color: "#B5338A" } };

export const FAC_PAST = "#8E9AA3";

/* One pin per position; facilities matched to the same barangay share a pin */
export const FAC_GROUPS = (() => {
  const m = new Map();
  for (const f of FAC) {
    if (f.lat == null || f.lng == null) continue;
    const key = f.lat.toFixed(5) + "," + f.lng.toFixed(5);
    if (!m.has(key)) m.set(key, { key, lat: f.lat, lng: f.lng, city: f.c, b: f.b, ids: [] });
    m.get(key).ids.push(String(f.id));
  }
  return [...m.values()];
})();

export const FAC_GROUP = Object.fromEntries(FAC_GROUPS.map(g => [g.key, g]));

export const FAC_SMALL = new Set(["of", "and", "the", "for", "ng", "sa", "de", "del", "la", "y"]);

export const FAC_KEEP = /^(TB|DOTS|RHU|HC|CHO|NCR|UP|PGH|LCP|MCU|RITM|PNP|AFP|DOH|II|III|IV|VI|VII|VIII|IX|XI|XII|BF|EDSA|SM|PH|NBBS|CAA|3S|PCSO|ER|OPD|BJMP|AH|NHA|GSIS|SSS|PTSI|TRC|QI|FEU|UST|UERM|NKTI|VMMC|JRRMMC)$/;

export function facTitle(t) {
  return String(t || "").toLowerCase().split(/(\s+|\/|-|\(|\))/).map((w, i) => {
    if (!w.trim() || /^[\/()\-\s]+$/.test(w)) return w;
    const up = w.toUpperCase();
    if (FAC_KEEP.test(up.replace(/[.,]/g, ""))) return up;
    if (i > 0 && FAC_SMALL.has(w.replace(/[.,]/g, ""))) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join("").replace(/\bSt\b\.?/g, "St.").replace(/\s+,/g, ",");
}

export const facName = f => facTitle(f.n);

export const facAddress = f => `${facTitle(f.s)}${f.s ? ", " : ""}${facTitle(f.m)}, Metro Manila`;

export const facIsoLabel = iso => { const d = parseIso(iso); return d ? d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : iso; };

/* Accreditation status from the list's expiry date, compared with today's date
   (today can be passed in as "YYYY-MM-DD" so tests can fix the date). */
export function facStatus(f, today = isoDate(new Date())) {
  const ok = f.e >= today;
  return ok ? { ok, text: `Accredited until ${facIsoLabel(f.e)}` }
    : { ok, text: `Accreditation listed until ${facIsoLabel(f.e)}. That date has passed; the list (updated ${facIsoLabel(FAC_META.updated)}) does not show a renewal. Check with PhilHealth or the facility.` };
}

export const facColor = f => facStatus(f).ok ? FAC_SECTOR[f.g].color : FAC_PAST;

/* Directions use the verified name and address from the list (pins are only barangay-level). */
export const facDirections = f => "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(`${facName(f)}, ${facAddress(f)}, Philippines`);

export const FAC_FILTER = { hospital: true, center: true, clinic: true };

export const facVisible = f => FAC_FILTER[f.k] !== false;
