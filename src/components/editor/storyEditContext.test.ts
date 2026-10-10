import { describe, expect, it } from "vitest";
import { addTextOverlay } from "@/core/timeline/commands";
import { getStoryEditProject, getStoryProject } from "@/core/timeline/storyOwnership";
import { ownershipFixture } from "@/core/timeline/storyOwnership.fixtures";
import { ProjectController } from "./useProjectController";

describe("captured Story proposals", () => {
	it("keeps plans bound to their original owner, revision and generation", () => {
		const controller = new ProjectController(ownershipFixture(), async () => ({
			success: true,
		}));
		const scope = { kind: "artboard", artboardId: "A" } as const;
		const plan = {
			context: controller.storyEditContext(scope),
			summary: "A only",
			steps: ["Trim A"],
			createdAt: "",
		};
		const before = controller.snapshot;
		expect(controller.currentStoryEditPlan(plan, scope)).toBe(plan);
		expect(
			controller.currentStoryEditPlan(plan, { kind: "artboard", artboardId: "B" }),
		).toBeNull();
		expect(
			controller.currentStoryEditPlan(
				{ ...plan, context: { ...plan.context, generation: -1 } },
				scope,
			),
		).toBeNull();
		expect(
			controller.currentStoryEditPlan(plan, { kind: "artboard", artboardId: "deleted" }),
		).toBeNull();
		expect(controller.snapshot).toBe(before);
		controller.execute((p) => ({ ...p, updatedAt: "2026-10-10T01:00:00.000Z" }));
		expect(controller.currentStoryEditPlan(plan, scope)).toBeNull();
		controller.undo();
		expect(controller.currentStoryEditPlan(plan, scope)).toBeNull();
	});
	it("applies only to captured owner and rejects revision, generation, sibling and deleted-owner proposals atomically", () => {
		const controller = new ProjectController(ownershipFixture(), async () => ({
			success: true,
			path: "test.captr",
		}));
		const scope = { kind: "artboard", artboardId: "A" } as const;
		const context = controller.storyEditContext(scope);
		const proposal = addTextOverlay(
			getStoryEditProject(controller.snapshot.project, scope),
			0,
			{ clipId: "proposal", trackId: "proposal-track" },
		);
		const before = controller.snapshot;
		expect(
			controller.acceptStoryEdit(
				context,
				{ kind: "artboard", artboardId: "B" },
				() => proposal,
			),
		).toBe(false);
		expect(controller.snapshot).toBe(before);
		expect(controller.acceptStoryEdit(context, scope, () => proposal)).toBe(true);
		expect(
			getStoryProject(controller.snapshot.project, scope)
				.tracks.flatMap((t) => t.clips)
				.some((c) => c.id === "proposal"),
		).toBe(true);
		const edited = controller.snapshot;
		expect(controller.acceptStoryEdit(context, scope, () => proposal)).toBe(false);
		expect(controller.snapshot).toBe(edited);
		const fresh = controller.storyEditContext(scope);
		controller.execute((p) => ({
			...p,
			repurposeBoard: {
				...p.repurposeBoard!,
				artboards: p.repurposeBoard!.artboards.filter((a) => a.id !== "A"),
			},
			compositions: p.compositions.filter((c) => c.id !== "composition-A"),
			stories: undefined,
			storyManifest: undefined,
		}));
		const deleted = controller.snapshot;
		expect(
			controller.acceptStoryEdit(
				{ ...fresh, revision: deleted.revision },
				scope,
				() => proposal,
			),
		).toBe(false);
		expect(controller.snapshot).toBe(deleted);
		controller.open(ownershipFixture(), null);
		expect(
			controller.acceptStoryEdit(
				{ ...fresh, revision: controller.snapshot.revision },
				scope,
				() => proposal,
			),
		).toBe(false);
	});
});
