# Weather CrossPoint Plugin

Show the weather on your CrossPoint sleep screen.

This Worker generates the CrossPoint sleep image at `GET /weather.bmp`.

- Fetches current, hourly, and daily weather for Berlin from Open-Meteo.
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

Weather data is provided by [Open-Meteo](https://open-meteo.com/). The bundled
Inter font is distributed under the SIL Open Font License in
`worker/src/Inter-LICENSE.txt`. Lucide icons are provided by
[`lucide-static`](https://github.com/lucide-icons/lucide) under the ISC license.
