# BestTime foot-traffic forecasts for the shopping malls in Metro Manila (no install needed; Windows PowerShell).
#
#   powershell -ExecutionPolicy Bypass -File tools/fetch-besttime.ps1 -Budget 10              # forecast 10 more malls
#   powershell -ExecutionPolicy Bypass -File tools/fetch-besttime.ps1 -Budget 5 -City makati  # 5 more in one city
#   powershell -ExecutionPolicy Bypass -File tools/fetch-besttime.ps1 -RefreshList            # re-download the mall list
#
# data/places/besttime-malls.json holds every NCR mall BestTime knows (from its Venue Filter, type
# SHOPPING_CENTER) with its city, and the weekly forecast for the malls forecast so far ("week").
# Each run forecasts up to -Budget malls that have no forecast yet, by BestTime venue ID, taking the
# biggest mall (most reviews) of each city in turn so every city gets malls. The file is saved after
# every mall, so a stopped run keeps what it got.
#
# Credits: a forecast costs 2 BestTime forecast credits (-Budget 10 = 20 credits). -RefreshList costs
# 1 query credit per mall returned (about 360). Check the balance at https://besttime.app.
#
# The PRIVATE key never goes into website code. Put it in .besttime.env in the project folder
# (ignored by git, never served by serve.ps1):
#   BESTTIME_API_KEY_PRIVATE=pri_...
# or set the environment variable BESTTIME_API_KEY_PRIVATE.
param([int]$Budget = 0, [string]$City, [switch]$RefreshList)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path $PSScriptRoot -Parent
$outFile = Join-Path $root "data/places/besttime-malls.json"
$geoFile = Join-Path $root "data/geo/ncr-cities.geojson"

$key = $env:BESTTIME_API_KEY_PRIVATE
$envFile = Join-Path $root ".besttime.env"
if (-not $key -and (Test-Path $envFile)) {
  foreach ($line in Get-Content $envFile) { if ($line -match '^\s*BESTTIME_API_KEY_PRIVATE\s*=\s*(\S+)\s*$') { $key = $Matches[1] } }
}
if (-not $key -or $key -notmatch '^pri_[0-9a-f]+$') {
  Write-Host "No BestTime private key. Add BESTTIME_API_KEY_PRIVATE=pri_... to .besttime.env in the project folder." -ForegroundColor Red
  exit 1
}
if (-not $RefreshList -and $Budget -le 0) { Write-Host "Nothing to do. Use -Budget <number of malls> and/or -RefreshList (see the top of this file)."; exit 0 }

function BestTimeError($err) {
  $msg = $err.Exception.Message
  try { $j = $err.ErrorDetails.Message | ConvertFrom-Json; if ($j.message) { $msg = $j.message } } catch { }
  $msg
}
function Save($doc) {
  $doc.fetched = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  [IO.File]::WriteAllText($outFile, ($doc | ConvertTo-Json -Depth 8 -Compress), (New-Object Text.UTF8Encoding $false))
}

$doc = if (Test-Path $outFile) { Get-Content -Raw -Encoding UTF8 $outFile | ConvertFrom-Json } else { [pscustomobject]@{ source = ""; fetched = ""; venues = @() } }
$doc.source = "BestTime (besttime.app): mall list from the Venue Filter (type SHOPPING_CENTER), weekly forecasts from the Forecast API"
$venues = [System.Collections.ArrayList]@($doc.venues)

# ---------- -RefreshList: every SHOPPING_CENTER in the NCR box, kept only inside the 17 city boundaries ----------
if ($RefreshList) {
  $geo = Get-Content -Raw -Encoding UTF8 $geoFile | ConvertFrom-Json
  function InRing($lat, $lng, $r) {
    $in = $false; $j = $r.Count - 1
    for ($i = 0; $i -lt $r.Count; $i++) {
      $xi = $r[$i][0]; $yi = $r[$i][1]; $xj = $r[$j][0]; $yj = $r[$j][1]
      if ((($yi -gt $lat) -ne ($yj -gt $lat)) -and ($lng -lt ($xj - $xi) * ($lat - $yi) / ($yj - $yi) + $xi)) { $in = -not $in }
      $j = $i
    }
    $in
  }
  function CityAt($lat, $lng) {
    foreach ($f in $geo.features) {
      $polys = if ($f.geometry.type -eq "MultiPolygon") { $f.geometry.coordinates } else { , $f.geometry.coordinates }
      foreach ($p in $polys) {
        if ((InRing $lat $lng $p[0]) -and -not (@($p | Select-Object -Skip 1 | Where-Object { InRing $lat $lng $_ }).Count)) { return $f.properties.id }
      }
    }
    $null
  }
  $q = "api_key_private=" + [Uri]::EscapeDataString($key) + "&types=SHOPPING_CENTER&day_int=0&limit=500&lat_min=14.34&lng_min=120.88&lat_max=14.79&lng_max=121.14"
  try { $r = Invoke-RestMethod -Method Get -Uri "https://besttime.app/api/v1/venues/filter?$q" -TimeoutSec 120 }
  catch { Write-Host "BestTime venue filter failed: $(BestTimeError $_)" -ForegroundColor Red; exit 1 }
  if ($r.status -ne "OK") { Write-Host "BestTime venue filter failed: $($r.message)" -ForegroundColor Red; exit 1 }
  $byId = @{}; foreach ($v in $venues) { $byId[$v.id] = $v }
  $added = 0
  foreach ($v in $r.venues) {
    $c = CityAt ([double]$v.venue_lat) ([double]$v.venue_lng)
    if (-not $c) { continue }
    $dw = if ($v.venue_dwell_time_max -gt 0) { [ordered]@{ min = [int]$v.venue_dwell_time_min; max = [int]$v.venue_dwell_time_max } } else { $null }
    $e = $byId[$v.venue_id]
    if ($e) { $e.name = $v.venue_name; $e.address = $v.venue_address; $e.reviews = [int]$v.reviews; $e.rating = $v.rating; continue }
    [void]$venues.Add([pscustomobject][ordered]@{
      id = $v.venue_id; name = $v.venue_name; address = $v.venue_address; city = $c
      lat = [Math]::Round([double]$v.venue_lat, 6); lng = [Math]::Round([double]$v.venue_lng, 6)
      reviews = [int]$v.reviews; rating = $v.rating; dwell = $dw; forecast = $null; week = $null
    }); $added++
  }
  $doc.venues = [object[]]$venues.ToArray(); Save $doc
  Write-Host "Mall list: $($venues.Count) NCR malls ($added new)." -ForegroundColor Green
}

