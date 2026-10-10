import { describe, expect, it } from "vitest";
import { resolveClipSource } from "./clipSource";
import { addTrack, createTimelineProject, duplicateClip, updateTrack } from "./commands";
import { createAndPlaceShape, setShapeStyleOverride } from "./shapeCommands";
import type { ShapeDefinition } from "./types";

const rectangle: ShapeDefinition = {
	kind: "rectangle",
	width: 320,
	height: 180,
	style: { fill: "#ffffff", stroke: { color: "#111111", width: 2 } },
};

describe("inline shape commands", () => {
	it("creates only an inline shape and five-second placement", () => {
		const project = createAndPlaceShape(
			createTimelineProject("shape-project", "Shapes"),
			rectangle,
			2_000_000,
			{ assetId: "shape", clipId: "shape-clip", trackId: "new-track" },
		);
		const clip = project.tracks[0]!.clips[0]!;
		expect(clip.content).toMatchObject({
			kind: "shape",
			durationUs: 5_000_000,
			shapeDefinition: rectangle,
		});
		expect(project.assets).toEqual([]);
		expect(project.localAssets).toBeUndefined();
		expect(clip.assetId).toBeUndefined();
		expect(clip).toMatchObject({
			id: "shape-clip",
			startUs: 2_000_000,
			sourceOutUs: 5_000_000,
		});
	});

	it("uses the first unlocked visual track or adds one if none is available", () => {
		let project = addTrack(
			createTimelineProject("shape-track", "Shapes"),
			"visual-2",
			"visual",
		);
		project = updateTrack(project, "visual-1", { locked: true });
		const onExisting = createAndPlaceShape(project, rectangle, 0, {
			assetId: "shape-a",
			clipId: "clip-a",
			trackId: "unused-track-id",
		});
		expect(onExisting.tracks.find((track) => track.id === "visual-2")?.clips[0]?.id).toBe(
			"clip-a",
		);

		project = updateTrack(onExisting, "visual-2", { locked: true });
		const onNewTrack = createAndPlaceShape(project, rectangle, 0, {
			assetId: "shape-b",
			clipId: "clip-b",
			trackId: "visual-3",
		});
		expect(onNewTrack.tracks.find((track) => track.id === "visual-3")).toMatchObject({
			kind: "visual",
			locked: false,
			clips: [{ id: "clip-b" }],
		});
	});

	it("places a new shape on another visual track when the first is occupied at that time", () => {
		const occupied = createAndPlaceShape(
			createTimelineProject("shape-occupied", "Shapes"),
			rectangle,
			0,
			{ assetId: "shape-a", clipId: "clip-a", trackId: "unused-a" },
		);
		const next = createAndPlaceShape(occupied, rectangle, 0, {
			assetId: "shape-b",
			clipId: "clip-b",
			trackId: "visual-2",
		});
		expect(
			next.tracks.find((track) => track.id === "visual-1")?.clips.map((clip) => clip.id),
		).toEqual(["clip-a"]);
		expect(
			next.tracks.find((track) => track.id === "visual-2")?.clips.map((clip) => clip.id),
		).toEqual(["clip-b"]);
	});

	it("resolves inline line and arrow dimensions from their local geometry bounds", () => {
		const line: ShapeDefinition = {
			kind: "line",
			from: { x: 0, y: 10 },
			to: { x: 200, y: 90 },
			style: { stroke: { color: "#000000", width: 3 } },
		};
		const arrow: ShapeDefinition = {
			kind: "arrow",
			from: { x: 10, y: 20 },
			to: { x: 240, y: 120 },
			headLength: 16,
			style: { stroke: { color: "#123456", width: 2 } },
		};
		const fromLine = createAndPlaceShape(createTimelineProject("line", "Line"), line, 0, {
			assetId: "line",
			clipId: "line-clip",
			trackId: "new-track",
		});
		const fromArrow = createAndPlaceShape(createTimelineProject("arrow", "Arrow"), arrow, 0, {
			assetId: "arrow",
			clipId: "arrow-clip",
			trackId: "new-track",
		});
		expect(resolveClipSource(fromLine, fromLine.tracks[0].clips[0])).toMatchObject({
			width: 200,
			height: 90,
			content: { shapeDefinition: line },
		});
		expect(resolveClipSource(fromArrow, fromArrow.tracks[0].clips[0])).toMatchObject({
			width: 240,
			height: 120,
			content: { shapeDefinition: arrow },
		});
	});

	it("changes only the selected placement style and can clear the override", () => {
		let project = createAndPlaceShape(
			createTimelineProject("shape-style", "Style"),
			rectangle,
			0,
			{ assetId: "shape", clipId: "first", trackId: "new-track" },
		);
		project = duplicateClip(project, "first", 5_000_000, { clipId: "second" });
		const edited = setShapeStyleOverride(project, "first", {
			fill: "#ff0000",
			stroke: { color: "#00ff00", width: 4 },
		});
		expect(edited.tracks[0]!.clips[0]!.shapeStyleOverride?.fill).toBe("#ff0000");
		expect(edited.tracks[0]!.clips[1]!.shapeStyleOverride).toBeUndefined();
		expect(edited.tracks[0].clips[0].content).toMatchObject({ shapeDefinition: rectangle });
		expect(project.tracks[0]!.clips[0]!.shapeStyleOverride).toBeUndefined();
		expect(
			setShapeStyleOverride(edited, "first", null).tracks[0]!.clips[0]!.shapeStyleOverride,
		).toBeUndefined();
	});
});
