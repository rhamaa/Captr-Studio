import { expect, it } from "vitest";
import { HomeProjectsController } from "./useHomeProjects";
it("keeps loading error and empty distinct and rejects stale refresh results", async () => {
	const pending: Array<(v: any) => void> = [];
	const c = new HomeProjectsController(() => new Promise((resolve) => pending.push(resolve)));
	const first = c.refresh(),
		second = c.refresh();
	expect(c.snapshot.loading).toBe(true);
	pending[1]({ success: true, entries: [{ path: "external.captr", name: "External" }] });
	await second;
	pending[0]({ success: true, entries: [] });
	await first;
	expect(c.snapshot.entries[0].name).toBe("External");
	const error = c.refresh();
	pending[2]({ success: false, error: "Directory denied", entries: [] });
	await error;
	expect(c.snapshot.error).toBe("Directory denied");
	expect(c.snapshot.entries).toHaveLength(1);
	const empty = c.refresh();
	pending[3]({ success: true, entries: [] });
	await empty;
	expect(c.snapshot).toMatchObject({ loading: false, error: null, entries: [] });
});
