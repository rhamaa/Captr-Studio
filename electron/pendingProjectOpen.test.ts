import { expect, it, vi } from "vitest";
vi.mock("./ipc/project/manager", () => ({ releaseLegacyProjectCandidate: vi.fn() }));
import { releaseLegacyProjectCandidate } from "./ipc/project/manager";
import { queueProjectOpen, consumePendingProjectOpen } from "./pendingProjectOpen";
it("retains the full cold conversion result for one consumer", async () => {
	const result = {
		success: true,
		project: { version: 2 },
		conversionToken: "legacy",
		path: "old.captr",
	};
	await queueProjectOpen({ result });
	expect(consumePendingProjectOpen()).toEqual({ result });
	expect(consumePendingProjectOpen()).toBeNull();
});
it("queues warm paths without installing another project and releases replaced candidates", async () => {
	await queueProjectOpen({ result: { success: true, conversionToken: "abandoned" } });
	await queueProjectOpen({ path: "next.captr" });
	expect(releaseLegacyProjectCandidate).toHaveBeenCalledWith("abandoned");
	expect(consumePendingProjectOpen()).toEqual({ path: "next.captr" });
});
