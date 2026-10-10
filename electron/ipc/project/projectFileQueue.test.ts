import { expect, it } from "vitest";
import { enqueueProjectFileOperation } from "./projectFileQueue";

it("serializes file work and continues after failure", async () => {
	const events: string[] = [];
	let release!: () => void;
	const gate = new Promise<void>((resolve) => { release = resolve; });
	const first = enqueueProjectFileOperation(async () => { events.push("first"); await gate; throw new Error("failed"); });
	const second = enqueueProjectFileOperation(async () => { events.push("second"); return 2; });
	await Promise.resolve();
	expect(events).toEqual(["first"]);
	release();
	await expect(first).rejects.toThrow("failed");
	expect(await second).toBe(2);
	expect(events).toEqual(["first", "second"]);
});
