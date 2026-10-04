import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createTimelineProject, registerRecording } from "../../../src/core/timeline/commands";
import type { ProjectFileRequest } from "../../../src/core/project/fileOperationTypes";
import { inspectProjectBundle } from "./projectBundle";
import { performProjectFileOperation, type ProjectFileServicePorts } from "./projectFileService";

const roots: string[] = [];
afterEach(async () => { for (const r of roots.splice(0)) await fs.rm(r, { recursive: true, force: true }); });
async function setup() {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-files-")); roots.push(root);
	const context: { path: string | null; id: string } = { path: null, id: "project" };
	let choice: string | null = path.join(root, "Tutorial.captr");
	const ports: ProjectFileServicePorts = {
		getCurrentPath: () => context.path, getProjectId: () => context.id, isBusy: () => false,
		isTrusted: () => true, journalDir: path.join(root, "journals"),
		chooseSavePath: async () => choice, commit: (file, id) => { context.path = file; context.id = id; },
		remember: async () => undefined,
	};
	const request: ProjectFileRequest = { operationId: "first-save", ownerProjectId: "project", generation: 1, revision: 0,
		expectedPath: null, intent: "save", project: createTimelineProject("project", "Old title") };
	return { root, context, ports, request, choose: (p: string | null) => { choice = p; } };
}
it("first save returns the actual chosen title rather than stale metadata", async () => {
	const f = await setup(), result = await performProjectFileOperation(f.request, f.ports);
	expect(result).toMatchObject({ success: true, title: "Tutorial", projectId: "project", generation: 1, revision: 0 });
	expect((await inspectProjectBundle(f.context.path!)).projectData?.title).toBe("Tutorial");
});
it("renames a saved bundle without changing its project identity", async () => {
	const f = await setup(); await performProjectFileOperation(f.request, f.ports);
	const old = f.context.path!;
	const result = await performProjectFileOperation({ ...f.request, operationId: "rename", expectedPath: old, intent: "rename", name: "Demo" }, f.ports);
	expect(result).toMatchObject({ success: true, title: "Demo", projectId: "project" });
	expect(f.context.path).toBe(path.join(f.root, "Demo.captr"));
	await expect(fs.stat(old)).rejects.toMatchObject({ code: "ENOENT" });
});
it("Save As preserves original bytes and installs the separate identity", async () => {
	const f = await setup(); await performProjectFileOperation(f.request, f.ports);
	const old = f.context.path!, bytes = await fs.readFile(old);
	f.choose(path.join(f.root, "Copy.captr"));
	const result = await performProjectFileOperation({ ...f.request, operationId: "copy", expectedPath: old, intent: "save-as", project: { ...f.request.project, projectId: "copy" } }, f.ports);
	expect(result).toMatchObject({ success: true, projectId: "copy", title: "Copy" });
	expect(await fs.readFile(old)).toEqual(bytes);
	expect(f.context.id).toBe("copy");
});
it("refuses Save As targeting the original or a hardlink alias", async () => {
	const f = await setup(); await performProjectFileOperation(f.request, f.ports);
	const old = f.context.path!, bytes = await fs.readFile(old);
	for (const target of [old, path.join(f.root, "alias.captr")]) {
		if (target !== old) await fs.link(old, target);
		f.choose(target);
		const result = await performProjectFileOperation({ ...f.request, operationId: "copy", expectedPath: old, intent: "save-as", project: { ...f.request.project, projectId: "copy" } }, f.ports);
		expect(result.success).toBe(false);
		expect(await fs.readFile(old)).toEqual(bytes);
		expect(f.context.path).toBe(old);
	}
});
it("canceled Save As and stale ownership leave the active file untouched", async () => {
	const f = await setup(); await performProjectFileOperation(f.request, f.ports);
	const old = f.context.path!; f.choose(null);
	expect(await performProjectFileOperation({ ...f.request, operationId: "cancel", expectedPath: old, intent: "save-as", project: { ...f.request.project, projectId: "copy" } }, f.ports)).toMatchObject({ success: false, canceled: true });
	expect((await performProjectFileOperation({ ...f.request, operationId: "stale", expectedPath: old, ownerProjectId: "wrong", intent: "rename", name: "Wrong" }, f.ports)).success).toBe(false);
	expect(f.context.path).toBe(old);
});
it("returns the committed rename path even if remembering recents fails", async () => {
	const f = await setup(); await performProjectFileOperation(f.request, f.ports);
	f.ports.remember = async () => { throw new Error("index locked"); };
	const result = await performProjectFileOperation({ ...f.request, operationId: "rename", expectedPath: f.context.path, intent: "rename", name: "Demo" }, f.ports);
	expect(result).toMatchObject({ success: true, path: path.join(f.root, "Demo.captr"), warning: expect.any(String) });
	expect(f.context.path).toBe(path.join(f.root, "Demo.captr"));
});
it("stages an unused recording with all its sidecars during Rename", async () => {
	const f = await setup();
	for (const name of ["screen.mp4", "webcam.mp4", "mic.wav", "system.wav", "cursor.json"]) await fs.writeFile(path.join(f.root, name), name);
	const src = (name: string) => ({ path: path.join(f.root, name), durationUs: 1_000_000, offsetUs: 0 });
	f.request.project = registerRecording(f.request.project, { captureId: "take", name: "Recording", durationUs: 1_000_000, width: 1920, height: 1080,
		screen: src("screen.mp4"), webcam: src("webcam.mp4"), microphone: src("mic.wav"), system: src("system.wav"), cursorPath: path.join(f.root, "cursor.json"), settings: {} }, { assetId: "asset", packageId: "package" });
	await performProjectFileOperation(f.request, f.ports);
	expect((await performProjectFileOperation({ ...f.request, operationId: "rename", expectedPath: f.context.path, intent: "rename", name: "Demo" }, f.ports)).success).toBe(true);
	const inspection = await inspectProjectBundle(f.context.path!);
	expect(inspection.entries.filter((e) => /\.(mp4|wav|json)$/.test(e.path) && e.path.startsWith("assets/asset/")).length).toBeGreaterThanOrEqual(5);
	expect(inspection.projectData?.tracks).toEqual(f.request.project.tracks);
});
