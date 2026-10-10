import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createTimelineProject } from "../../../src/core/timeline/commands";
import { packProjectWorkspace, inspectProjectBundle } from "./projectBundle";
import { recoverProjectRenameTransactions, renameProjectBundle } from "./projectRenameTransaction";

const roots: string[] = [];
afterEach(() => vi.restoreAllMocks());
afterEach(async () => {
	for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});
async function setup() {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-rename-"));
	roots.push(root);
	const originalPath = path.join(root, "Tutorial.captr"),
		destinationPath = path.join(root, "Demo.captr");
	const workspace = path.join(root, "workspace");
	await fs.mkdir(workspace);
	const project = createTimelineProject("rename-project", "Tutorial");
	await fs.writeFile(path.join(workspace, "project.json"), JSON.stringify(project));
	await fs.writeFile(path.join(workspace, "sidecar.wav"), "original audio");
	await packProjectWorkspace(workspace, originalPath);
	return {
		root,
		originalPath,
		destinationPath,
		original: await fs.readFile(originalPath),
		input: {
			operationId: "rename-test",
			originalPath,
			destinationPath,
			projectId: project.projectId,
			writeCandidate: async (candidate: string) => {
				await fs.writeFile(
					path.join(workspace, "project.json"),
					JSON.stringify({ ...project, title: "Demo" }),
				);
				await packProjectWorkspace(workspace, candidate);
			},
		},
		options: { journalDir: path.join(root, "journals") },
	};
}

it("commits the new filename and title with the same identity and sidecars", async () => {
	const f = await setup();
	expect((await renameProjectBundle(f.input, f.options)).path).toBe(f.destinationPath);
	await expect(fs.stat(f.originalPath)).rejects.toMatchObject({ code: "ENOENT" });
	const result = await inspectProjectBundle(f.destinationPath);
	expect(result.projectData).toMatchObject({ projectId: "rename-project", title: "Demo" });
	expect(result.entries.some((e) => e.path === "sidecar.wav")).toBe(true);
	expect(await recoverProjectRenameTransactions(f.options.journalDir)).toEqual({
		warnings: [],
		blockedPaths: [],
	});
});
it("reports a committed rename even when owned temporary cleanup is locked", async () => {
	const f = await setup();
	const unlink = fs.unlink.bind(fs);
	vi.spyOn(fs, "unlink").mockImplementation(async (file) => {
		if (String(file).endsWith(".candidate")) throw new Error("candidate locked");
		return unlink(file);
	});
	const result = await renameProjectBundle(f.input, f.options);
	expect(result.path).toBe(f.destinationPath);
	expect((await inspectProjectBundle(f.destinationPath)).projectData?.projectId).toBe(
		"rename-project",
	);
	await expect(fs.stat(f.originalPath)).rejects.toMatchObject({ code: "ENOENT" });
	vi.restoreAllMocks();
	expect((await recoverProjectRenameTransactions(f.options.journalDir)).warnings).toEqual([]);
});
it.each([
	"before-publish",
	"before-retire",
] as const)("rolls back %s failures without changing original bytes", async (point) => {
	const f = await setup();
	await expect(
		renameProjectBundle(f.input, {
			...f.options,
			fault: async (at) => {
				if (at === point) throw new Error("locked");
			},
		}),
	).rejects.toThrow("locked");
	expect(await fs.readFile(f.originalPath)).toEqual(f.original);
	await expect(fs.stat(f.destinationPath)).rejects.toMatchObject({ code: "ENOENT" });
});
it("does not overwrite a collision arriving after staging", async () => {
	const f = await setup();
	await expect(
		renameProjectBundle(f.input, {
			...f.options,
			fault: async (at) => {
				if (at === "before-publish")
					await fs.writeFile(f.destinationPath, "another project");
			},
		}),
	).rejects.toThrow();
	expect(await fs.readFile(f.originalPath)).toEqual(f.original);
	expect(await fs.readFile(f.destinationPath, "utf8")).toBe("another project");
});
it("refuses to retire a source modified by another process", async () => {
	const f = await setup();
	await expect(
		renameProjectBundle(f.input, {
			...f.options,
			fault: async (at) => {
				if (at === "before-retire") await fs.writeFile(f.originalPath, "new foreign bytes");
			},
		}),
	).rejects.toThrow();
	expect(await fs.readFile(f.originalPath, "utf8")).toBe("new foreign bytes");
});
it("validates candidate project identity before publication", async () => {
	const f = await setup();
	await expect(
		renameProjectBundle(
			{ ...f.input, writeCandidate: (p) => fs.writeFile(p, "not a bundle") },
			f.options,
		),
	).rejects.toThrow();
	expect(await fs.readFile(f.originalPath)).toEqual(f.original);
});
it("case-only rename preserves content and requested spelling", async () => {
	const f = await setup();
	const target = path.join(f.root, "tutorial.captr");
	await renameProjectBundle(
		{ ...f.input, destinationPath: target, writeCandidate: (p) => fs.writeFile(p, f.original) },
		{ ...f.options, platform: "win32" },
	);
	expect(await fs.readFile(target)).toEqual(f.original);
	expect(await fs.readdir(f.root)).toContain("tutorial.captr");
	expect(await fs.readdir(f.root)).not.toContain("Tutorial.captr");
});
it("preserves files and reports malformed or foreign recovery records", async () => {
	const f = await setup();
	await fs.mkdir(f.options.journalDir);
	await fs.writeFile(
		path.join(f.options.journalDir, "foreign.json"),
		JSON.stringify({
			originalPath: f.originalPath,
			destinationPath: f.destinationPath,
			phase: "published",
		}),
	);
	const result = await recoverProjectRenameTransactions(f.options.journalDir);
	expect(result.warnings.length).toBeGreaterThan(0);
	expect(await fs.readFile(f.originalPath)).toEqual(f.original);
});

