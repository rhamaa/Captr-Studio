import { describe, it, expect } from "vitest";
import { PreviewQueue } from "./previewQueue";
describe("preview lifecycle", () => {
	it("ignores disposed renders while a fresh mount renders normally", async () => {
		let reject!: (error: Error) => void;
		const frames: string[] = [],
			errors: string[] = [];
		const old = new PreviewQueue<number, string>(
			() =>
				new Promise((_, r) => {
					reject = r;
				}),
			(v) => frames.push(v),
			(e) => errors.push(String(e)),
		);
		old.request(1);
		old.dispose();
		const next = new PreviewQueue<number, string>(
			async (v) => String(v),
			(v) => frames.push(v),
			(e) => errors.push(String(e)),
		);
		next.request(2);
		reject(new Error("Project renderer disposed"));
		await new Promise((r) => setTimeout(r, 0));
		expect(errors).toEqual([]);
		expect(frames).toEqual(["2"]);
	});
	it("drops obsolete frames and renders the latest seek", async () => {
		let resolve!: (value: string) => void;
		const frames: string[] = [];
		const queue = new PreviewQueue<number, string>(
			(v) =>
				v === 1
					? new Promise((r) => {
							resolve = r;
						})
					: Promise.resolve(String(v)),
			(v) => frames.push(v),
			() => {},
		);
		queue.request(1);
		queue.request(2);
		queue.request(3);
		resolve("1");
		await new Promise((r) => setTimeout(r, 0));
		expect(frames).toEqual(["3"]);
	});
});
