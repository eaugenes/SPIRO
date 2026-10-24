<a id="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <img src="assets/img/spiro-logo.png" alt="SPIRO logo" width="80" height="80">

<h3 align="center">SPIRO</h3>

  <p align="center">
    A map of <b>tuberculosis (TB) cases</b>, <b>crowding</b> and <b>TB screening facilities</b> across the 17 cities and municipality of Metro Manila.
    <br />
    <a href="docs/architecture.md"><strong>Explore the docs »</strong></a>
    <br />
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#problem-it-solves">Problem It Solves</a></li>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li><a href="#features">Features</a></li>
    <li><a href="#screenshots">Screenshots</a></li>
    <li><a href="#datasets">Datasets</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#project-structure">Project Structure</a></li>
    <li><a href="#references">References</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

[![SPIRO introduction page][intro-screenshot]](docs/screenshots/intro.png)

SPIRO is a map website for Metro Manila (NCR) that brings three views together:

- **TB cases:** notified TB cases for each city and the municipality of Pateros, from Department of Health records for 2018–2025. 2025 is shown first.
- **Crowding:** pick a city to see its malls. The heatmap and the city's mall list come only from BestTime foot-traffic forecasts for each mall (a typical week, from anonymised phone visit data), for the date and time you pick. It is a forecast, not a headcount and not live.
- **Facilities:** the 385 PhilHealth-accredited TB-DOTS facilities in NCR, coloured by government or private and marked as hospital, health center or clinic.

SPIRO does not show live data. Crowding is a BestTime forecast of a typical week at malls, and a busy place is not evidence that TB is spreading there.

### Problem It Solves

TB spreads through the air. Risk is higher when people spend long periods close together in crowded, poorly ventilated indoor places. Metro Manila notified 101,500 TB cases in 2025 (DOH FHSIS), yet:

- the public has no simple way to see where cases are reported, or when shared places such as malls, markets and stations are usually busiest;
- people who need a check-up have no simple way to find the nearest accredited TB-DOTS facility;
- health offices have no single view that puts reported cases and crowding side by side to help them target prevention and screening.

SPIRO gives both groups that view on one map, together with plain-language guidance on what to do.

### Built With

