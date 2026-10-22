const width = 480;
const height = 800;
const rowBytes = width / 8;

function createBmp(): ArrayBuffer {
	const pixels = new Uint8Array(rowBytes * height).fill(0xff);

	const pixel = (x: number, y: number, black = true) => {
		const index = (height - 1 - y) * rowBytes + (x >> 3);
		const mask = 0x80 >> (x & 7);
		if (black) pixels[index] &= ~mask;
		else pixels[index] |= mask;
	};

	const rect = (x0: number, y0: number, x1: number, y1: number) => {
		for (let y = y0; y <= y1; y++) {
			for (let x = x0; x <= x1; x++) pixel(x, y);
		}
	};

	rect(20, 20, 459, 779);
	rect(40, 100, 440, 108);
	rect(40, 150, 250, 360);
	rect(280, 150, 440, 360);
	rect(40, 410, 440, 418);
	rect(40, 470, 380, 478);
	rect(40, 530, 320, 538);
	rect(40, 590, 400, 598);

	const buffer = new ArrayBuffer(62 + pixels.length);
	const view = new DataView(buffer);

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

	// Palette: black, white
	view.setUint8(54, 0);
	view.setUint8(58, 255);
	view.setUint8(59, 255);
	view.setUint8(60, 255);

	new Uint8Array(buffer, 62).set(pixels);
	return buffer;
}

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname !== '/weather.bmp') {
			return new Response('Not found', { status: 404 });
		}

		return new Response(createBmp(), {
			headers: {
				'Content-Type': 'image/bmp',
				'Cache-Control': 'no-store',
			},
		});
	},
} satisfies ExportedHandler<Env>;
