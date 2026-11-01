import { Resvg, initWasm } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import cloud from 'lucide-static/icons/cloud.svg';
import cloudDrizzle from 'lucide-static/icons/cloud-drizzle.svg';
import cloudFog from 'lucide-static/icons/cloud-fog.svg';
import cloudLightning from 'lucide-static/icons/cloud-lightning.svg';
import cloudMoon from 'lucide-static/icons/cloud-moon.svg';
import cloudMoonRain from 'lucide-static/icons/cloud-moon-rain.svg';
import cloudRain from 'lucide-static/icons/cloud-rain.svg';
import cloudSnow from 'lucide-static/icons/cloud-snow.svg';
import cloudSun from 'lucide-static/icons/cloud-sun.svg';
import cloudSunRain from 'lucide-static/icons/cloud-sun-rain.svg';
import interFont from './InterVariable.ttf';
import navigation from 'lucide-static/icons/navigation.svg';
import moon from 'lucide-static/icons/moon.svg';
import sun from 'lucide-static/icons/sun.svg';
import sunrise from 'lucide-static/icons/sunrise.svg';
import svgTemplate from './weather.svg';
import sunset from 'lucide-static/icons/sunset.svg';
import umbrella from 'lucide-static/icons/umbrella.svg';

const WIDTH = 480;
const HEIGHT = 800;
const ROW_BYTES = WIDTH / 8;
const BERLIN_TIMEZONE = 'Europe/Berlin';
const WEATHER_URL = new URL('https://api.open-meteo.com/v1/forecast');
WEATHER_URL.searchParams.set('latitude', '52.52');
WEATHER_URL.searchParams.set('longitude', '13.405');
WEATHER_URL.searchParams.set('current', 'temperature_2m,weather_code,is_day');
WEATHER_URL.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weather_code,is_day');
WEATHER_URL.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset');
WEATHER_URL.searchParams.set('timezone', BERLIN_TIMEZONE);
WEATHER_URL.searchParams.set('forecast_days', '4');

type RecordValue = Record<string, unknown>;

interface WeatherData {
	current: {
		temperature: number;
		weatherCode: number;
		isDay: boolean;
		time: string;
	};
	hourly: {
		time: string[];
		temperature: number[];
		precipitationProbability: number[];
		weatherCode: number[];
		isDay: boolean[];
	};
	daily: {
		time: string[];
		weatherCode: number[];
		maximumTemperature: number[];
		minimumTemperature: number[];
		sunrise: string[];
		sunset: string[];
	};
}

let wasmReady: Promise<void> | undefined;

function initializeWasm(): Promise<void> {
	wasmReady ??= initWasm(resvgWasm);
	return wasmReady;
}

function isRecord(value: unknown): value is RecordValue {
	return typeof value === 'object' && value !== null;
}

function getRecord(value: unknown, name: string): RecordValue {
	if (!isRecord(value)) throw new Error(`Open-Meteo response is missing ${name}`);
	return value;
}

function getNumber(value: unknown, name: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`Open-Meteo response has invalid ${name}`);
	}
	return value;
}

function getNumberArray(value: unknown, name: string): number[] {
	if (!Array.isArray(value)) throw new Error(`Open-Meteo response is missing ${name}`);
	return value.map((entry, index) => getNumber(entry, `${name}[${index}]`));
}

function getBoolean(value: unknown, name: string): boolean {
	return getNumber(value, name) === 1;
}

function getBooleanArray(value: unknown, name: string): boolean[] {
	return getNumberArray(value, name).map((entry) => entry === 1);
}

function getStringArray(value: unknown, name: string): string[] {
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
		throw new Error(`Open-Meteo response has invalid ${name}`);
	}
	return value;
}

