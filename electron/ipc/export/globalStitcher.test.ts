import { describe, expect, it } from "vitest";
import {
	buildStitchFiltergraph,
	mapToFfmpegXfadeType,
} from "./globalStitcher";

describe("globalStitcher filtergraph builder", () => {
	it("maps transition types to FFmpeg xfade names", () => {
		expect(mapToFfmpegXfadeType("crossfade")).toBe("fade");
		expect(mapToFfmpegXfadeType("fade-black")).toBe("fadeblack");
		expect(mapToFfmpegXfadeType("wipe-left")).toBe("wipeleft");
		expect(mapToFfmpegXfadeType("slide-left")).toBe("slideleft");
	});

	it("handles single slide without complex filtergraph", () => {
		const result = buildStitchFiltergraph([{ filePath: "slide1.mp4", durationSec: 10 }], []);
		expect(result.filtergraph).toBe("");
		expect(result.lastVideoLabel).toBe("0:v");
		expect(result.lastAudioLabel).toBe("0:a");
	});

	it("constructs chained xfade and acrossfade filters for multi-slide", () => {
		const slides = [
			{ filePath: "s1.mp4", durationSec: 10 },
			{ filePath: "s2.mp4", durationSec: 6 },
		];
		const transitions = [
			{ type: "crossfade" as const, durationSec: 1.0 },
		];

		const result = buildStitchFiltergraph(slides, transitions);
		expect(result.filtergraph).toContain("xfade=transition=fade:duration=1.000:offset=9.000");
		expect(result.filtergraph).toContain("acrossfade=d=1.000");
		expect(result.lastVideoLabel).toBe("v_out_1");
		expect(result.lastAudioLabel).toBe("a_out_1");
	});

	it("cascades across 3 slides with varying transitions", () => {
		const slides = [
			{ filePath: "s1.mp4", durationSec: 10 },
			{ filePath: "s2.mp4", durationSec: 5 },
			{ filePath: "s3.mp4", durationSec: 8 },
		];
		const transitions = [
			{ type: "wipe-left" as const, durationSec: 0.5 },
			{ type: "slide-left" as const, durationSec: 1.0 },
		];

		const result = buildStitchFiltergraph(slides, transitions);
		expect(result.filtergraph).toContain("xfade=transition=wipeleft");
		expect(result.filtergraph).toContain("xfade=transition=slideleft");
		expect(result.lastVideoLabel).toBe("v_out_2");
		expect(result.lastAudioLabel).toBe("a_out_2");
	});
});
