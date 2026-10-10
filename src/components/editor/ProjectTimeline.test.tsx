import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { addClipTransition } from "@/core/timeline/clipTransitions";
import { addTrack, createTimelineProject, moveClip, trimClip } from "@/core/timeline/commands";
import { extendInlineClip } from "@/core/timeline/designTemplateCommands";
import { ProjectHistory } from "@/core/timeline/history";
import { createAndPlaceShape } from "@/core/timeline/shapeCommands";
import type { ShapeDefinition, TimelineProject } from "@/core/timeline/types";
import {
	ProjectTimeline,
	shapePlacementCommand,
	transitionPlacementCommand,
} from "./ProjectTimeline";

function projectWithTwoShapes(): TimelineProject {
	let project = createTimelineProject("timeline", "Timeline");
	const first: ShapeDefinition = {
		kind: "rectangle",
		width: 120,
		height: 80,
		style: { fill: "#3366ff", stroke: null },
	};
	const second: ShapeDefinition = {
		kind: "ellipse",
		width: 100,
		height: 100,
		style: { fill: "#ff6633", stroke: null },
	};
	project = createAndPlaceShape(project, first, 0, {
		assetId: "left-asset",
		clipId: "left-clip",
		trackId: "visual-extra",
	});
	project = extendInlineClip(project, "left-clip", 6_000_000);
	project = trimClip(project, "left-clip", 0, 5_000_000);
	project = createAndPlaceShape(project, second, 5_000_000, {
		assetId: "right-asset",
		clipId: "right-clip",
		trackId: "visual-extra",
	});
	project = extendInlineClip(project, "right-clip", 6_000_000);
	project = trimClip(project, "right-clip", 1_000_000, 6_000_000, 5_000_000);
	return project;
}

function renderTimeline(project: TimelineProject) {
	return renderToStaticMarkup(
		createElement(
			I18nProvider,
			null,
			createElement(ProjectTimeline, {
				project,
				selection: [],
				playheadUs: 8_000_000,
				onCommand: () => undefined,
				onSelect: () => undefined,
				onSeek: () => undefined,
				onOpenRecording: () => undefined,
				selectedTransitionId: null,
				onSelectTransition: () => undefined,
			}),
		),
	);
}

it("projectTimeline shows only the eligible transition boundary", () => {
	const project = projectWithTwoShapes();
	expect(renderTimeline(project)).not.toContain("project-shape-rail-menu");
	project.clipTransitions = [
		{
			id: "eligible",
			trackId: "visual-1",
			fromClipId: "left-clip",
			toClipId: "right-clip",
			preset: { kind: "cross-dissolve" },
			durationUs: 500_000,
			easing: "linear",
		},
	];
	expect(renderTimeline(project).match(/project-transition-item/g)).toHaveLength(1);
	const moved = moveClip(project, "right-clip", "visual-1", 6_000_000);
	expect(renderTimeline(moved)).not.toContain("project-transition-item");
});

it("renders visual overlays above a separated audio group", () => {
	let project = createTimelineProject("timeline-groups", "Timeline groups");
	project = addTrack(project, "visual-top", "visual");
	project = addTrack(project, "audio-bottom", "audio");
	const markup = renderTimeline(project);

	const topVisual = markup.indexOf('data-track-id="visual-top"');
	const baseVisual = markup.indexOf('data-track-id="visual-1"');
	const divider = markup.indexOf('class="project-track-group-divider"');
	const firstAudio = markup.indexOf('data-track-id="audio-1"');

	expect(topVisual).toBeGreaterThanOrEqual(0);
	expect(topVisual).toBeLessThan(baseVisual);
	expect(baseVisual).toBeLessThan(divider);
	expect(divider).toBeLessThan(firstAudio);
});

it("offers an add-transition action on eligible boundaries and removes it after placement", () => {
	const project = projectWithTwoShapes();
	const initial = renderTimeline(project);
	expect(initial).toContain('aria-label="Add transition"');
	const next = transitionPlacementCommand("left-clip", "right-clip", "new-transition")(project);
	const markup = renderTimeline(next);
	expect(next.clipTransitions?.[0]).toMatchObject({
		id: "new-transition",
		fromClipId: "left-clip",
		toClipId: "right-clip",
	});
	expect(markup).toContain("project-transition-item");
	expect(markup).not.toContain('aria-label="Add transition"');
});

it("keeps the shape picker out of the timeline toolbar and places shapes at the playhead", () => {
	const project = createTimelineProject("shape", "Shape");
	const markup = renderTimeline(project);
	expect(markup).not.toContain("project-shape-menu");
	expect(markup).not.toContain("project-shape-rail-menu");
	const next = shapePlacementCommand("arrow", 8_000_000, {
		assetId: "arrow",
		clipId: "arrow-clip",
		trackId: "visual-new",
	})(project);
	const clip = next.tracks
		.flatMap((track) => track.clips)
		.find((item) => item.id === "arrow-clip");
	expect(clip?.startUs).toBe(8_000_000);
	expect(clip?.content).toMatchObject({ kind: "shape", durationUs: 5_000_000 });
	expect(next.assets).toEqual([]);
});

it("projectTimeline undo restores shape and transition edits", () => {
	const initial = projectWithTwoShapes(),
		history = new ProjectHistory(initial);
	const withTransition = history.execute((project) =>
		addClipTransition(
			project,
			{
				trackId: "visual-1",
				fromClipId: "left-clip",
				toClipId: "right-clip",
				preset: { kind: "wipe", direction: "left" },
				easing: "linear",
			},
			"transition",
		),
	);
	expect(withTransition.clipTransitions).toHaveLength(1);
	history.execute(
		shapePlacementCommand("line", 10_000_000, {
			assetId: "line",
			clipId: "line-clip",
			trackId: "new-track",
		}),
	);
	expect(
		history.project.tracks
			.flatMap((track) => track.clips)
			.some((clip) => clip.id === "line-clip"),
	).toBe(true);
	history.undo();
	expect(
		history.project.tracks
			.flatMap((track) => track.clips)
			.some((clip) => clip.id === "line-clip"),
	).toBe(false);
	history.undo();
	expect(history.project.clipTransitions ?? []).toHaveLength(0);
	history.redo();
	expect(history.project.clipTransitions).toHaveLength(1);
});
