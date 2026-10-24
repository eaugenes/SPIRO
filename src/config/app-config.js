/* =====================================================================
   App configuration: the one place that says where data files live.
   Imported by the loader, models and tests so they all read the same paths. No secrets or keys belong here.
   ===================================================================== */

export const APP_CONFIG = Object.freeze({
  /* The four cleaned data files (columns fixed by docs/data-contract.md). */
  dataBase: "data/",
  /* Test mode: "?fixtures=<name>" reads tests/fixtures/<name>/ instead, on localhost only. */
  fixturesBase: "tests/fixtures/",
  /* Fixture names are restricted to lower-case letters, digits and dashes, so a URL
     parameter can never point outside tests/fixtures/ (no "../", slashes or dots). */
  fixtureName: /^[a-z0-9-]{1,40}$/,
  localHosts: ["localhost", "127.0.0.1", "[::1]"],
  /* Fixed reference data the map needs (loaded by src/models/static-data-model.js). */
  staticData: Object.freeze({
    ncrCities: "data/geo/ncr-cities.geojson",
    ncrOutline: "data/geo/ncr-outline.json",
    cityLabels: "data/geo/city-label-points.json",
    publicPlaces: "data/places/public-places.json",
    facilities: "data/facilities/facilities.json",
    /* Optional: NCR malls and their BestTime forecasts, made by tools/fetch-besttime.ps1. */
    besttimeMalls: "data/places/besttime-malls.json"
  })
});