# ---------- -Budget: weekly forecasts by venue ID ----------
# BestTime's week: day_int 0 = Monday; day_raw[0] = 6 AM, so [18..23] are 0-5 AM of the next day.
# The website's week: day 0 = Sunday (JavaScript getDay), hours 0-23 on the clock. Closed hours = null.
function ConvertWeek($r) {
  $week = [object[]]::new(7); for ($d = 0; $d -lt 7; $d++) { $week[$d] = [object[]]::new(24) }
  foreach ($a in $r.analysis) {
    $bd = [int]$a.day_info.day_int
    $closed = @{}; foreach ($ha in $a.hour_analysis) { $closed[[int]$ha.hour] = ([int]$ha.intensity_nr -eq 999) }
    for ($i = 0; $i -lt 24; $i++) {
      $h = ($i + 6) % 24; $jd = ($bd + 1 + [int]($i -ge 18)) % 7
      $week[$jd][$h] = if ($closed[$h]) { $null } else { [int]$a.day_raw[$i] }
    }
  }
  $week
}

if ($Budget -gt 0) {
  # Malls without a forecast, biggest first within each city, then one per city per round.
  $todo = @($venues | Where-Object { -not $_.week -and (-not $City -or $_.city -eq $City) })
  $queues = @{}; foreach ($g in ($todo | Group-Object city)) { $queues[$g.Name] = [System.Collections.Queue]@($g.Group | Sort-Object reviews -Descending) }
  $pick = [System.Collections.ArrayList]@()
  while ($pick.Count -lt $Budget -and @($queues.Values | Where-Object { $_.Count }).Count) {
    foreach ($c in @($queues.Keys | Sort-Object)) { if ($pick.Count -lt $Budget -and $queues[$c].Count) { [void]$pick.Add($queues[$c].Dequeue()) } }
  }
  if (-not $pick.Count) { Write-Host "Every mall$(if ($City) { " in $City" }) already has a forecast." }
  $ok = 0
  foreach ($v in $pick) {
    Write-Host -NoNewline "$($v.city): $($v.name) ... "
    $q = "api_key_private=" + [Uri]::EscapeDataString($key) + "&venue_id=" + [Uri]::EscapeDataString($v.id)
    try { $r = Invoke-RestMethod -Method Post -Uri "https://besttime.app/api/v1/forecasts?$q" -TimeoutSec 90 }
    catch { $m = BestTimeError $_; Write-Host "failed: $m" -ForegroundColor Yellow; if ($m -match "credit") { break } else { continue } }
    if ($r.status -ne "OK" -or -not $r.analysis) { Write-Host "failed: $($r.message)" -ForegroundColor Yellow; if ("$($r.message)" -match "credit") { break } else { continue } }
    $vi = $r.venue_info
    $v.week = ConvertWeek $r
    $v.forecast = (Get-Date).ToString("yyyy-MM-dd")
    if ($vi.venue_dwell_time_max -gt 0) { $v.dwell = [ordered]@{ min = [int]$vi.venue_dwell_time_min; max = [int]$vi.venue_dwell_time_max } }
    $doc.venues = [object[]]$venues.ToArray(); Save $doc
    Write-Host "ok" -ForegroundColor Green; $ok++
    Start-Sleep -Milliseconds 250
  }
  $n = @($venues | Where-Object { $_.week }).Count
  Write-Host "Forecast $ok malls (about $($ok * 2) credits). $n of $($venues.Count) NCR malls now have a forecast."
}