**Frontend**
- ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
- ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
- ![JavaScript](https://img.shields.io/badge/JavaScript_(ES_modules)-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
- ![Leaflet](https://img.shields.io/badge/Leaflet_1.9.4-199900?style=for-the-badge&logo=leaflet&logoColor=white)

**Local server**
- ![PowerShell](https://img.shields.io/badge/PowerShell-5391FE?style=for-the-badge&logo=powershell&logoColor=white) (`serve.ps1`, for development only)

**Data and accounts**
- The site reads CSV and JSON files from `data/` (see [Datasets](#datasets)).
- One admin log-in (username and password checked in the browser; no sign-up, no account server)

**APIs**
- **OpenStreetMap** — map tiles
- **BestTime API** — mall list and weekly foot-traffic forecasts, downloaded beforehand by `tools/fetch-besttime.ps1` (private key kept out of the code, in `.besttime.env`)

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- FEATURES -->
## Features
- **TB cases map** with fixed colour classes for every year; select a city to see its notified cases, population and when the data were last updated
- **Crowding heatmap** for any date and time (24-hour HH:MM), with an hour-by-hour chart for each listed place
- **TB screening facilities** with address (copy button), accreditation status, phone, email and a directions link
- **Search** for cities, places and facilities
- **TB Health Guide** on symptoms, prevention and free testing, on the introduction page
- **Admin log-in** for LGUs with one shared username and password (no sign-up)
- **Admin** view after log-in: TB history by city and year, a crowding report, and the 2026 model prediction on city cards
- Introduction page, light and dark themes, and a layout that works on phones
- Clear messages when a data file is missing or does not follow the data contract

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- SCREENSHOTS -->
## Screenshots

<div>
  <h3>TB cases</h3>
    <img src="docs/screenshots/tb-cases.png" alt="TB cases map with the Quezon City card open" width="800">
  <hr>
  <h3>TB screening facilities</h3>
    <img src="docs/screenshots/facilities.png" alt="Facilities map with a facility card open" width="800">
  <hr>
  <h3>TB Health Guide</h3>
    <img src="docs/screenshots/health-guide.png" alt="TB Health Guide page" width="800">
  <hr>
  <h3>Phone</h3>
    <img src="docs/screenshots/phone-map.png" alt="Map on a phone-sized screen" height="600">
</div>

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- DATASETS -->
## Datasets

| Dataset | What it holds | How SPIRO uses it |
|---|---|---|
| DOH Field Health Services Information System (FHSIS) TB tables, NCR: `ID TB 2018.xlsx`, `ID TB 2020–2023.xlsx`, `Tuberculosis_EB 2024.xlsx`, `FINAL Tuberculosis_EB_2025.xlsx` (supplied as `Tuberculosis_DS.zip`); 2019 from the FHSIS 2019 annual report, `FHSIS2019.pdf`, Table 1.E.4.1 | Notified TB cases (all forms) and population for each NCR city, 2018–2025. 2024 counts "new and relapse" only. | Cleaned by the data preparation scripts (`docs/device-b/scripts/`) into `data/cleaned_tb_data.csv` (144 rows: NCR plus 17 cities, 8 years). This is the only source of TB numbers on the map, the cards and the Admin tables. |
| DOH FHSIS Annual 2025, Table 2.F.7.1 | Projected population (all ages) for 2025, by city. The NCR total is 14,015,646. | Population shown on the city cards; the denominator for rates. |
| PSA 2020 Census of Population | City populations in 2020 | Kept for reference (`pop2020`). |
| PSGC 2023 boundaries (PSA), via faeldon/philippines-json-maps (MIT licence) | City, municipality and region polygons | City shapes, the NCR outline and the grey mask outside NCR (`data/geo/`). |
| `data/tb_predictions.csv` and `data/model_evaluation.json` | 2026 predicted TB case rate per 100,000 for each city (ridge mean-reversion model), with its back-test results | Shown only on city cards after the Admin log-in, labelled "Prediction". |
| BestTime foot-traffic forecasts (`data/places/besttime-malls.json`) | NCR malls known to BestTime and, for those forecast so far, the share of each mall's busiest hour for every hour of a typical week | The Crowding heatmap, the city mall lists and mall cards (see `docs/foot-traffic.md`). |
| SPIRO public-place list (`data/places/public-places.json`) | 52 public places with approximate coordinates, each checked to fall inside its city | Gives familiar names to the malls that have a BestTime forecast; places without a forecast are not shown. |
| PhilHealth, *List of Accredited TB DOTS Clinics for CY 2026* (updated September 30, 2026), NCR section, list nos. 599–983 | Name, phone, email, street address, city, accreditation end date and sector of each accredited TB-DOTS facility | `data/facilities/` (385 rows, no duplicates). Each address was matched to its PSGC 2023 barangay to place the pin. Method: [`docs/tb-facilities.md`](docs/tb-facilities.md). |

Field definitions: `data/data_dictionary.md`. Data contract: [`docs/data-contract.md`](docs/data-contract.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- INSTALLATION -->
## Installation

SPIRO needs no install or build step. It runs on Windows with the PowerShell that comes with it.

1. Get the project folder (clone the repository or copy the folder).
2. Open PowerShell in the folder and start the local server:
   ```
   powershell -ExecutionPolicy Bypass -File serve.ps1
   ```
3. The site opens in your default browser at http://localhost:8000 (add `-NoBrowser` to skip this). Keep the PowerShell window open while you use the site; press Ctrl+C to stop it. If port 8000 is already in use, the server picks the next free port (8001, 8002, …) and prints the address to open.

Opening `SPIRO.html` straight from the folder does not work, because browsers block data files on `file://` pages. The site says so if you try.

**Tests:** with the server running, open http://localhost:8000/tests/unit-tests.html (calculations and error cases) and http://localhost:8000/tests/contract-tests.html (data loader). See [`tests/README.md`](tests/README.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- PROJECT STRUCTURE -->
## Project Structure

The code follows a Model–View–Controller split with native ES modules:

```
SPIRO.html          the page
serve.ps1           local web server
assets/             CSS, logo, Leaflet
data/               every data file the site reads
src/
  config/           data paths and settings
  services/         loading and checking data files
  models/           data and rules (no page code)
  views/            what is drawn on the page
  controllers/      what happens when the user acts
  utils/            small shared helpers
tests/              browser test pages and test-only data
docs/               architecture, data contract, method notes
```

Details, data flow and naming conventions: [`docs/architecture.md`](docs/architecture.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- REFERENCES -->
## References

Agafonkin, V. (2023). *Leaflet* (Version 1.9.4) [Computer software]. https://leafletjs.com

Centers for Disease Control and Prevention. (n.d.). *Tuberculosis (TB)*. Retrieved October 24, 2026, from https://www.cdc.gov/tb/

Department of Health. (n.d.). *Field Health Services Information System (FHSIS): Tuberculosis and population tables, National Capital Region, 2018–2025* [Data set]. https://doh.gov.ph/

faeldon. (n.d.). *philippines-json-maps* [Computer software]. GitHub. https://github.com/faeldon/philippines-json-maps

OpenStreetMap contributors. (2026). *OpenStreetMap* [Data set]. OpenStreetMap Foundation. https://www.openstreetmap.org/copyright

BestTime. (n.d.). *BestTime foot traffic forecasts API* [Computer software]. Retrieved October 24, 2026, from https://besttime.app

Philippine Health Insurance Corporation. (2026). *List of accredited TB DOTS clinics for CY 2026* (updated September 30, 2026) [Data set]. https://www.philhealth.gov.ph/partners/providers/

Philippine Statistics Authority. (2021). *2020 Census of Population and Housing* [Data set]. https://psa.gov.ph/

Philippine Statistics Authority. (2023). *Philippine Standard Geographic Code (PSGC)* [Data set]. https://psa.gov.ph/classification/psgc

World Health Organization. (n.d.). *Tuberculosis* [Fact sheet]. Retrieved October 24, 2026, from https://www.who.int/news-room/fact-sheets/detail/tuberculosis

Fonts: Archivo, Public Sans and IBM Plex Mono from Google Fonts (https://fonts.google.com).

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- LICENSE -->
## License

Copyright © 2026 the SPIRO team. All rights reserved. SPIRO's own code, design and documentation may not be copied, modified or redistributed without written permission.

Third-party parts keep their own licences: Leaflet (BSD-2-Clause), OpenStreetMap data (ODbL, © OpenStreetMap contributors) and philippines-json-maps (MIT).

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- MARKDOWN LINKS & IMAGES -->
[intro-screenshot]: docs/screenshots/intro.png
