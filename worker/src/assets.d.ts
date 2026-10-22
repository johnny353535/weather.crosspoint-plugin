declare module "*.svg" {
	const content: string;
	export default content;
}

declare module "*.wasm" {
	const module: WebAssembly.Module;
	export default module;
}

declare module "*.ttf" {
	const data: ArrayBuffer;
	export default data;
}