function parseWeatherResponse(value: unknown): WeatherData {
	const response = getRecord(value, 'root');
	const current = getRecord(response.current, 'current');
	const hourly = getRecord(response.hourly, 'hourly');
	const daily = getRecord(response.daily, 'daily');

	return {
		current: {
			temperature: getNumber(current.temperature_2m, 'current.temperature_2m'),
			weatherCode: getNumber(current.weather_code, 'current.weather_code'),
			isDay: getBoolean(current.is_day, 'current.is_day'),
			time: typeof current.time === 'string' ? current.time : '',
		},
		hourly: {
			time: getStringArray(hourly.time, 'hourly.time'),
			temperature: getNumberArray(hourly.temperature_2m, 'hourly.temperature_2m'),
			precipitationProbability: getNumberArray(hourly.precipitation_probability, 'hourly.precipitation_probability'),
			weatherCode: getNumberArray(hourly.weather_code, 'hourly.weather_code'),
			isDay: getBooleanArray(hourly.is_day, 'hourly.is_day'),
		},
		daily: {
			time: getStringArray(daily.time, 'daily.time'),
			weatherCode: getNumberArray(daily.weather_code, 'daily.weather_code'),
			maximumTemperature: getNumberArray(daily.temperature_2m_max, 'daily.temperature_2m_max'),
			minimumTemperature: getNumberArray(daily.temperature_2m_min, 'daily.temperature_2m_min'),
			sunrise: getStringArray(daily.sunrise, 'daily.sunrise'),
			sunset: getStringArray(daily.sunset, 'daily.sunset'),
		},
	};
}

async function fetchWeather(): Promise<WeatherData> {
	const response = await fetch(WEATHER_URL, {
		headers: { Accept: 'application/json' },
	});
	if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);
	return parseWeatherResponse(await response.json());
}

function formatTemperature(value: number): string {
	return `${Math.round(value)}°`;
}

function formatHour(value: string): string {
	return value.slice(11, 16);
}

function formatDate(value: string): string {
	return new Intl.DateTimeFormat('en-US', {
		day: 'numeric',
		month: 'long',
		timeZone: 'UTC',
		weekday: 'long',
	}).format(new Date(`${value}T12:00:00Z`));
}

function formatWeekday(value: string): string {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'UTC',
		weekday: 'short',
	})
		.format(new Date(`${value}T12:00:00Z`))
		.toUpperCase();
}

function findCurrentHourIndex(currentTime: string, hourlyTimes: string[]): number {
	const currentHour = `${currentTime.slice(0, 13)}:00`;
	const exactIndex = hourlyTimes.indexOf(currentHour);
	return exactIndex >= 0 ? exactIndex : 0;
}

function escapeXml(value: string): string {
	return value.replace(/[&<>'"]/g, (character) => {
		const entities: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			"'": '&apos;',
			'"': '&quot;',
		};
		return entities[character];
	});
}

