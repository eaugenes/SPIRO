# Crowding from BestTime mall forecasts

The Crowding layer shows **only malls that have a BestTime forecast**. Nothing is estimated for other places.

## How it works on the map
1. On the Crowding tab, pick a city: click it on the map or search for it (picking one of its malls works too).
2. The heatmap is drawn inside that city only, from that city's forecast malls for the chosen weekday and hour. Away from the malls it fades out, so places with no forecast are not painted "Low".
3. The city card lists its malls, busiest first, with each mall's level at the chosen time. Select a mall for its card: the day's forecast chart, busiest hour, busy hours (70% or more), quieter hours (under 40%) and typical visit length.
4. With no city chosen there is no heatmap; the legend asks you to pick one.

## Data
- BestTime (besttime.app) builds forecasts from anonymised phone visit data. A forecast gives, for every hour of a typical week, the share (0–100%) of that mall's **own** busiest hour. It is not live and not a headcount.
- `data/places/besttime-malls.json` lists every NCR mall BestTime knows (its Venue Filter, type `SHOPPING_CENTER`, kept only inside the 17 city boundaries, each with its city) and the weekly forecast (`week`) for the malls forecast so far. Malls with `week: null` are not shown.
- In October 2026: 300 NCR malls in the list, 32 with a forecast, in all 15 cities that have BestTime malls (BestTime has none in Navotas or Pateros).
- **One complex, one mall.** BestTime lists some complexes in parts (SM Megamall Building A and Building B, SM Mall of Asia and its North Wing, Greenhills Mall and Promenade). A forecast mall within 320 m of a bigger one (more reviews) is folded into it: it is not a separate place and does not add to the heatmap, and the main mall's card names it under "Includes". So the 32 forecasts count as 29 malls.
- **Listed malls.** A listed mall in `public-places.json` gives its familiar name and id to the biggest forecast mall within 300 m or, failing that, to a forecast mall with the same name within 1 km (listed coordinates are approximate; SM City Sucat and SM City Valenzuela are matched this way). "Same name" ignores case, punctuation and generic words such as SM, City, Mall and Shopping Center. The other forecast malls keep their BestTime names. Listed places with no forecast (other malls, markets, stations, tourist spots) are not shown anywhere: there are no assumed-week estimates.

## Heatmap formula
Because 100% means "this mall's busiest hour", a small mall at its peak would read the same as a huge one. So each mall is weighted by the square root of its number of Google reviews (minimum 100), a stated stand-in for how many people it draws. The surface at a point is the sum over the city's malls of (weight × forecast share for the hour) × distance falloff (sigma 350 m), divided by a fixed reference: the 95th percentile of that sum at all NCR forecast malls, each at its busiest hour. So 100% means the same in every city.

Code: `src/models/crowd-model.js` (surface), `src/models/places-model.js` (mall places, `cityMalls`, `daySummary`), `src/views/map-view.js` (drawing), `src/views/place-details-view.js` (cards).

## Updating the data
`tools/fetch-besttime.ps1` needs the BestTime **private** key in `.besttime.env` (`BESTTIME_API_KEY_PRIVATE=pri_...`). That file is ignored by git and never served by `serve.ps1`; the key is never in website code.

- `-Budget 10` forecasts 10 more malls that have no forecast yet, by BestTime venue ID, taking the biggest mall of each city in turn. **2 forecast credits per mall.** Add `-City makati` to stay in one city. The file is saved after every mall.
- `-RefreshList` re-downloads the mall list. **1 query credit per mall returned (about 360 per run)**, so run it rarely.
- BestTime days start on Monday and each day's 24 values start at 6 AM; the script converts them to SPIRO's week (Sunday = 0, hours 0–23 on the clock). Hours BestTime marks closed are stored as `null`.
- Forecasts change slowly; re-forecasting a mall costs the same 2 credits.

## Where crowding appears
- Map: the chosen city's heatmap, mall markers and mall list; a notice and a "busiest hour" button when most malls are closed at the chosen time.
- Search: the "Malls (crowding forecasts)" group.
- Admin → Crowding report: each mall's forecast by hour for a chosen date, filterable by city.
- Intro page and TB Health Guide: describe crowding as BestTime mall forecasts.

## Limits
- Not a headcount and not live. Only malls are covered; markets, stations and streets are not.
- A city's colours depend on which of its malls have a forecast so far.
- Review counts are only a rough stand-in for mall size.
- A busy place is not evidence that TB is spreading there.
