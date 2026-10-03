import { expect, it } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { timelineDropStartUs } from "./timelineInteractions";

it("keeps the pointer at the same point inside a clip while moving it", () => {
	const project = createTimelineProject("drop-test", "Drop test");

	expect(timelineDropStartUs(550, 100, 50, project, 0, 100)).toBe(4_000_000);
});

it("clamps a drop before the lane to its beginning", () => {
	const project = createTimelineProject("drop-test", "Drop test");

	expect(timelineDropStartUs(40, 100, 20, project, 0, 100)).toBe(0);
});
