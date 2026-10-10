import { describe, expect, it } from "vitest";
import {
	MODEL_APPROX_SIZES_MB,
	MODEL_URLS,
	getModelsDirectory,
} from "./modelDownloader";

describe("Whisper model downloader", () => {
	it("has valid Hugging Face URLs for supported model variants", () => {
		expect(MODEL_URLS.tiny).toContain("ggml-tiny.bin");
		expect(MODEL_URLS.base).toContain("ggml-base.bin");
		expect(MODEL_URLS.small).toContain("ggml-small.bin");
	});

	it("has reasonable approximate sizes", () => {
		expect(MODEL_APPROX_SIZES_MB.tiny).toBe(75);
		expect(MODEL_APPROX_SIZES_MB.base).toBe(142);
		expect(MODEL_APPROX_SIZES_MB.small).toBe(466);
	});

	it("returns a models directory path", () => {
		const dir = getModelsDirectory();
		expect(dir).toBeTruthy();
		expect(dir.toLowerCase()).toContain("models");
	});
});
