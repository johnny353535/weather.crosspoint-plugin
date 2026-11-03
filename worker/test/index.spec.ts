import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function createWeatherFixture() {
	const hourlyTime = Array.from({ length: 96 }, (_, index) => {
		const date = new Date(Date.UTC(2026, 9, 22, index));
		return date.toISOString().slice(0, 13) + ":00";
	});

	return {
		current: {
			time: "2026-10-22T08:15",
			temperature_2m: 13.4,
			weather_code: 2,
			is_day: 1,
		},
		hourly: {
			time: hourlyTime,
			temperature_2m: hourlyTime.map((_, index) => 14 + index / 10),
			precipitation_probability: hourlyTime.map((_, index) => index),
			weather_code: hourlyTime.map(() => 2),
			is_day: hourlyTime.map(() => 1),
		},
		daily: {
			time: ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"],
			weather_code: [2, 61, 71, 95],
			temperature_2m_max: [19, 21, 22, 18],
			temperature_2m_min: [11, 10, 12, 9],
			sunrise: ["2026-10-22T07:42", "2026-10-23T07:44", "2026-10-24T07:46", "2026-10-25T07:48"],
			sunset: ["2026-10-22T18:02", "2026-10-23T18:00", "2026-10-24T17:58", "2026-10-25T17:56"],
		},
	};
}

function mockForecastFetch(fixture = createWeatherFixture()) {
	const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
		new Response(JSON.stringify(fixture), {
			headers: { "Content-Type": "application/json" },
		}),
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("weather worker", () => {
	it("returns a 480x800 monochrome BMP", async () => {
		const fetchMock = vi.fn(async () =>
			new Response(JSON.stringify(createWeatherFixture()), {
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const context = createExecutionContext();
		const response = await worker.fetch(
			new IncomingRequest("https://example.com/weather.bmp"),
			env,
			context,
		);
		await waitOnExecutionContext(context);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/bmp");

		const bytes = new Uint8Array(await response.arrayBuffer());
		const view = new DataView(bytes.buffer);
		expect(String.fromCharCode(bytes[0], bytes[1])).toBe("BM");
		expect(view.getInt32(18, true)).toBe(480);
		expect(view.getInt32(22, true)).toBe(800);
		expect(view.getUint16(28, true)).toBe(1);
		expect(bytes.byteLength).toBe(62 + 60 * 800);
		expect(bytes.slice(62).some((byte) => byte !== 0xff)).toBe(true);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe("public, max-age=3600");
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("changes the rendered icons when weather codes change", async () => {
		const clearFixture = createWeatherFixture();
		const rainyFixture = createWeatherFixture();
		rainyFixture.current.weather_code = 61;
		rainyFixture.hourly.weather_code = rainyFixture.hourly.weather_code.map(() => 61);
		rainyFixture.daily.weather_code = rainyFixture.daily.weather_code.map(() => 61);
		const fetchMock = vi
			.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify(clearFixture)))
			.mockImplementationOnce(async () => new Response(JSON.stringify(clearFixture)))
			.mockImplementationOnce(async () => new Response(JSON.stringify(rainyFixture)));
		vi.stubGlobal("fetch", fetchMock);

		const getBmp = async () => {
			const response = await worker.fetch(
				new IncomingRequest("https://example.com/weather.bmp"),
				env,
				createExecutionContext(),
			);
			return new Uint8Array(await response.arrayBuffer());
		};

		const clearBmp = await getBmp();
		const rainyBmp = await getBmp();
		expect(clearBmp).not.toEqual(rainyBmp);
	});

	it("uses the default Berlin coordinates and Celsius when no options are supplied", async () => {
		const fetchMock = mockForecastFetch();
		const response = await worker.fetch(
			new IncomingRequest("https://example.com/weather.bmp"),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledOnce();
		const weatherUrl = new URL(fetchMock.mock.calls[0][0]);
		expect(weatherUrl.origin).toBe("https://api.open-meteo.com");
		expect(weatherUrl.pathname).toBe("/v1/forecast");
		expect(weatherUrl.searchParams.get("latitude")).toBe("52.52");
		expect(weatherUrl.searchParams.get("longitude")).toBe("13.405");
		expect(weatherUrl.searchParams.get("temperature_unit")).toBe("celsius");
		expect(weatherUrl.searchParams.get("timezone")).toBe("auto");
		expect(weatherUrl.searchParams.get("forecast_days")).toBe("4");
	});

	it("passes configured coordinates and Fahrenheit to Open-Meteo", async () => {
		const fetchMock = mockForecastFetch();
		const response = await worker.fetch(
			new IncomingRequest(
				"https://example.com/weather.bmp?latitude=52.3676&longitude=4.9041&location=Amsterdam&unit=fahrenheit",
			),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
		const weatherUrl = new URL(fetchMock.mock.calls[0][0]);
		expect(weatherUrl.searchParams.get("latitude")).toBe("52.3676");
		expect(weatherUrl.searchParams.get("longitude")).toBe("4.9041");
		expect(weatherUrl.searchParams.get("temperature_unit")).toBe("fahrenheit");
	});

	it.each(["POST", "PUT", "HEAD"])("rejects %s requests", async (method) => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const response = await worker.fetch(
			new IncomingRequest("https://example.com/weather.bmp", { method }),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBe("GET");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it.each([
		["latitude without longitude", "?latitude=52.52"],
		["longitude without latitude", "?longitude=13.405"],
		["empty coordinates", "?latitude=&longitude="],
		["non-numeric coordinates", "?latitude=north&longitude=13.405"],
		["latitude outside its valid range", "?latitude=91&longitude=13.405"],
		["longitude outside its valid range", "?latitude=52.52&longitude=181"],
	])("rejects %s without calling Open-Meteo", async (_caseName, query) => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const response = await worker.fetch(
			new IncomingRequest(`https://example.com/weather.bmp${query}`),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns 502 when Open-Meteo responds with an error", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response("rate limited", { status: 429 }));
		vi.stubGlobal("fetch", fetchMock);

		const response = await worker.fetch(
			new IncomingRequest("https://example.com/weather.bmp"),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(502);
		expect(await response.text()).toBe("Weather image generation failed");
	});

	it("returns 429 when the source IP exceeds the rate limit", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const limit = vi.fn(async () => ({ success: false }));
		const rateLimitedEnv = {
			...env,
			WEATHER_RATE_LIMITER: { limit },
		} as unknown as Env;
		const response = await worker.fetch(
			new IncomingRequest("https://example.com/weather.bmp", {
				headers: { "CF-Connecting-IP": "203.0.113.10" },
			}),
			rateLimitedEnv,
			createExecutionContext(),
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("Retry-After")).toBe("60");
		expect(limit).toHaveBeenCalledWith({ key: "203.0.113.10" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("safely renders XML-special characters in the location name", async () => {
		mockForecastFetch();
		const response = await worker.fetch(
			new IncomingRequest("https://example.com/weather.bmp?location=%3CAmsterdam%20%26%20area%3E"),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/bmp");
	});

	it("returns 404 for unrelated paths", async () => {
		const response = await worker.fetch(
			new IncomingRequest("https://example.com/"),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("Not found");
	});
});
