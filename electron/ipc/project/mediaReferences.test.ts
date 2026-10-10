import { describe, expect, it } from "vitest";
import { normalizeStoryOwnership } from "../../../src/core/timeline/normalizeStoryOwnership";
import { ownershipFixture } from "../../../src/core/timeline/storyOwnership.fixtures";
import { collectProjectMediaPaths, getProjectPrimaryMedia } from "./mediaReferences";

it("enumerates unplaced private sources once and ignores stale projection paths", () => {
	const project = ownershipFixture();
	project.repurposeBoard!.artboards[0].tracks = [];
	project.localAssets = [
		{
			...project.repurposeBoard!.artboards[0].localAssets![0],
			id: "root-private",
			source: { path: "root.wav", durationUs: 5_000_000, offsetUs: 0 },
		},
	];
	const canonical = normalizeStoryOwnership(project);
	canonical.stories!.find((s) => s.artboardId === "A")!.localAssets![0].source!.path =
		"stale.wav";
	expect(collectProjectMediaPaths(canonical)).toEqual([
		"shared.mp4",
		"screen.mp4",
		"root.wav",
		"voice.wav",
	]);
});

describe("project media references", () => {
	it("collects every scene's media and sidecars without approving unrelated strings", () => {
		expect(
			collectProjectMediaPaths({
				videoPath: "intro.mp4",
				secretPath: "unrelated.txt",
				editor: {
					webcam: { sourcePath: "cam.mp4" },
					audioRegions: [{ audioPath: "music.wav" }],
					annotationRegions: [{ imageFilePath: "logo.png" }],
				},
				clips: [
					null,
					{ videoPath: "intro.mp4" },
					{
						videoPath: "demo.mp4",
						webcamPath: "cam2.mp4",
						microphoneAudioPath: "mic.wav",
						systemAudioPath: "system.wav",
						cursorTelemetryPath: "cursor.json",
						mediaTrackLayers: [
							{ sourcePath: "broll.mp4" },
							{ sourcePath: "data:image/png;base64,test" },
						],
						assetFiles: [{ path: "exclusive-slide.mp4" }],
					},
				],
			}),
		).toEqual([
			"intro.mp4",
			"cam.mp4",
			"music.wav",
			"logo.png",
			"demo.mp4",
			"cam2.mp4",
			"mic.wav",
			"system.wav",
			"cursor.json",
			"broll.mp4",
			"exclusive-slide.mp4",
		]);
	});
	it("resolves a scene-only project and tolerates malformed optional collections", () => {
		expect(
			getProjectPrimaryMedia({
				videoPath: "",
				clips: [null, { videoPath: "take.mp4", webcamPath: "cam.mp4" }],
			}),
		).toEqual({ videoPath: "take.mp4", webcamPath: "cam.mp4" });
		expect(collectProjectMediaPaths({ clips: {}, editor: null })).toEqual([]);
	});
});
