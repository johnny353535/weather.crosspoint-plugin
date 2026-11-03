# Weather CrossPoint Plugin

Show the weather on your CrossPoint sleep screen.

This Worker generates the CrossPoint sleep image at `GET /weather.bmp`. The
location is selected in the CrossPoint web UI under Settings → Weather.

- Searches cities with Open-Meteo Geocoding and saves the selected coordinates
  in `plugin/config.json` on the reader's SD card.
- The reader passes its saved coordinates and city name to the Worker when the
  sleep image downloads. Requests without coordinates continue to use Berlin.
- Fetches current, hourly, and daily weather for the selected location from
  Open-Meteo, using its local timezone.
- Fills the text nodes in `worker/src/weather.svg`.
- Selects Lucide weather icons from Open-Meteo WMO weather codes.
- Renders the SVG with the bundled Inter font.
- Returns a 480×800, 1-bit BMP suitable for `/sleep.bmp`.

Run locally with:

```sh
cd worker
npm install
npm run dev
```

Deploy with:

```sh
cd worker
npm run deploy
```

The SVG text nodes are replaced by their order in the exported file. If the
Figma export changes its text-node order, update `renderSvg` in
`worker/src/index.ts`. Weather icons are imported from `lucide-static` and
placed by the Worker at the existing layout coordinates.

The CrossPoint plugin includes `manifest.json` and `plugin.js` for the web
settings card, plus `device.json` for the sleep event. Install the `plugin`
folder on the reader's SD card, enable plugins, then choose a city in the
reader's web UI. The first-run config defaults to Berlin.

Weather data is provided by [Open-Meteo](https://open-meteo.com/). The bundled
Inter font is distributed under the SIL Open Font License in
`worker/src/Inter-LICENSE.txt`. Lucide icons are provided by
[`lucide-static`](https://github.com/lucide-icons/lucide) under the ISC license.
