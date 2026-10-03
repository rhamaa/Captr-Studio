import { expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
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
