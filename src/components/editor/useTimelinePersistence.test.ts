import { expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { setComponentAnimation } from "@/core/timeline/clipTransitions";
import { createAndPlaceShape, setShapeStyleOverride } from "@/core/timeline/shapeCommands";
import type { ShapeDefinition } from "@/core/timeline/types";
import { TimelinePersistence } from "./useTimelinePersistence";

it("serializes saves and only clears the saved revision, ignores old project completion", async () => {
	let finish!: (result: any) => void;
	const saved = vi.fn();
	const service = new TimelinePersistence({
		save: vi.fn(
			() =>
				new Promise<any>((resolve) => {
					finish = resolve;
				}),
		),
		onSaved: saved,
	});
	const p = createTimelineProject("one", "One");
	service.beginProject("one");
	const first = service.save(p, 1, "one.captr");
	await Promise.resolve();
	finish({ success: true, path: "one.captr", projectId: "one" });
	await first;
	expect(saved).toHaveBeenCalledWith(1, "one.captr", p);
	const pending = service.save(p, 2, "one.captr");
	await Promise.resolve();
	service.beginProject("two");
	finish({ success: true, path: "one.captr", projectId: "one" });
	await pending;
	expect(saved).toHaveBeenCalledOnce();
});

it("preserves optional visual-effect and pathless shape data in the saved project snapshot", async () => {
	let savedProject: unknown;
	const save = vi.fn(async (project: any) => {
		savedProject = structuredClone(project);
		return { success: true, path: "shapes.captr", projectId: project.projectId };
	});
	const service = new TimelinePersistence({ save, onSaved: vi.fn() });
	const shape: ShapeDefinition = {
		kind: "ellipse",
		width: 200,
		height: 120,
		style: { fill: "#112233", stroke: null },
	};
	let project = createAndPlaceShape(createTimelineProject("snapshot", "Snapshot"), shape, 0, {
		assetId: "shape",
		clipId: "shape-clip",
		trackId: "visual-new",
	});
	project = setComponentAnimation(project, "shape-clip", "enter", {
		preset: "scale-pop",
		durationUs: 300_000,
		easing: "ease-out",
	});
	project = setShapeStyleOverride(project, "shape-clip", { fill: "#abcdef", stroke: null });
	project.clipTransitions = [];
	service.beginProject(project.projectId);

	const result = await service.save(project, 1, "shapes.captr");
	expect(result.success).toBe(true);
	expect(savedProject).toEqual(project);
});
