import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
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
		expect(fetchMock).toHaveBeenCalledOnce();

		vi.unstubAllGlobals();
	});

	it("changes the rendered icons when weather codes change", async () => {
		const clearFixture = createWeatherFixture();
		const rainyFixture = createWeatherFixture();
		rainyFixture.current.weather_code = 61;
		rainyFixture.hourly.weather_code = rainyFixture.hourly.weather_code.map(() => 61);
		rainyFixture.daily.weather_code = rainyFixture.daily.weather_code.map(() => 61);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify(clearFixture)))
			.mockResolvedValueOnce(new Response(JSON.stringify(rainyFixture)));
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
		vi.unstubAllGlobals();
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
