import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { addClipTransition, setComponentAnimation, updateClipTransition } from "@/core/timeline/clipTransitions";
import { createTimelineProject, trimClip } from "@/core/timeline/commands";
import { createAndPlaceShape, setShapeStyleOverride } from "@/core/timeline/shapeCommands";
import type { ClipTransitionPreset, ComponentAnimation, ShapeDefinition, TimelineProject } from "@/core/timeline/types";
import { ProjectInspector, componentAnimationDurationLimitUs, defaultComponentAnimationDurationUs, transitionPresetFromControl } from "./ProjectInspector";

function projectWithShapesAndTransition(): TimelineProject {
	let project = createTimelineProject("inspector", "Inspector");
	const rectangle: ShapeDefinition = { kind: "rectangle", width: 120, height: 80, style: { fill: "#3366ff", stroke: null } };
	project = createAndPlaceShape(project, rectangle, 0, { assetId: "left-asset", clipId: "left-clip", trackId: "new-track" });
	project = createAndPlaceShape(project, rectangle, 5_000_000, { assetId: "right-asset", clipId: "right-clip", trackId: "new-track" });
	return addClipTransition(project, {
		trackId: "visual-1", fromClipId: "left-clip", toClipId: "right-clip", preset: { kind: "wipe", direction: "left" }, easing: "linear",
	}, "transition");
}

function markup(project: TimelineProject, options: { selection?: string[]; selectedTransitionId?: string | null } = {}) {
	return renderToStaticMarkup(createElement(I18nProvider, null, createElement(ProjectInspector, {
		project, selection: options.selection ?? [], selectedTransitionId: options.selectedTransitionId ?? null,
		playheadUs: 500_000, onCommand: () => undefined, onOpenRecording: () => undefined,
	})));
}

it("projectInspector exposes transition preset, duration, direction, and easing controls", () => {
	const html = markup(projectWithShapesAndTransition(), { selectedTransitionId: "transition" });
	for (const label of ["Transition preset", "Transition duration milliseconds", "Transition direction", "Transition easing", "Maximum transition duration"]) expect(html).toContain(label);
});

it("projectInspector defaults directional presets to the left edge", () => {
	expect(transitionPresetFromControl("wipe")).toEqual({ kind: "wipe", direction: "left" });
	expect(transitionPresetFromControl("push")).toEqual({ kind: "push", direction: "left" });
	expect(transitionPresetFromControl("fade-through-white")).toEqual({ kind: "fade-through", color: "white" });
});

it("projectInspector displays source-handle maximum and permits preset edits", () => {
	const project = projectWithShapesAndTransition();
	expect(markup(project, { selectedTransitionId: "transition" })).toContain("Maximum transition duration");
	const preset: ClipTransitionPreset = { kind: "push", direction: "up" };
	const next = updateClipTransition(project, "transition", { preset, durationUs: 900_000, easing: "ease-in" });
	expect(next.clipTransitions?.[0]).toMatchObject({ preset, durationUs: 900_000, easing: "ease-in" });
});

it("projectInspector exposes independent enter and exit animations and a 300ms default capped at two seconds", () => {
	const project = projectWithShapesAndTransition();
	const html = markup(project, { selection: ["left-clip"] });
	for (const label of ["Enter animation", "Exit animation"]) expect(html).toContain(`aria-label="${label}"`);
	expect(defaultComponentAnimationDurationUs(5_000_000, 0)).toBe(300_000);
	expect(defaultComponentAnimationDurationUs(5_000_000, 1_800_000)).toBe(300_000);
	expect(componentAnimationDurationLimitUs(5_000_000, 0)).toBe(2_000_000);
	expect(componentAnimationDurationLimitUs(1_000_000, 700_000)).toBe(300_000);
});

it("projectInspector caps component durations so enter and exit do not overlap", () => {
	const project = projectWithShapesAndTransition();
	const shortClip = trimClip(project, "left-clip", 0, 1_000_000);
	const first = setComponentAnimation(shortClip, "left-clip", "enter", { preset: "fade", durationUs: 700_000, easing: "linear" });
	const withExit = setComponentAnimation(first, "left-clip", "exit", { preset: "fade", durationUs: 100_000, easing: "linear" });
	const html = markup(withExit, { selection: ["left-clip"] });
	expect(html).toContain('max="300"');
	const animation: ComponentAnimation = { preset: "slide", durationUs: 300_000, easing: "linear", direction: "left" };
	expect(setComponentAnimation(first, "left-clip", "exit", animation).tracks[0]!.clips[0]!.componentAnimation?.exit).toEqual(animation);
});

it("projectInspector edits shape style per placement without mutating the asset", () => {
	const project = projectWithShapesAndTransition();
	const next = setShapeStyleOverride(project, "right-clip", { fill: "#ff0000", stroke: null });
	expect(markup(next, { selection: ["right-clip"] })).toContain("Shape fill");
	expect(next.assets[0]?.shapeDefinition?.kind).toBe("rectangle");
	expect(next.tracks[0]?.clips[1]?.shapeStyleOverride?.fill).toBe("#ff0000");
});
