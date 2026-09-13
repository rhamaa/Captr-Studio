import { describe, expect, it } from "vitest";
import {
	buildNativePrecompositedStaticLayoutArgs,
	buildNativeVideoExportArgs,
	getAmfVideoModeArgs,
	getEncoderModeArgs,
	getLibx264ModeArgs,
	getNvencVideoModeArgs,
	getQsvVideoModeArgs,
	getVideoToolboxModeArgs,
} from "./nativeVideoExport";

describe("GPU hardware encoder mode arguments", () => {
	it("generates optimized NVENC arguments for fast, balanced, and quality modes", () => {
		const fastArgs = getNvencVideoModeArgs("fast");
		expect(fastArgs).toContain("-preset");
		expect(fastArgs).toContain("p1");
		expect(fastArgs).toContain("-tune");
		expect(fastArgs).toContain("ull");
		expect(fastArgs).toContain("-surfaces");
		expect(fastArgs).toContain("32");

		const balancedArgs = getNvencVideoModeArgs("balanced");
		expect(balancedArgs).toContain("-preset");
		expect(balancedArgs).toContain("p2");
		expect(balancedArgs).toContain("-tune");
		expect(balancedArgs).toContain("ll");

		const qualityArgs = getNvencVideoModeArgs("quality");
		expect(qualityArgs).toContain("-preset");
		expect(qualityArgs).toContain("p4");
		expect(qualityArgs).toContain("-tune");
		expect(qualityArgs).toContain("hq");
	});

	it("generates optimized Intel QSV arguments", () => {
		const fastArgs = getQsvVideoModeArgs("fast");
		expect(fastArgs).toContain("-preset");
		expect(fastArgs).toContain("veryfast");
		expect(fastArgs).toContain("-look_ahead");
		expect(fastArgs).toContain("0");

		const balancedArgs = getQsvVideoModeArgs("balanced");
		expect(balancedArgs).toContain("-preset");
		expect(balancedArgs).toContain("faster");

		const qualityArgs = getQsvVideoModeArgs("quality");
		expect(qualityArgs).toContain("-preset");
		expect(qualityArgs).toContain("medium");
	});

	it("generates optimized AMD AMF arguments", () => {
		const fastArgs = getAmfVideoModeArgs("fast");
		expect(fastArgs).toContain("-quality");
		expect(fastArgs).toContain("speed");
		expect(fastArgs).toContain("-rc");
		expect(fastArgs).toContain("vbr_latency");
		expect(fastArgs).toContain("-header_insertion");

		const balancedArgs = getAmfVideoModeArgs("balanced");
		expect(balancedArgs).toContain("balanced");

		const qualityArgs = getAmfVideoModeArgs("quality");
		expect(qualityArgs).toContain("quality");
	});

	it("generates Apple VideoToolbox hardware arguments", () => {
		const fastArgs = getVideoToolboxModeArgs("fast");
		expect(fastArgs).toContain("-realtime");
		expect(fastArgs).toContain("1");
		expect(fastArgs).toContain("-allow_sw");
		expect(fastArgs).toContain("0");

		const qualityArgs = getVideoToolboxModeArgs("quality");
		expect(qualityArgs).toContain("-realtime");
		expect(qualityArgs).toContain("0");
	});

	it("routes getEncoderModeArgs correctly for each hardware encoder", () => {
		expect(getEncoderModeArgs("h264_nvenc", "balanced")).toEqual(
			getNvencVideoModeArgs("balanced"),
		);
		expect(getEncoderModeArgs("h264_qsv", "fast")).toEqual(getQsvVideoModeArgs("fast"));
		expect(getEncoderModeArgs("h264_amf", "quality")).toEqual(getAmfVideoModeArgs("quality"));
		expect(getEncoderModeArgs("h264_videotoolbox", "fast")).toEqual(
			getVideoToolboxModeArgs("fast"),
		);
		expect(getEncoderModeArgs("libx264", "balanced")).toEqual(getLibx264ModeArgs("balanced"));
	});
});

describe("buildNativeVideoExportArgs with GPU hardware encoders", () => {
	const baseOptions = {
		width: 1920,
		height: 1080,
		frameRate: 60,
		bitrate: 8_000_000,
		encodingMode: "balanced" as const,
	};

	it("configures h264_nvenc with NVENC low-latency flags", () => {
		const args = buildNativeVideoExportArgs("h264_nvenc", baseOptions, "C:/temp/output.mp4");
		expect(args).toContain("-c:v");
		expect(args).toContain("h264_nvenc");
		expect(args).toContain("-preset");
		expect(args).toContain("p2");
		expect(args).toContain("-tune");
		expect(args).toContain("ll");
		expect(args).toContain("-surfaces");
		expect(args).toContain("32");
	});

	it("configures h264_qsv with QuickSync flags", () => {
		const args = buildNativeVideoExportArgs("h264_qsv", baseOptions, "C:/temp/output.mp4");
		expect(args).toContain("-c:v");
		expect(args).toContain("h264_qsv");
		expect(args).toContain("-preset");
		expect(args).toContain("faster");
		expect(args).toContain("-look_ahead");
		expect(args).toContain("0");
	});

	it("configures h264_amf with AMD VCE flags", () => {
		const args = buildNativeVideoExportArgs("h264_amf", baseOptions, "C:/temp/output.mp4");
		expect(args).toContain("-c:v");
		expect(args).toContain("h264_amf");
		expect(args).toContain("-quality");
		expect(args).toContain("balanced");
		expect(args).toContain("-rc");
		expect(args).toContain("vbr_latency");
	});

	it("configures h264_videotoolbox with macOS VideoToolbox flags", () => {
		const args = buildNativeVideoExportArgs(
			"h264_videotoolbox",
			baseOptions,
			"C:/temp/output.mp4",
		);
		expect(args).toContain("-c:v");
		expect(args).toContain("h264_videotoolbox");
		expect(args).toContain("-realtime");
		expect(args).toContain("1");
		expect(args).toContain("-allow_sw");
		expect(args).toContain("0");
	});
});

describe("buildNativePrecompositedStaticLayoutArgs with dynamic encoder", () => {
	const baseConfig = {
		inputPath: "C:/temp/input.mp4",
		outputPath: "C:/temp/output.mp4",
		width: 1920,
		height: 1080,
		frameRate: 60,
		bitrate: 8_000_000,
		encodingMode: "balanced" as const,
		contentWidth: 1600,
		contentHeight: 900,
		offsetX: 160,
		offsetY: 90,
		backgroundColor: "#101010",
		staticBackgroundPath: "C:/temp/bg.png",
		durationSec: 10,
	};

	it("defaults to h264_nvenc when no encoder is specified", () => {
		const args = buildNativePrecompositedStaticLayoutArgs(baseConfig);
		expect(args).toContain("-c:v");
		expect(args).toContain("h264_nvenc");
	});

	it("supports custom encoder like h264_qsv or h264_amf", () => {
		const qsvArgs = buildNativePrecompositedStaticLayoutArgs({
			...baseConfig,
			encoder: "h264_qsv",
		});
		expect(qsvArgs).toContain("-c:v");
		expect(qsvArgs).toContain("h264_qsv");
		expect(qsvArgs).toContain("-preset");
		expect(qsvArgs).toContain("faster");

		const amfArgs = buildNativePrecompositedStaticLayoutArgs({
			...baseConfig,
			encoder: "h264_amf",
		});
		expect(amfArgs).toContain("-c:v");
		expect(amfArgs).toContain("h264_amf");
		expect(amfArgs).toContain("-quality");
		expect(amfArgs).toContain("balanced");
	});
});
