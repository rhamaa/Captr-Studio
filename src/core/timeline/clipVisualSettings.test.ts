import { expect, it } from "vitest";
import { ownershipFixture } from "./storyOwnership.fixtures";
import { getStoryProject } from "./storyOwnership";
import { updateClipVisualSettings } from "./clipVisualSettings";
import { validateTimelineProject } from "./validation";
import { drawStyledMedia } from "@/lib/exporter/clipVisualRenderer";
import { getClipBaseDimensions } from "@/components/editor/canvasGizmoMath";
it.each([
	{ crop: { left: 0.7, right: 0.4, top: 0, bottom: 0 } },
	{ mask: "url(bad)" },
	{ brightness: NaN },
	{ saturation: 4 },
	{ maskInset: 0.5 },
])("rejects invalid placement visual settings %o", (settings) => {
	const p = getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "A" });
	expect(() => updateClipVisualSettings(p, p.tracks[0].clips[0].id, settings as any)).toThrow(
		/visual|crop|mask|color|finite/i,
	);
});
it("fits gizmo bounds to the cropped media aspect instead of the uncropped source", () => {
	const p = getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "A" }),
		clip = p.tracks[0].clips[0];
	clip.visualSettings = { crop: { left: 0.25, right: 0.25, top: 0, bottom: 0 } };
	expect(
		getClipBaseDimensions(
			clip,
			{ ...p.assets[0], kind: "video", width: 1000, height: 500 },
			200,
			200,
		),
	).toEqual({ width: 200, height: 200 });
});
it("rejects cubic-bezier time handles outside the normalized interval", () => {
	const p = getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "A" });
	p.tracks[0].clips[0].keyframes = [
		{
			id: "curve",
			property: "opacity",
			timeMs: 0,
			value: 1,
			easing: "cubic-bezier",
			bezier: [-1, 0, 2, 1],
		},
	];
	expect(() => validateTimelineProject(p)).toThrow(/bezier/i);
});
it("updates a placement immutably, preserves output size, and respects track locks", () => {
	const p = getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "A" }),
		id = p.tracks[0].clips[0].id;
	const next = updateClipVisualSettings(p, id, {
		brightness: 1.2,
		mask: "ellipse",
		crop: { left: 0.1, right: 0.1, top: 0, bottom: 0 },
	});
	expect(p.tracks[0].clips[0].visualSettings).toBeUndefined();
	expect(next.canvas).toEqual(p.canvas);
	expect(
		validateTimelineProject(JSON.parse(JSON.stringify(next))).tracks[0].clips[0].visualSettings
			?.mask,
	).toBe("ellipse");
	p.tracks[0].locked = true;
	expect(() => updateClipVisualSettings(p, id, { contrast: 1.1 })).toThrow(/locked/i);
});
it("draws source crop, mask and grading through one shared media operation", () => {
	const draws: any[][] = [],
		shapes: any[][] = [];
	const ctx = {
		filter: "none",
		beginPath() {},
		clip() {},
		ellipse: (...args: any[]) => shapes.push(args),
		drawImage: (...args: any[]) => draws.push(args),
	};
	const source = {} as CanvasImageSource;
	drawStyledMedia(ctx as any, source, 1000, 500, 200, 200, {
		crop: { left: 0.25, right: 0.25, top: 0, bottom: 0 },
		mask: "ellipse",
		brightness: 1.2,
	});
	expect(draws[0]).toEqual([source, 250, 0, 500, 500, -100, -100, 200, 200]);
	expect(shapes[0].slice(0, 4)).toEqual([0, 0, 100, 100]);
	expect(ctx.filter).toContain("brightness(1.2)");
});
