import { describe, expect, it } from "vitest";
import {
	buildHyperframeAudioMuxArgs,
	buildHyperframeFfmpegExportArgs,
	calculateHyperframeCount,
} from "./hyperframeExportEngine";

describe("hyperframeExportEngine", () => {
	it("calculates exact frame count for duration and fps", () => {
		expect(calculateHyperframeCount(10, 60)).toBe(600);
		expect(calculateHyperframeCount(5.5, 30)).toBe(165);
		expect(calculateHyperframeCount(0, 60)).toBe(1);
	});

	it("builds valid FFmpeg args for rawvideo BGRA stream input", () => {
		const args = buildHyperframeFfmpegExportArgs({
			width: 1920,
			height: 1080,
			fps: 60,
			bitrate: 12_000_000,
			encoder: "libx264",
			outputPath: "C:\\temp\\output.mp4",
		});

		expect(args).toContain("-f");
		expect(args).toContain("rawvideo");
		expect(args).toContain("-pix_fmt");
		expect(args).toContain("bgra");
		expect(args).toContain("-s:v");
		expect(args).toContain("1920x1080");
		expect(args).toContain("-framerate");
		expect(args).toContain("60");
		expect(args).toContain("-c:v");
		expect(args).toContain("libx264");
		expect(args).toContain("C:\\temp\\output.mp4");
	});

	it("builds audio muxing arguments when audioSourcePath is provided", () => {
		const args = buildHyperframeAudioMuxArgs({
			videoPath: "C:\\temp\\video.mp4",
			audioPath: "C:\\temp\\mic.wav",
			outputPath: "C:\\temp\\final.mp4",
		});

		expect(args).toContain("-i");
		expect(args).toContain("C:\\temp\\video.mp4");
		expect(args).toContain("C:\\temp\\mic.wav");
		expect(args).toContain("-c:v");
		expect(args).toContain("copy");
		expect(args).toContain("-c:a");
		expect(args).toContain("aac");
		expect(args).toContain("C:\\temp\\final.mp4");
	});
});
