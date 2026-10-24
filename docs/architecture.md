# Architecture

SPIRO is a static website: HTML, CSS and JavaScript in the browser, with data read from files in `data/`. There is no server code of its own. There is one admin log-in for LGUs and no sign-up; the username and password are checked in the browser. `serve.ps1` is a small local web server for development.

The JavaScript uses native ES modules (no build step) and follows a Model–View–Controller split:

- **Models** hold data and rules. They never touch the page.
- **Views** draw the page. They read models but do not decide what happens next.
- **Controllers** react to the user (clicks, search, URL changes), update the models and ask views to redraw.
- **Services** fetch and check data files. **Config** says where files live. **Utils** are small shared helpers.

## Folder structure

```
SPIRO.html                 the page: markup, icon sprite, CSS links, one module entry
serve.ps1                  local web server (http://localhost:8000)
assets/
  css/                     base.css (tokens, type), layout.css, components.css, data-states.css
  vendor/leaflet/          Leaflet 1.9.4 map library (classic script, defines L)
data/                      every data file the site reads (see data/README.md)
  geo/                     NCR city boundaries, outline, label points (PSGC 2023)
  places/                  the 52 listed public places (names for malls) and besttime-malls.json (crowding)
  facilities/              PhilHealth TB-DOTS facilities (CSV source + JSON the site loads)
src/
  app.js                   entry: loads main.js and shows a clear message if start-up fails
  main.js                  start-up order: static data → cleaned data files → controllers
  config/app-config.js     data paths, test-mode rules
  services/
    data-service.js        fetchJSON(): checks HTTP status and JSON shape for static files
    contract-loader.js     reads and validates the four cleaned data files (CSV/JSON/Markdown)
    auth-service.js        admin log-in and log-out (one account, checked in the browser)
  models/
    static-data-model.js   loads data/geo, data/places and data/facilities before the app starts
    tb-data-model.js       TB records and predictions: years, values, classes, trends
    places-model.js        cities, public places, typical-week busyness, busy levels
    facilities-model.js    facilities, map grouping, accreditation status
    crowd-model.js         crowding surface from BestTime mall forecasts
    settings-model.js      theme and label preferences (localStorage)
    app-model.js           app state (route, layer, year, date, selection, log-in) with change events
  views/
    map-view.js            Leaflet map, layers, legend
    place-details-view.js  city, place and facility cards
    facilities-view.js     facility pins, cards and panel
    navigation-view.js     menu, settings, search
    intro-view.js          introduction page and its background map
    health-guide-view.js   TB Health Guide (shown on the introduction page)
    admin-view.js          Admin panel (TB history, crowding report)
    login-view.js          front-end log-in window
    data-model-view.js     data dictionary and data-file status
    helpers/               charts, colour scales, source lines, theme
  controllers/
    app-controller.js      routes (#intro, #map, #dictionary, #admin/…; #guide scrolls #intro to the guide), panels, log-in
    map-controller.js      layer switching, filters, selecting cities/places/facilities
  utils/                   dom.js, format.js, storage.js, emitter.js
tests/
  unit-tests.html          calculation and error-case checks (open through serve.ps1)
  contract-tests.html      data loader checks against the fixtures and data/
  fixtures/                test-only data sets (valid, empty, malformed, wrong-header, …)
docs/                      data contract, method notes, this page
```

## Data flow

1. `SPIRO.html` loads Leaflet, then `src/app.js` as a module.
2. `static-data-model.js` fetches the five JSON files in `data/geo`, `data/places` and `data/facilities` through `data-service.js`. A missing or malformed file stops start-up with a message that names the file.
3. `main.js` asks `contract-loader.js` for the four cleaned data files. Each file gets a state (Loaded, No usable rows, Not yet provided, Could not be read, Rejected), and only valid rows reach `tb-data-model.js`.
4. `AppController` creates the model, views and `MapController`, reads the URL hash and draws the first page.
5. User actions go to a controller, which updates `AppModel`. The model emits which keys changed, and the controller redraws only the views that depend on them.
6. On the Crowding tab, picking a city draws that city's BestTime mall forecasts (`crowd-model.js`, data in `data/places/besttime-malls.json`).

## Naming conventions

- Files and folders: lower-case kebab-case (`place-details-view.js`). Models end in `-model.js`, views in `-view.js`, controllers in `-controller.js`.
- Classes: PascalCase (`MapView`, `AppController`). Functions and variables: camelCase. Fixed values: UPPER_SNAKE_CASE (`APP_CONFIG`, `TB_COLORS`).
- Data files: lower-case with dashes or underscores as supplied (`public-places.json`; the four cleaned files keep the names in the data contract).

## Security notes

- No API keys or secrets anywhere in the code. The browser calls no outside data service; BestTime data is downloaded beforehand by `tools/fetch-besttime.ps1`, whose private key stays in the git-ignored `.besttime.env`.
- The admin log-in is checked in the browser (`src/services/auth-service.js`), so anyone can read its username and password in the page code. It only hides the Admin tools from ordinary visitors and is not real security. The data the Admin tools show (including `data/tb_predictions.csv`) is in public files that anyone can download. The log-in lasts until the browser tab is closed.
- Test fixtures load only on localhost and only for names matching `^[a-z0-9-]{1,40}$`, so a URL cannot point outside `tests/fixtures/`.
- Text from data files is escaped before it is put on the page.
