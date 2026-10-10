import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createTimelineProject } from "../../../src/core/timeline/commands";
import { packProjectWorkspace } from "./projectBundle";
const env = vi.hoisted(() => ({ root: "" }));
vi.mock("electron", () => ({
	app: {
		isPackaged: false,
		getPath: () => env.root,
		getAppPath: () => env.root,
		setPath: () => {},
	},
	BrowserWindow: { getAllWindows: () => [] },
}));
afterEach(async () => {
	if (env.root) await fs.rm(env.root, { recursive: true, force: true });
});
it("Home listing waits for live Rename instead of rolling back its published files", async () => {
	env.root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-live-rename-"));
	const { listProjectLibraryEntries } = await import("./manager");
	const { enqueueProjectFileOperation } = await import("./projectFileQueue");
	const { renameProjectBundle } = await import("./projectRenameTransaction");
	const workspace = path.join(env.root, "workspace");
	await fs.mkdir(workspace);
	const project = createTimelineProject("p", "Old");
	await fs.writeFile(path.join(workspace, "project.json"), JSON.stringify(project));
	const original = path.join(env.root, "Old.captr"),
		destination = path.join(env.root, "New.captr");
	await packProjectWorkspace(workspace, original);
	let release!: () => void, staged!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const published = new Promise<void>((resolve) => {
		staged = resolve;
	});
	const rename = enqueueProjectFileOperation(() =>
		renameProjectBundle(
			{
				operationId: "live",
				originalPath: original,
				destinationPath: destination,
				projectId: "p",
				writeCandidate: async (file) => {
					await fs.writeFile(
						path.join(workspace, "project.json"),
						JSON.stringify({ ...project, title: "New" }),
					);
					await packProjectWorkspace(workspace, file);
				},
			},
			{
				journalDir: path.join(env.root, "project-rename-transactions"),
				fault: async (point) => {
					if (point === "before-retire") {
						staged();
						await gate;
					}
				},
			},
		),
	);
	await published;
	let completed = false;
	const list = listProjectLibraryEntries().then(() => {
		completed = true;
	});
	await new Promise((resolve) => setTimeout(resolve, 25));
	const wasBlocked = !completed;
	release();
	await rename;
	await list;
	expect(wasBlocked).toBe(true);
	expect(await fs.readFile(destination)).toBeInstanceOf(Buffer);
	await expect(fs.stat(original)).rejects.toMatchObject({ code: "ENOENT" });
});