async function recoveryFixture(phase: "staged" | "published" | "retired", caseOnly = false) {
	const f = await setup();
	await fs.mkdir(f.options.journalDir);
	const candidatePath = path.join(f.root, ".captr-rename-recovery-unique.candidate");
	const backupPath = path.join(f.root, ".captr-rename-recovery-unique.backup");
	await f.input.writeCandidate(candidatePath);
	const fp = async (p: string) => {
		const stat = await fs.stat(p, { bigint: true });
		return {
			hash: createHash("sha256")
				.update(await fs.readFile(p))
				.digest("hex"),
			ino: String(stat.ino),
			dev: String(stat.dev),
			size: String(stat.size),
			mtime: String(stat.mtimeNs),
		};
	};
	const journal = {
		version: 1,
		operationId: "recovery",
		projectId: "rename-project",
		originalPath: f.originalPath,
		destinationPath: f.destinationPath,
		candidatePath,
		backupPath,
		original: await fp(f.originalPath),
		candidate: await fp(candidatePath),
		caseOnly,
		phase,
	};
	if (caseOnly) {
		await fs.link(f.originalPath, backupPath);
		await fs.unlink(f.originalPath);
	}
	if (phase !== "staged") await fs.link(candidatePath, f.destinationPath);
	if (phase === "retired" && !caseOnly) await fs.unlink(f.originalPath);
	await fs.writeFile(path.join(f.options.journalDir, "recovery.json"), JSON.stringify(journal));
	return f;
}
it.each([
	"staged",
	"published",
] as const)("recovers %s work by retaining the old project", async (phase) => {
	const f = await recoveryFixture(phase);
	expect(await recoverProjectRenameTransactions(f.options.journalDir)).toEqual({
		warnings: [],
		blockedPaths: [],
	});
	expect(await fs.readFile(f.originalPath)).toEqual(f.original);
	await expect(fs.stat(f.destinationPath)).rejects.toMatchObject({ code: "ENOENT" });
	expect(await recoverProjectRenameTransactions(f.options.journalDir)).toEqual({
		warnings: [],
		blockedPaths: [],
	});
});
it("finishes recovery after the original was retired", async () => {
	const f = await recoveryFixture("retired");
	expect(await recoverProjectRenameTransactions(f.options.journalDir)).toEqual({
		warnings: [],
		blockedPaths: [],
	});
	expect((await inspectProjectBundle(f.destinationPath)).projectData?.title).toBe("Demo");
	await expect(fs.stat(f.originalPath)).rejects.toMatchObject({ code: "ENOENT" });
});
it("restores a case-only intermediate if destination was never published", async () => {
	const f = await recoveryFixture("staged", true);
	expect(await recoverProjectRenameTransactions(f.options.journalDir)).toEqual({
		warnings: [],
		blockedPaths: [],
	});
	expect(await fs.readFile(f.originalPath)).toEqual(f.original);
});
it("blocks ambiguous published recovery without deleting foreign destination bytes", async () => {
	const f = await recoveryFixture("published");
	await fs.unlink(f.destinationPath);
	await fs.writeFile(f.destinationPath, "foreign");
	const result = await recoverProjectRenameTransactions(f.options.journalDir);
	expect(result.blockedPaths).toContain(f.originalPath);
	expect(await fs.readFile(f.destinationPath, "utf8")).toBe("foreign");
	expect(await fs.readFile(f.originalPath)).toEqual(f.original);
});