function replaceTextNode(node: string, value: string): string {
	let valueIndex = 0;
	return node.replace(/(<tspan\b[^>]*>)([\s\S]*?)(<\/tspan>)/g, (_match, opening: string, _value: string, closing: string) => {
		return `${opening}${escapeXml(valueIndex++ === 0 ? value : '')}${closing}`;
	});
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceTextById(svg: string, id: string, value: string, centerX?: number): string {
	const openingTagPattern = new RegExp(`<text\\b[^>]*\\bid="${escapeRegExp(id)}"[^>]*>`);
	const openingTag = openingTagPattern.exec(svg);
	if (!openingTag || openingTag.index === undefined) {
		throw new Error(`weather.svg is missing text element #${id}`);
	}
	const contentStart = openingTag.index + openingTag[0].length;
	const contentEnd = svg.indexOf('</text>', contentStart);
	if (contentEnd < 0) throw new Error(`weather.svg text element #${id} is not closed`);

	let element = svg.slice(openingTag.index, contentEnd + '</text>'.length);
	if (centerX !== undefined) {
		element = element
			.replace('<text ', '<text text-anchor="middle" ')
			.replace(/(<tspan\b[^>]*\bx=")[^"]*(")/, `$1${centerX}$2`);
	}
	element = replaceTextNode(element, value);
	return `${svg.slice(0, openingTag.index)}${element}${svg.slice(contentEnd + '</text>'.length)}`;
}

function replaceGroupContentsById(svg: string, id: string, contents: string): string {
	const openingTagPattern = new RegExp(`<g\\b[^>]*\\bid="${escapeRegExp(id)}"[^>]*>`);
	const openingTag = openingTagPattern.exec(svg);
	if (!openingTag || openingTag.index === undefined) {
		throw new Error(`weather.svg is missing icon group #${id}`);
	}

	const groupTokens = /<g\b[^>]*>|<\/g>/g;
	groupTokens.lastIndex = openingTag.index + openingTag[0].length;
	let depth = 1;
	let token: RegExpExecArray | null;
	while ((token = groupTokens.exec(svg))) {
		if (token[0].startsWith('</')) depth--;
		else if (!token[0].endsWith('/>')) depth++;
		if (depth === 0) {
			const closingTagStart = groupTokens.lastIndex - token[0].length;
			return `${svg.slice(0, openingTag.index + openingTag[0].length)}${contents}${svg.slice(closingTagStart)}`;
		}
	}
	throw new Error(`weather.svg icon group #${id} is not closed`);
}

function selectWeatherIcon(weatherCode: number, isDay: boolean): string {
	if (weatherCode === 0) return isDay ? sun : moon;
	if (weatherCode === 1 || weatherCode === 2) return isDay ? cloudSun : cloudMoon;
	if (weatherCode === 3) return cloud;
	if (weatherCode === 45 || weatherCode === 48) return cloudFog;
	if (weatherCode >= 51 && weatherCode <= 57) return cloudDrizzle;
	if (weatherCode >= 61 && weatherCode <= 67) return cloudRain;
	if (weatherCode >= 71 && weatherCode <= 77) return cloudSnow;
	if (weatherCode >= 80 && weatherCode <= 82) {
		return isDay ? cloudSunRain : cloudMoonRain;
	}
	if (weatherCode >= 85 && weatherCode <= 86) return cloudSnow;
	if (weatherCode >= 95 && weatherCode <= 99) return cloudLightning;
	return cloud;
}

function placeWeatherIcon(icon: string, x: number, y: number, size: number): string {
	const cleanIcon = icon.replace(/<!--[\s\S]*?-->/g, '');
	const openingTagEnd = cleanIcon.indexOf('>');
	const closingTagStart = cleanIcon.lastIndexOf('</svg>');
	if (openingTagEnd < 0 || closingTagStart < openingTagEnd) {
		throw new Error('Weather icon SVG is malformed');
	}
	const iconContents = cleanIcon
		.slice(openingTagEnd + 1, closingTagStart)
		.replace(/\n/g, '');
	return `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconContents}</g>`;
}

function insertWeatherIcons(
	svg: string,
	weather: WeatherData,
	hourly: Array<{ weatherCode: number; isDay: boolean }>,
	daily: Array<{ weatherCode: number; isDay: boolean }>,
): string {
	const hourlyPositions = [[279.5, 156], [386, 156], [492.5, 156], [598, 156], [703, 156]];
	const dailyPositions = [[620, 334], [620, 374], [620, 414]];
	if (hourly.length !== hourlyPositions.length || daily.length !== dailyPositions.length) {
		throw new Error('weather icon positions do not match the data template');
	}

	const icons: Array<[string, string]> = [
		['icon-location', placeWeatherIcon(navigation, 736, 40, 24)],
		['icon-hour-now', placeWeatherIcon(selectWeatherIcon(weather.current.weatherCode, weather.current.isDay), 40, 156, 48)],
		...hourly.map((forecast, index) => [
			`icon-hour-${index + 1}`,
			placeWeatherIcon(selectWeatherIcon(forecast.weatherCode, forecast.isDay), hourlyPositions[index][0], hourlyPositions[index][1], 48),
		] as [string, string]),
		['icon-umbrella', placeWeatherIcon(umbrella, 78, 322, 24)],
		['icon-sunrise', placeWeatherIcon(sunrise, 210, 322, 24)],
		['icon-sunset', placeWeatherIcon(sunset, 342, 322, 24)],
		...daily.map((forecast, index) => [
			`icon-forecast-${index + 1}`,
			placeWeatherIcon(selectWeatherIcon(forecast.weatherCode, forecast.isDay), dailyPositions[index][0], dailyPositions[index][1], 24),
		] as [string, string]),
	];

	return icons.reduce((result, [id, icon]) => replaceGroupContentsById(result, id, icon), svg);
}

function rotateLandscapeSvgToPortrait(svg: string): string {
	const openingTag = svg.match(/^<svg\b[^>]*>/)?.[0];
	if (!openingTag || !/\bwidth="800"/.test(openingTag) || !/\bheight="480"/.test(openingTag) || !/\bviewBox="0 0 800 480"/.test(openingTag)) {
		throw new Error('weather.svg must use an 800×480 landscape canvas');
	}

	const contentStart = openingTag.length;
	const contentEnd = svg.lastIndexOf('</svg>');
	if (contentEnd < contentStart) throw new Error('weather.svg is missing its closing tag');

	let content = svg.slice(contentStart, contentEnd);
	const defs = content.match(/<defs\b[\s\S]*?<\/defs>/)?.[0] ?? '';
	if (defs) content = content.replace(defs, '');
	const portraitTag = openingTag
		.replace('width="800"', 'width="480"')
		.replace('height="480"', 'height="800"')
		.replace('viewBox="0 0 800 480"', 'viewBox="0 0 480 800"');

	return `${portraitTag}${defs}<g transform="matrix(0 1 -1 0 480 0)">${content}</g></svg>`;
}

function renderSvg(weather: WeatherData): string {
	const currentHourIndex = findCurrentHourIndex(weather.current.time, weather.hourly.time);
	const hourly = Array.from({ length: 5 }, (_, index) => {
		const hourIndex = Math.min(currentHourIndex + index + 1, weather.hourly.time.length - 1);
		return {
			time: formatHour(weather.hourly.time[hourIndex]),
			temperature: formatTemperature(weather.hourly.temperature[hourIndex]),
			weatherCode: weather.hourly.weatherCode[hourIndex],
			isDay: weather.hourly.isDay[hourIndex],
		};
	});
	const daily = [1, 2, 3].map((dayIndex) => ({
		day: formatWeekday(weather.daily.time[dayIndex]),
		maximum: Math.round(weather.daily.maximumTemperature[dayIndex]).toString(),
		minimum: Math.round(weather.daily.minimumTemperature[dayIndex]).toString(),
		weatherCode: weather.daily.weatherCode[dayIndex],
		isDay: true,
	}));

	const textReplacements: Array<[string, string, number?]> = [
		['text-date', formatDate(weather.daily.time[0])],
		['text-city', 'Berlin'],
		['hour-now', formatHour(weather.current.time)],
		['text-hour-now', formatTemperature(weather.current.temperature)],
		['text-high-low', `H: ${formatTemperature(weather.daily.maximumTemperature[0])} L: ${formatTemperature(weather.daily.minimumTemperature[0])}`],
		['chance-of-rain', `${Math.round(weather.hourly.precipitationProbability[currentHourIndex])}%`, 90],
		['chance-of-rain-title', 'RAIN', 90],
		['sunrise-time', formatHour(weather.daily.sunrise[0]), 222],
		['sunrise-title', 'SUNRISE', 222],
		['sunset-time', formatHour(weather.daily.sunset[0]), 354],
		['sunset-title', 'SUNSET', 354],
	];
	for (let index = 0; index < hourly.length; index++) {
		textReplacements.push([`hour-${index + 1}`, hourly[index].time]);
		textReplacements.push([`temperature-hour-${index + 1}`, hourly[index].temperature, [303.5, 410, 516.5, 622, 727][index]]);
	}
	for (let index = 0; index < daily.length; index++) {
		textReplacements.push([`day-forecast-${index + 1}`, daily[index].day]);
		textReplacements.push([`high-low-forecast-${index + 1}`, `${daily[index].maximum}° / ${daily[index].minimum}°`]);
	}

	const renderedSvg = textReplacements.reduce(
		(svg, [id, value, centerX]) => replaceTextById(svg, id, value, centerX),
		svgTemplate,
	);
	return rotateLandscapeSvgToPortrait(insertWeatherIcons(renderedSvg, weather, hourly, daily));
}

function createBmp(pixels: Uint8Array, width: number, height: number): ArrayBuffer {
	if (width !== WIDTH || height !== HEIGHT || pixels.length !== width * height * 4) {
		throw new Error(`Unexpected rendered image size: ${width}x${height}`);
	}

	const pixelDataSize = ROW_BYTES * height;
	const buffer = new ArrayBuffer(62 + pixelDataSize);
	const view = new DataView(buffer);
	const output = new Uint8Array(buffer, 62);

	view.setUint8(0, 0x42);
	view.setUint8(1, 0x4d);
	view.setUint32(2, buffer.byteLength, true);
	view.setUint32(10, 62, true);
	view.setUint32(14, 40, true);
	view.setInt32(18, width, true);
	view.setInt32(22, height, true);
	view.setUint16(26, 1, true);
	view.setUint16(28, 1, true);
	view.setUint32(46, 2, true);

	view.setUint8(54, 0);
	view.setUint8(55, 0);
	view.setUint8(56, 0);
	view.setUint8(57, 0);
	view.setUint8(58, 255);
	view.setUint8(59, 255);
	view.setUint8(60, 255);
	view.setUint8(61, 0);
	output.fill(0xff);

	for (let y = 0; y < height; y++) {
		const outputRow = (height - 1 - y) * ROW_BYTES;
		for (let x = 0; x < width; x++) {
			const pixelIndex = (y * width + x) * 4;
			const alpha = pixels[pixelIndex + 3] / 255;
			const red = pixels[pixelIndex] * alpha + 255 * (1 - alpha);
			const green = pixels[pixelIndex + 1] * alpha + 255 * (1 - alpha);
			const blue = pixels[pixelIndex + 2] * alpha + 255 * (1 - alpha);
			const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
			if (luminance < 200) output[outputRow + (x >> 3)] &= ~(0x80 >> (x & 7));
		}
	}

	return buffer;
}

async function createWeatherBmp(weather: WeatherData): Promise<ArrayBuffer> {
	await initializeWasm();
	const renderer = new Resvg(renderSvg(weather), {
		background: '#ffffff',
		fitTo: { mode: 'original' },
		font: {
			defaultFontFamily: 'Inter',
			fontBuffers: [new Uint8Array(interFont)],
			loadSystemFonts: false,
			sansSerifFamily: 'Inter',
		},
	});
	const image = renderer.render();
	try {
		return createBmp(image.pixels, image.width, image.height);
	} finally {
		image.free();
		renderer.free();
	}
}

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname !== '/weather.bmp') {
			return new Response('Not found', { status: 404 });
		}

		try {
			const weather = await fetchWeather();
			const bmp = await createWeatherBmp(weather);
			return new Response(bmp, {
				headers: {
					'Cache-Control': 'no-store',
					'Content-Type': 'image/bmp',
				},
			});
		} catch (error) {
			console.error('Weather image generation failed', error);
			return new Response('Weather image generation failed', { status: 502 });
		}
	},
} satisfies ExportedHandler<Env>;
