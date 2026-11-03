CrossPoint.registerPlugin(async (container, api) => {
	const configPath = api.dir + '/config.json';
	const defaultWorkerUrl = 'https://crosspointer-weather-plugin.johnny353535.workers.dev/weather.bmp';
	container.innerHTML = `
		<h2>Weather location</h2>
		<p id="weather-location-status">Loading saved location…</p>
		<div class="setting-row">
			<span class="setting-name">Search city</span>
			<span class="setting-control"><input id="weather-location-query" type="search" placeholder="e.g. Copenhagen"></span>
		</div>
		<div class="setting-row">
			<span class="setting-name">Results</span>
			<span class="setting-control"><select id="weather-location-results" disabled><option value="">Search for a city first</option></select></span>
		</div>
		<div class="setting-row">
			<button class="btn-small" id="weather-location-search" type="button">Search</button>
			<button class="btn-small btn-add" id="weather-location-save" type="button" disabled>Save location</button>
		</div>
		<p>Choose a result, then save it. The reader uses the saved location the next time it downloads the sleep screen.</p>
		<div class="setting-row">
			<span class="setting-name">Temperature</span>
			<span class="setting-control">
				<select id="weather-temperature-unit" disabled>
					<option value="celsius">Celsius (°C)</option>
					<option value="fahrenheit">Fahrenheit (°F)</option>
				</select>
			</span>
		</div>
		<p>Weather data from <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> and its weather-model providers. Adapted for this sleep screen. Licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.</p>
	`;

	const status = container.querySelector('#weather-location-status');
	const query = container.querySelector('#weather-location-query');
	const results = container.querySelector('#weather-location-results');
	const searchButton = container.querySelector('#weather-location-search');
	const saveButton = container.querySelector('#weather-location-save');
	const temperatureUnit = container.querySelector('#weather-temperature-unit');
	let selectedPlace = null;
	let savedConfig = {};

	function setStatus(message) {
		status.textContent = message;
	}

	function decodeLocation(value) {
		try {
			return decodeURIComponent(value || '');
		} catch {
			return value || '';
		}
	}

	async function loadConfig() {
		try {
			const response = await fetch('/download?path=' + encodeURIComponent(configPath));
			if (!response.ok) return null;
			return await response.json();
		} catch {
			return null;
		}
	}

	searchButton.addEventListener('click', async () => {
		const searchTerm = query.value.trim();
		if (searchTerm.length < 2) {
			setStatus('Enter at least two characters to search.');
			return;
		}

		searchButton.disabled = true;
		saveButton.disabled = true;
		selectedPlace = null;
		results.disabled = true;
		results.replaceChildren(new Option('Searching…', ''));
		setStatus('Searching Open-Meteo cities…');

		try {
			const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
			url.searchParams.set('name', searchTerm);
			url.searchParams.set('count', '10');
			url.searchParams.set('language', 'en');
			url.searchParams.set('format', 'json');
			const response = await api.relay('GET', url.toString(), { Accept: 'application/json' }, '');
			if (response.status < 200 || response.status >= 300) {
				throw new Error('City search returned HTTP ' + response.status);
			}
			const data = JSON.parse(response.body || '{}');
			const places = Array.isArray(data.results) ? data.results : [];
			results.replaceChildren();
			if (!places.length) {
				results.add(new Option('No cities found', ''));
				setStatus('No matching cities found. Try another spelling.');
				return;
			}

			results.add(new Option('Select a city…', ''));
			for (const place of places) {
				if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) continue;
				const details = [place.admin1, place.country].filter(Boolean).join(', ');
				const label = details ? place.name + ' — ' + details : place.name;
				const option = new Option(label, String(places.indexOf(place)));
				results.add(option);
			}
			results.disabled = false;
			results._weatherPlaces = places;
			setStatus('Select the matching city from the results.');
		} catch (error) {
			results.replaceChildren(new Option('Search failed', ''));
			setStatus('Could not search for cities: ' + error.message);
		} finally {
			searchButton.disabled = false;
		}
	});

	results.addEventListener('change', () => {
		const places = results._weatherPlaces || [];
		selectedPlace = results.value === '' ? null : places[Number(results.value)] || null;
		saveButton.disabled = !selectedPlace;
	});

	query.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') searchButton.click();
	});

	saveButton.addEventListener('click', async () => {
		if (!selectedPlace) return;
		saveButton.disabled = true;
		setStatus('Saving location…');
		try {
			const config = {
				...savedConfig,
				// device.json template substitutions use string-valued config entries.
				latitude: String(selectedPlace.latitude),
				longitude: String(selectedPlace.longitude),
				// Event URL templates do not escape query delimiters, so store the label URI-encoded.
				location: encodeURIComponent(selectedPlace.name),
			};
			await api.writeFile(configPath, btoa(JSON.stringify(config)));
			savedConfig = config;
			setStatus('Saved ' + selectedPlace.name + '. It will appear after the next sleep-screen download.');
		} catch (error) {
			setStatus('Could not save the location: ' + error.message);
			saveButton.disabled = false;
		}
	});

	temperatureUnit.addEventListener('change', async () => {
		const previousUnit = savedConfig.unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
		const config = {
			latitude: String(savedConfig.latitude ?? 52.52),
			longitude: String(savedConfig.longitude ?? 13.405),
			location: savedConfig.location || 'Berlin',
			...savedConfig,
			unit: temperatureUnit.value,
		};
		try {
			await api.writeFile(configPath, btoa(JSON.stringify(config)));
			savedConfig = config;
			const locationName = decodeLocation(savedConfig.location || 'Berlin');
			setStatus('Temperature unit saved for ' + locationName + '. It will appear after the next sleep-screen download.');
		} catch (error) {
			temperatureUnit.value = previousUnit;
			setStatus('Could not save the temperature unit: ' + error.message);
		}
	});

	const saved = await loadConfig();
	savedConfig = saved || {};
	let configMigrationFailed = false;
	if (typeof savedConfig.worker_url !== 'string' || !savedConfig.worker_url.trim()) {
		savedConfig.worker_url = defaultWorkerUrl;
		try {
			await api.writeFile(configPath, btoa(JSON.stringify(savedConfig)));
		} catch {
			configMigrationFailed = true;
		}
	}
	temperatureUnit.value = savedConfig.unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
	temperatureUnit.disabled = false;
	if (configMigrationFailed) {
		setStatus('Could not initialize the Worker URL. Add worker_url to config.json on the SD card.');
	} else if (saved && Number.isFinite(Number(saved.latitude)) && Number.isFinite(Number(saved.longitude))) {
		setStatus('Current location: ' + decodeLocation(saved.location || 'Berlin') + '. Search below to change it.');
	} else {
		setStatus('Using Berlin until you choose another location.');
	}
});
