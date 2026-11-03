# Weather CrossPoint Plugin

Show current conditions and a forecast on the CrossPoint sleep screen. The
Cloudflare Worker renders a 480×800, 1-bit BMP at `GET /weather.bmp`.

## Features

- Search for a city in the CrossPoint web interface and save its coordinates.
- Show current, hourly, and daily weather in the reader's local forecast
  timezone.
- Choose Celsius or Fahrenheit in the plugin settings.
- Download the generated image to `/sleep.bmp` when the reader enters sleep.

City search uses Open-Meteo Geocoding. Postal-code search is not supported.

The Worker caches successful BMP responses at Cloudflare for one hour. It
rate-limits requests that reach the Worker to 20 per source IP per minute; this
is an approximate limit applied separately at each Cloudflare location.

## Install the plugin

1. Install the `weather.crosspoint-plugin` payload from Plugin Hub, or
   manually copy the files listed in
   [`weather.crosspoint-plugin/manifest.json`](weather.crosspoint-plugin/manifest.json)
   from the `weather.crosspoint-plugin/` folder into `/plugins/weather/` on the
   reader's SD card. Copy the files inside that folder, not the enclosing folder.
2. Open the Weather settings in the CrossPoint web interface.
3. Search for a city, select the matching result, and save it. Choose the
   temperature unit at the bottom of the settings.
4. Put the reader to sleep to download the updated `/sleep.bmp`.

The initial configuration uses Berlin and Celsius. The plugin settings save
the city coordinates and temperature unit in the plugin's `config.json` on the
SD card.

### Pointing the plugin to another Worker

The Worker endpoint is stored in the `worker_url` field in the payload's
`config.json`. It defaults to this project's deployed endpoint:

```json
"worker_url": "https://crosspointer-weather-plugin.johnny353535.workers.dev/weather.bmp"
```

You can replace that value by hand with your own deployed Worker URL. Keep it
as the base endpoint ending in `/weather.bmp`; the plugin appends the location
and unit query parameters. The settings interface does not edit this field.
Older installations are updated with the default URL when the settings page
loads. If that automatic update fails, add `worker_url` to the existing
`config.json` manually.

## Run and deploy the Worker

```sh
cd worker
npm ci
npm run dev
```

Deploy with:

```sh
cd worker
npm run deploy
```

After deploying your own Worker, copy its `/weather.bmp` URL into the
payload's `config.json` as described above.

## Attribution and bundled assets

The settings page credits Open-Meteo and its weather-model providers and links
to the [CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/).
Weather data is adapted and rendered into the sleep-screen image. The bundled
Inter font is distributed under the SIL Open Font License; see
[`worker/src/Inter-LICENSE.txt`](worker/src/Inter-LICENSE.txt). Weather icons
come from [`lucide-static`](https://github.com/lucide-icons/lucide) under the
ISC license.

## Privacy and location data

The reader sends the selected city and coordinates to this Worker to generate
the weather image. The Worker configuration redacts query strings from its
observability logs and disables persisted invocation logs, so location query
parameters are not retained in the Worker's stored observability logs. The
Worker forwards the coordinates to Open-Meteo to retrieve the forecast.
Open-Meteo states that its API troubleshooting logs may include coordinates
and are deleted after 90 days; see its [privacy terms](https://open-meteo.com/en/terms).

## SVG layout

The Worker fills the text nodes in `worker/src/weather.svg`. If a Figma export
changes the text-node IDs or ordering, update `renderSvg` in
`worker/src/index.ts`. Lucide icons are selected from Open-Meteo WMO weather
codes and placed at the layout coordinates in the Worker.
