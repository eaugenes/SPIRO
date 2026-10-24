# TB screening facilities

The Facilities tab shows one pin per PhilHealth-accredited TB-DOTS facility in NCR.

**Source.** PhilHealth, *List of Accredited TB DOTS Clinics for CY 2026*, updated September 30, 2026 (PDF `List-Of-Accredited-TB-Clinics.pdf`, NCR section pages 23–41, list nos. 599–983). Provider page: https://www.philhealth.gov.ph/partners/providers/

**Data files.** `data/facilities/facilities.csv` (385 rows, the extracted list) and `data/facilities/facilities.json` (the same records, which the website loads). Code: `src/models/facilities-model.js` (grouping, status rule, name formatting) and `src/views/facilities-view.js` (pins, cards, panel, legend).

## How the records were built
- Extracted column by column from the PDF text: name, phone, email, street, city, accreditation end date and sector. Nothing was typed by hand.
- Duplicates: none. Nos. 831 and 863 share an address but are different facilities; both are kept.
- Emails: line breaks inside the PDF cells were removed, and every email was checked against a standard email pattern.
- Facility type comes from the name only: Hospital (37), Health center (340), Clinic (8). Sector: Government (367), Private (18).

## How pins were placed
- Each address was matched to its PSGC 2023 barangay inside the listed city. The pin sits at the barangay centre (or at an interior point when the centre falls outside the shape).
- The City of Manila has no barangay boundaries in this build, so its 54 facilities were placed with OpenStreetMap Nominatim by `tools/geocode-facilities.py`. For each one the most precise match inside Manila's boundary was kept: the facility itself, found by name (24); the first street of the address (20); the barangay number in the address (1); or, as a last resort, the centre of the listed district (9: Barrio Obrero, Baseco, Filomenita Legarda, Intramuros, Mary Johnston, Paltoc, Parola, San Sebastian and Tondo health centers or hospitals). The JSON field `pp` records which, and `mt` / `how_located` the match.
- 353 facilities are on the map. 32 are not, because their address had no clear barangay. They still appear in search, with details and directions.
- Facilities sharing a position share one pin with a number.
- Every card says how close its pin is: the barangay centre, the facility's own OpenStreetMap position, the listed street, or the district centre.

## Accreditation dates
Status is computed against the visitor's current date. Six facilities have an end date of Oct 3, 2026. That date has passed, so their pins are grey, they are labelled "Expired", and their card says the list does not show a renewal.

## Card contents
Name, type and sector, accreditation status, address with a copy button, TB services ("TB-DOTS clinic, PhilHealth-accredited", the only service the list verifies), phone and email when the list has them ("Not provided in the list" otherwise), pin precision, a Google Maps directions link built from the listed name and address, and a source line with the page and list number.

## Possible next step
The 32 facilities still without a pin, and the nine Manila facilities at a district centre, could be placed by hand or with a better geocoder. `tools/geocode-facilities.py --city <id>` runs the same OpenStreetMap lookup for another city (1 request per second; answers are cached in `tools/geocode-cache.json`).
