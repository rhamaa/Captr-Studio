import { describe, expect, it } from "vitest";
import { extractStoriesFromProject } from "../story/storyUtils";
import { createTimelineProject } from "./commands";
import {
	addRepurposeArtboard,
	addRepurposeSlice,
	createDefaultRepurposeBoard,
	duplicateRepurposeArtboard,
	ensureRepurposeBoard,
	forkArtboardSequence,
	getArtboardProjectView,
	placeAssetIntoArtboard,
	removeRepurposeArtboard,
	removeRepurposeSlice,
	renameRepurposeArtboard,
	resetRepurposeFraming,
	setActiveRepurposeSlice,
	splitRepurposeSliceAtTime,
	updateArtboardProject,
	updateRepurposeArtboard,
	updateRepurposeFraming,
	updateRepurposeSlice,
} from "./repurposeCommands";
import { fixtureClip, fixtureTrack, ownershipFixture } from "./storyOwnership.fixtures";
import { validateTimelineProject } from "./validation";

describe("repurposeCommands", () => {
	it("forks an inherited owner without losing unplaced private media or linking its canvas to root", () => {
		const input = ownershipFixture();
		const owner = input.repurposeBoard!.artboards[0];
		delete owner.tracks;
		input.localAssets = [{ ...structuredClone(owner.localAssets![0]), id: "root-private" }];
		input.canvas = { width: 1920, height: 1080, fps: 24, background: "#123456" };
		const before = structuredClone(input);
		const result = forkArtboardSequence(input, "A");
		const fork = result.repurposeBoard!.artboards[0];
		expect(fork.localAssets).toHaveLength(2);
		expect(fork.localAssets![0]).toEqual(owner.localAssets![0]);
		expect(fork.localAssets![1].id).not.toBe("root-private");
		expect(fork.localAssets![1].source).toEqual(input.localAssets[0].source);
		result.canvas = { ...result.canvas, fps: 60, background: "#abcdef" };
		expect(getArtboardProjectView(result, "A").canvas).toEqual({
			width: owner.width,
			height: owner.height,
			fps: 24,
			background: "#123456",
		});
		expect(input).toEqual(before);
		expect(() => validateTimelineProject(result)).not.toThrow();
	});
	it("removes obsolete Story projections when deleting an owner", () => {
		const input = ownershipFixture();
		input.stories = extractStoriesFromProject(input);
		const result = removeRepurposeArtboard(input, "A");
		expect(result.stories!.some((s) => s.artboardId === "A")).toBe(false);
		expect(() => validateTimelineProject(result)).not.toThrow();
	});
	it("rejects stale or unmaterialized placement scopes rather than copying root IDs", () => {
		const input = ownershipFixture();
		expect(() => placeAssetIntoArtboard(input, "missing", "shared")).toThrow();
		delete input.repurposeBoard!.artboards[0].tracks;
		expect(() => placeAssetIntoArtboard(input, "A", "shared")).toThrow(/materialized/);
	});
	it("refreshes projection tracks when placing a shared Record source", () => {
		const input = ownershipFixture();
		input.stories = extractStoriesFromProject(input);
		const result = placeAssetIntoArtboard(input, "B", "record");
		expect(result.stories!.find((s) => s.artboardId === "B")!.tracks[0].clips).toHaveLength(2);
		expect(result.repurposeBoard!.artboards[0]).toEqual(input.repurposeBoard!.artboards[0]);
		expect(() => validateTimelineProject(result)).not.toThrow();
	});
	it("new and duplicate Artboards snapshot private media, Record edits and transition references independently", () => {
		const project = ownershipFixture();
		const owner = project.repurposeBoard!.artboards[0];
		project.tracks = owner.tracks!;
		project.localAssets = owner.localAssets;
		project.repurposeBoard!.artboards = [];
		const left = fixtureClip("left");
		left.sourceOutUs = 2_000_000;
		const right = fixtureClip("right");
		right.startUs = 2_000_000;
		right.sourceInUs = 1_000_000;
		right.sourceOutUs = 3_000_000;
		project.tracks.push(fixtureTrack("transition-track", [left, right]));
		project.clipTransitions = [
			{
				id: "fade",
				trackId: "transition-track",
				fromClipId: "left",
				toClipId: "right",
				preset: { kind: "cross-dissolve" },
				durationUs: 500_000,
				easing: "linear",
			},
		];
		const added = addRepurposeArtboard(project, {
			name: "Snapshot",
			aspectRatio: "9:16",
			width: 1080,
			height: 1920,
		});
		const a = added.repurposeBoard!.artboards[0];
		expect(a.tracks).toBeDefined();
		expect(a.tracks![0].id).not.toBe(project.tracks[0].id);
		expect(a.localAssets![0].id).not.toBe(project.localAssets![0].id);
		expect(a.tracks![0].clips[0].compositionId).not.toBe(
			project.tracks[0].clips[0].compositionId,
		);
		const transition = a.clipTransitions![0];
		expect(transition.id).not.toBe("fade");
		const track = a.tracks!.find((t) => t.id === transition.trackId)!;
		expect(track.clips.map((c) => c.id)).toEqual([transition.fromClipId, transition.toClipId]);
		const duplicated = duplicateRepurposeArtboard(added, a.id);
		const b = duplicated.repurposeBoard!.artboards[1];
		expect(b.localAssets![0].id).not.toBe(a.localAssets![0].id);
		expect(b.tracks![0].clips[0].compositionId).not.toBe(a.tracks![0].clips[0].compositionId);
		expect(() => validateTimelineProject(duplicated)).not.toThrow();
		duplicated.tracks[0].clips[0].transform.scale = 2;
		expect(b.tracks![0].clips[0].transform.scale).toBe(1);
	});
	it("initializes default repurpose board with empty artboards by default and full slice", () => {
		const project = createTimelineProject("p1", "Test Project");
		expect(project.repurposeBoard).toBeUndefined();

		const withBoard = ensureRepurposeBoard(project);
		expect(withBoard.repurposeBoard).toBeDefined();
		expect(withBoard.repurposeBoard?.artboards).toHaveLength(0);
		expect(withBoard.repurposeBoard?.slices).toHaveLength(1);
		expect(withBoard.repurposeBoard?.slices[0].name).toBe("Full Video");
		expect(withBoard.repurposeBoard?.activeSliceId).toBe(
			withBoard.repurposeBoard?.slices[0].id,
		);

		// Validation should pass
		expect(() => validateTimelineProject(withBoard)).not.toThrow();
	});

	it("renames an artboard and auto-numbers duplicate preset additions", () => {
		let project = createTimelineProject("p1", "Test Project");
		project = addRepurposeArtboard(project, {
			aspectRatio: "9:16",
			name: "Shorts / Reels",
			width: 1080,
			height: 1920,
			defaultFitMode: "cover",
		});
		project = addRepurposeArtboard(project, {
			aspectRatio: "9:16",
			name: "Shorts / Reels",
			width: 1080,
			height: 1920,
			defaultFitMode: "cover",
		});
		expect(project.repurposeBoard?.artboards).toHaveLength(2);
		expect(project.repurposeBoard?.artboards[0].name).toBe("Shorts / Reels");
		expect(project.repurposeBoard?.artboards[1].name).toBe("Shorts / Reels 2");

		// Rename
		const firstId = project.repurposeBoard!.artboards[0].id;
		project = renameRepurposeArtboard(project, firstId, "TikTok Hook");
		expect(project.repurposeBoard?.artboards[0].name).toBe("TikTok Hook");
	});

	it("adds, updates, and removes an artboard", () => {
		let project = createTimelineProject("p1", "Test Project");
		project = addRepurposeArtboard(project, {
			aspectRatio: "4:5",
			name: "Instagram Portrait",
			width: 1080,
			height: 1350,
			defaultFitMode: "cover",
		});

		const board = project.repurposeBoard!;
		const newArtboard = board.artboards.find((a) => a.aspectRatio === "4:5");
		expect(newArtboard).toBeDefined();
		expect(newArtboard?.name).toBe("Instagram Portrait");

		// Update artboard
		project = updateRepurposeArtboard(project, newArtboard!.id, {
			name: "Custom Portrait 4:5",
		});
		expect(project.repurposeBoard?.artboards.find((a) => a.id === newArtboard!.id)?.name).toBe(
			"Custom Portrait 4:5",
		);

		// Remove artboard
		project = removeRepurposeArtboard(project, newArtboard!.id);
		expect(
			project.repurposeBoard?.artboards.find((a) => a.id === newArtboard!.id),
		).toBeUndefined();
	});

	it("updates framing with clamping and resets framing", () => {
		let project = createTimelineProject("p1", "Test Project");
		project = addRepurposeArtboard(project, {
			aspectRatio: "16:9",
			name: "Landscape Master",
			width: 1920,
			height: 1080,
			defaultFitMode: "contain",
		});
		const targetId = project.repurposeBoard!.artboards[0].id;

		// Update framing with out-of-range values to test clamping
		project = updateRepurposeFraming(project, targetId, {
			scale: 5, // Should clamp to 3.0
			offsetX: 0.9, // Should clamp to 0.5
			offsetY: -1.2, // Should clamp to -0.5
		});

		let ab = project.repurposeBoard!.artboards.find((a) => a.id === targetId)!;
		expect(ab.framing.scale).toBe(3);
		expect(ab.framing.offsetX).toBe(0.5);
		expect(ab.framing.offsetY).toBe(-0.5);

		// Reset framing
		project = resetRepurposeFraming(project, targetId);
		ab = project.repurposeBoard!.artboards.find((a) => a.id === targetId)!;
		expect(ab.framing.scale).toBe(1);
		expect(ab.framing.offsetX).toBe(0);
		expect(ab.framing.offsetY).toBe(0);
	});

	it("splits slice at time (razor cut) and manages slice active state", () => {
		let project = createTimelineProject("p1", "Test Project");
		project = ensureRepurposeBoard(project);
		// Default slice is 0 to 1_000_000 Us (1.0s)
		project = updateRepurposeSlice(project, project.repurposeBoard!.slices[0].id, {
			endUs: 10_000_000, // 10s
		});

		// Split at 4.0s (4_000_000 Us)
		project = splitRepurposeSliceAtTime(project, 4_000_000);
		expect(project.repurposeBoard?.slices).toHaveLength(2);

		const [part1, part2] = project.repurposeBoard!.slices;
		expect(part1.startUs).toBe(0);
		expect(part1.endUs).toBe(4_000_000);
		expect(part2.startUs).toBe(4_000_000);
		expect(part2.endUs).toBe(10_000_000);
		expect(part2.name).toContain("(Part 2)");
		expect(project.repurposeBoard?.activeSliceId).toBe(part2.id);

		// Setting active slice
		project = setActiveRepurposeSlice(project, part1.id);
		expect(project.repurposeBoard?.activeSliceId).toBe(part1.id);

		// Splitting too close to boundary should do nothing (< 0.5s)
		const beforeFailedSplit = project;
		project = splitRepurposeSliceAtTime(project, 3_800_000); // 0.2s before 4.0s
		expect(project.repurposeBoard?.slices).toHaveLength(2);
		expect(project).toBe(beforeFailedSplit);

		// Add custom slice
		project = addRepurposeSlice(project, 12_000_000, 16_000_000, "Outro Reel");
		expect(project.repurposeBoard?.slices).toHaveLength(3);
		expect(project.repurposeBoard?.slices[2].name).toBe("Outro Reel");

		// Remove slice
		project = removeRepurposeSlice(project, part2.id);
		expect(project.repurposeBoard?.slices).toHaveLength(2);

		// Validation check
		expect(() => validateTimelineProject(project)).not.toThrow();
	});

	it("creates an Artboard view with independently identified snapshot tracks", () => {
		let project = createTimelineProject("p1", "Test Project");
		project = addRepurposeArtboard(project, {
			aspectRatio: "9:16",
			name: "Shorts / Reels",
			width: 1080,
			height: 1920,
			defaultFitMode: "cover",
		});
		const artboard916 = project.repurposeBoard!.artboards.find(
			(a) => a.aspectRatio === "9:16",
		)!;

		const view = getArtboardProjectView(project, artboard916.id);
		expect(view.canvas.width).toBe(1080);
		expect(view.canvas.height).toBe(1920);
		expect(view.tracks.map((t) => t.name)).toEqual(project.tracks.map((t) => t.name));
		expect(view.tracks[0].id).not.toBe(project.tracks[0].id);
	});

	it("updates artboard independent sequence and syncs shared assets", () => {
		let project = createTimelineProject("p1", "Test Project");
		project = addRepurposeArtboard(project, {
			aspectRatio: "9:16",
			name: "Shorts / Reels",
			width: 1080,
			height: 1920,
			defaultFitMode: "cover",
		});
		const artboardId = project.repurposeBoard!.artboards[0].id;

		// Initial root tracks has 2 default tracks
		expect(project.tracks.length).toBeGreaterThan(0);
		const initialRootTrackCount = project.tracks.length;

		// Update artboard timeline: add a track and add a new asset
		project = updateArtboardProject(project, artboardId, (artboardView) => {
			const newTrack = {
				id: "custom-track-1",
				name: "Overlay 9:16",
				kind: "visual" as const,
				muted: false,
				locked: false,
				hidden: false,
				clips: [],
			};
			const newAsset = {
				id: "shared-asset-99",
				kind: "image" as const,
				name: "Sticker.png",
				durationUs: 5_000_000,
				width: 500,
				height: 500,
				source: {
					type: "file" as const,
					path: "assets/shared-asset-99/Sticker.png",
					durationUs: 5_000_000,
					offsetUs: 0,
				},
			};

			return {
				...artboardView,
				tracks: [...artboardView.tracks, newTrack],
				assets: [...artboardView.assets, newAsset],
			};
		});

		// Root project tracks should NOT be mutated
		expect(project.tracks.length).toBe(initialRootTrackCount);

		// Artboard itself has custom sequence
		const targetArtboard = project.repurposeBoard!.artboards.find((a) => a.id === artboardId)!;
		expect(targetArtboard.tracks).toBeDefined();
		expect(targetArtboard.tracks!.length).toBe(initialRootTrackCount + 1);

		// Root project shared assets contains the newly added asset
		const foundAsset = project.assets.find((a) => a.id === "shared-asset-99");
		expect(foundAsset).toBeDefined();
		expect(foundAsset?.name).toBe("Sticker.png");

		expect(() => validateTimelineProject(project)).not.toThrow();
	});

	it("forks sequence and duplicates artboard with cloned tracks", () => {
		let project = createTimelineProject("p1", "Test Project");
		project = addRepurposeArtboard(project, {
			aspectRatio: "9:16",
			name: "Shorts / Reels",
			width: 1080,
			height: 1920,
			defaultFitMode: "cover",
		});
		const artboardId = project.repurposeBoard!.artboards[0].id;

		// Fork sequence
		project = forkArtboardSequence(project, artboardId);
		let targetArtboard = project.repurposeBoard!.artboards.find((a) => a.id === artboardId)!;
		expect(targetArtboard.tracks).toBeDefined();

		// Duplicate artboard
		project = duplicateRepurposeArtboard(project, artboardId);
		expect(project.repurposeBoard!.artboards).toHaveLength(2);
		const duplicated = project.repurposeBoard!.artboards[1];
		expect(duplicated.name).toContain("(Copy)");
		expect(duplicated.tracks).toBeDefined();
		expect(duplicated.tracks!.map((t) => t.name)).toEqual(
			targetArtboard.tracks!.map((t) => t.name),
		);
		expect(duplicated.tracks![0].id).not.toBe(targetArtboard.tracks![0].id);
		expect(duplicated.id).not.toBe(targetArtboard.id);

		expect(() => validateTimelineProject(project)).not.toThrow();
	});

	it("places asset into artboard timeline and creates tracks if needed", () => {
		let project = createTimelineProject("p1", "Test Project");
		project = addRepurposeArtboard(project, {
			aspectRatio: "9:16",
			name: "Shorts",
			width: 1080,
			height: 1920,
			defaultFitMode: "cover",
		});
		const artboardId = project.repurposeBoard!.artboards[0].id;

		// Add asset to project
		project = {
			...project,
			assets: [
				{
					id: "video-asset-1",
					name: "ScreenRecord.mp4",
					kind: "video",
					durationUs: 5_000_000,
					width: 1920,
					height: 1080,
					source: {
						type: "file" as const,
						path: "assets/video-asset-1/ScreenRecord.mp4",
						durationUs: 5_000_000,
						offsetUs: 0,
					},
				},
			],
		};

		// Place asset into artboard
		project = placeAssetIntoArtboard(project, artboardId, "video-asset-1");

		const abView = getArtboardProjectView(project, artboardId);
		expect(abView.tracks.length).toBeGreaterThan(0);
		const videoTrack = abView.tracks.find((t) => t.kind === "visual");
		expect(videoTrack).toBeDefined();
		expect(videoTrack?.clips).toHaveLength(1);
		expect(videoTrack?.clips[0].assetId).toBe("video-asset-1");
		expect(videoTrack?.clips[0].sourceOutUs).toBe(5_000_000);

		// Place another asset (audio)
		project = {
			...project,
			assets: [
				...project.assets,
				{
					id: "audio-asset-1",
					name: "Voice.mp3",
					kind: "audio",
					durationUs: 3_000_000,
					width: 0,
					height: 0,
					source: {
						type: "file" as const,
						path: "assets/audio-asset-1/Voice.mp3",
						durationUs: 3_000_000,
						offsetUs: 0,
					},
				},
			],
		};

		project = placeAssetIntoArtboard(project, artboardId, "audio-asset-1");
		const updatedAbView = getArtboardProjectView(project, artboardId);
		const audioTrack = updatedAbView.tracks.find((t) => t.kind === "audio");
		expect(audioTrack).toBeDefined();
		expect(audioTrack?.clips).toHaveLength(1);
		expect(audioTrack?.clips[0].assetId).toBe("audio-asset-1");

		expect(() => validateTimelineProject(project)).not.toThrow();
	});

	it("preserves backward compatibility when validating project without repurposeBoard", () => {
		const legacy = createTimelineProject("leg", "Legacy Project");
		delete (legacy as any).repurposeBoard;
		expect(() => validateTimelineProject(legacy)).not.toThrow();
	});
});
