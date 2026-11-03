# Weather

Shows current conditions and a four-day forecast on the CrossPoint sleep
screen. The image refreshes when the reader enters sleep.

## Set up

Open the Weather settings in the CrossPoint web interface. Search for a city,
select the matching result, and save it. Choose automatic, 12-hour, or 24-hour
time, then choose Celsius or Fahrenheit. Automatic time format follows the
selected city's country. Postal-code search is not supported.

For a manual install, copy the files listed in `manifest.json` from this folder
into `/plugins/weather/` on the reader's SD card. Copy the files inside the
`weather.crosspoint-plugin` folder, not the folder itself.

The default location is Berlin. Settings are saved in this plugin's
`config.json` file on the SD card. To use your own Worker, replace the complete
`worker_url` value in that file with your Worker endpoint ending in
`/weather.bmp`.

The plugin needs Wi-Fi when the sleep screen is refreshed. It sends the
selected city and coordinates to the configured Worker, which requests the
forecast from Open-Meteo. Open-Meteo's free API is for non-commercial use. See
its [terms and privacy information](https://open-meteo.com/en/terms).

Weather data is provided by [Open-Meteo](https://open-meteo.com/) and its
weather-model providers under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
