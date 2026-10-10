import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { addClipTransition } from "@/core/timeline/clipTransitions";
import { createTimelineProject } from "@/core/timeline/commands";
import { createAndPlaceShape } from "@/core/timeline/shapeCommands";
import type { TimelineProject } from "@/core/timeline/types";
import { TimelineTransitionItem, transitionDurationFromDrag } from "./TimelineTransitionItem";

function projectWithTransition(): TimelineProject {
	let project = createAndPlaceShape(
		createTimelineProject("transition", "Transition"),
		{
			kind: "rectangle",
			width: 120,
			height: 80,
			style: { fill: "#3366ff", stroke: null },
		},
		0,
		{ assetId: "left-asset", clipId: "left-clip", trackId: "visual-extra" },
	);
	project = createAndPlaceShape(
		project,
		{
			kind: "ellipse",
			width: 100,
			height: 100,
			style: { fill: "#ff6633", stroke: null },
		},
		5_000_000,
		{ assetId: "right-asset", clipId: "right-clip", trackId: "visual-extra" },
	);
	// New inline Shapes have finite source extents; retain five-second visible clips
	// while providing half a second of source on each side of this UI fixture's cut.
	const [left, right] = project.tracks[0].clips;
	left.content!.durationUs = 6_000_000;
	right.content!.durationUs = 6_000_000;
	right.sourceInUs = 500_000;
	right.sourceOutUs = 5_500_000;
	return addClipTransition(
		project,
		{
			trackId: "visual-1",
			fromClipId: "left-clip",
			toClipId: "right-clip",
			preset: { kind: "cross-dissolve" },
			easing: "linear",
		},
		"cut-transition",
	);
}

it("shows one selected transition block centered on its cut", () => {
	const project = projectWithTransition(),
		transition = project.clipTransitions![0]!;
	const markup = renderToStaticMarkup(
		createElement(
			I18nProvider,
			null,
			createElement(TimelineTransitionItem, {
				transition,
				boundaryUs: 5_000_000,
				maximumDurationUs: 1_000_000,
				scale: 50,
				selected: true,
				locked: false,
				snappingEnabled: true,
				onSelect: () => undefined,
				onCommand: () => undefined,
			}),
		),
	);
	expect(markup).toContain('class="project-transition-item selected"');
	expect(markup).toContain('aria-label="Cross dissolve transition"');
	expect(markup).toContain('data-transition-id="cut-transition"');
	expect(markup).not.toContain('role="slider"');
	expect(markup).toContain('aria-hidden="true"');
});

it("converts transition edge drags through timeline scale and snaps within available handles", () => {
	expect(transitionDurationFromDrag(500_000, "right", 20, 100, 1_000_000, false)).toBe(900_000);
	expect(transitionDurationFromDrag(500_000, "left", -20, 100, 1_000_000, false)).toBe(900_000);
	expect(transitionDurationFromDrag(500_000, "right", 1000, 100, 800_000, false)).toBe(800_000);
	expect(transitionDurationFromDrag(525_000, "right", 0, 100, 1_000_000, true)).toBe(550_000);
});
