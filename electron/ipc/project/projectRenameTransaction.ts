import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { inspectProjectBundle } from "./projectBundle";

interface Fingerprint {
	hash: string;
	ino: string;
	dev: string;
	size: string;
	mtime: string;
}
interface Journal {
	version: 1;
	operationId: string;
	projectId: string;
	originalPath: string;
	destinationPath: string;
	candidatePath: string;
	backupPath: string;
	original: Fingerprint;
	candidate: Fingerprint;
	caseOnly: boolean;
	phase: "staged" | "published" | "retired";
}
export interface RenameTransactionOptions {
	platform?: NodeJS.Platform;
	journalDir?: string;
	fault?: (
		point: "after-stage" | "before-publish" | "before-retire" | "after-retire",
	) => Promise<void>;
}
async function journalDirectory(override?: string): Promise<string> {
	if (override) return path.resolve(override);
	const { app } = await import("electron");
	return path.join(app.getPath("userData"), "project-rename-transactions");
}
async function fingerprint(file: string): Promise<Fingerprint | null> {
	try {
		const stat = await fs.lstat(file, { bigint: true });
		if (!stat.isFile() || stat.isSymbolicLink())
			throw new Error("Rename requires a regular project file.");
		const hash = createHash("sha256");
		for await (const chunk of createReadStream(file)) hash.update(chunk);
		const after = await fs.lstat(file, { bigint: true });
		if (after.ino !== stat.ino || after.mtimeNs !== stat.mtimeNs || after.size !== stat.size)
			throw new Error("Project changed while checking the rename transaction.");
		return {
			hash: hash.digest("hex"),
			ino: stat.ino.toString(),
			dev: stat.dev.toString(),
			size: stat.size.toString(),
			mtime: stat.mtimeNs.toString(),
		};
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}
function same(a: Fingerprint | null, b: Fingerprint): boolean {
	return Boolean(
		a &&
			a.hash === b.hash &&
			a.ino === b.ino &&
			a.dev === b.dev &&
			a.size === b.size &&
			a.mtime === b.mtime,
	);
}
async function removeOwned(file: string, expected: Fingerprint): Promise<void> {
	const actual = await fingerprint(file);
	if (!actual) return;
	if (!same(actual, expected)) throw new Error(`A file changed outside Captr; preserved ${file}`);
	await fs.unlink(file);
}
async function writeJournal(file: string, value: Journal): Promise<void> {
	const temp = `${file}.tmp`;
	const handle = await fs.open(temp, "w");
	try {
		await handle.writeFile(JSON.stringify(value));
		await handle.sync();
	} finally {
		await handle.close();
	}
	await fs.rename(temp, file);
}
async function finishJournal(file: string, j: Journal): Promise<void> {
	await removeOwned(j.candidatePath, j.candidate);
	await removeOwned(j.backupPath, j.original);
	await fs.unlink(file);
}
/** Either finish a verified commit or restore a verified original; foreign files survive. */
async function reconcile(file: string, j: Journal): Promise<"committed" | "rolled-back"> {
	const original = await fingerprint(j.originalPath),
		destination = await fingerprint(j.destinationPath);
	if (
		same(destination, j.candidate) &&
		(!original || (j.caseOnly && same(original, j.candidate)))
	) {
		await finishJournal(file, j);
		return "committed";
	}
	if (original && !same(original, j.original))
		throw new Error(`The original changed outside Captr; preserved ${j.originalPath}`);
	if (
		destination &&
		!same(destination, j.candidate) &&
		!(j.caseOnly && same(destination, j.original))
	) {
		if (j.phase === "staged" && original && !j.caseOnly) {
			// An exclusive publication collision never belonged to this transaction.
			await finishJournal(file, j);
			return "rolled-back";
		}
		throw new Error(`Rename destination changed outside Captr; preserved ${j.destinationPath}`);
	}
	if (same(destination, j.candidate)) await removeOwned(j.destinationPath, j.candidate);
	if (!original) {
		if (!same(await fingerprint(j.backupPath), j.original))
			throw new Error("Original rename backup is missing or changed.");
		await fs.link(j.backupPath, j.originalPath);
	}
	await finishJournal(file, j);
	return "rolled-back";
}
function validateJournal(value: unknown, journalFile: string): Journal {
	const j = value as Journal;
	if (
		!j ||
		j.version !== 1 ||
		!/^[a-zA-Z0-9_-]+$/.test(j.operationId) ||
		typeof j.projectId !== "string" ||
		!["staged", "published", "retired"].includes(j.phase) ||
		typeof j.caseOnly !== "boolean"
	)
		throw new Error("Invalid rename recovery record.");
	const directory = path.dirname(j.originalPath ?? "");
	for (const p of [j.originalPath, j.destinationPath, j.candidatePath, j.backupPath]) {
		if (typeof p !== "string" || !path.isAbsolute(p) || path.dirname(p) !== directory)
			throw new Error("Unsafe rename recovery path.");
	}
	const prefix = `.captr-rename-${j.operationId}-`;
	if (
		!path.basename(j.candidatePath).startsWith(prefix) ||
		!path.basename(j.backupPath).startsWith(prefix) ||
		path.basename(journalFile) !== `${j.operationId}.json` ||
		(!j.originalPath.endsWith(".captr") && !j.originalPath.toLowerCase().endsWith(".captr"))
	)
		throw new Error("Recovery files do not belong to this transaction.");
	for (const f of [j.original, j.candidate]) {
		if (
			!f ||
			!/^[a-f0-9]{64}$/.test(f.hash) ||
			![f.ino, f.dev, f.size, f.mtime].every((s) => typeof s === "string" && /^\d+$/.test(s))
		)
			throw new Error("Invalid rename fingerprint.");
	}
	return j;
}

export async function renameProjectBundle(
	input: {
		operationId: string;
		originalPath: string;
		destinationPath: string;
		projectId: string;
		writeCandidate: (candidatePath: string) => Promise<void>;
	},
	options: RenameTransactionOptions = {},
): Promise<{ path: string; warning?: string }> {
	const originalPath = path.resolve(input.originalPath),
		destinationPath = path.resolve(input.destinationPath);
	if (originalPath === destinationPath) return { path: originalPath };
	if (
		!/^[a-zA-Z0-9_-]{1,100}$/.test(input.operationId) ||
		path.dirname(originalPath) !== path.dirname(destinationPath)
	)
		throw new Error("Rename must stay in the original project directory.");
	const inspection = await inspectProjectBundle(originalPath);
	if (
		!inspection.success ||
		!inspection.isBundle ||
		inspection.projectData?.projectId !== input.projectId
	)
		throw new Error("The active project identity could not be verified.");
	const original = await fingerprint(originalPath);
	if (!original) throw new Error("Original project is missing.");
	const directory = await journalDirectory(options.journalDir);
	await fs.mkdir(directory, { recursive: true });
	const journalFile = path.join(directory, `${input.operationId}.json`);
	if (
		await fs.stat(journalFile).then(
			() => true,
			(error: NodeJS.ErrnoException) => {
				if (error.code === "ENOENT") return false;
				throw error;
			},
		)
	)
		throw new Error("A rename transaction with this ID already exists.");
	const prefix = path.join(
		path.dirname(originalPath),
		`.captr-rename-${input.operationId}-${randomUUID()}`,
	);
	const candidatePath = `${prefix}.candidate`,
		backupPath = `${prefix}.backup`;
	const caseOnly =
		(options.platform ?? process.platform) === "win32" &&
		originalPath.toLowerCase() === destinationPath.toLowerCase();
	let journal: Journal | null = null;
	try {
		await input.writeCandidate(candidatePath);
		const candidateInspection = await inspectProjectBundle(candidatePath);
		if (
			!candidateInspection.success ||
			!candidateInspection.isBundle ||
			candidateInspection.projectData?.projectId !== input.projectId
		)
			throw new Error("Staged rename bundle has an invalid project identity.");
		const candidate = await fingerprint(candidatePath);
		if (!candidate) throw new Error("Staged rename bundle is missing.");
		journal = {
			version: 1,
			operationId: input.operationId,
			projectId: input.projectId,
			originalPath,
			destinationPath,
			candidatePath,
			backupPath,
			original,
			candidate,
			caseOnly,
			phase: "staged",
		};
		await writeJournal(journalFile, journal);
		await options.fault?.("after-stage");
		await options.fault?.("before-publish");
		if (caseOnly) {
			if (!same(await fingerprint(originalPath), original))
				throw new Error("Original project changed before rename.");
			await fs.link(originalPath, backupPath);
			await removeOwned(originalPath, original);
		}
		await fs.link(candidatePath, destinationPath);
		journal.phase = "published";
		await writeJournal(journalFile, journal);
		await options.fault?.("before-retire");
		if (!caseOnly) await removeOwned(originalPath, original);
		journal.phase = "retired";
		await writeJournal(journalFile, journal);
		await options.fault?.("after-retire");
		await finishJournal(journalFile, journal);
		return { path: destinationPath };
	} catch (error) {
		if (journal) {
			const originalNow = await fingerprint(originalPath).catch(() => null),
				destinationNow = await fingerprint(destinationPath).catch(() => null);
			if (
				same(destinationNow, journal.candidate) &&
				(!originalNow || (journal.caseOnly && same(originalNow, journal.candidate)))
			) {
				await finishJournal(journalFile, journal).catch(() => undefined);
				return {
					path: destinationPath,
					warning:
						"Project renamed; temporary-file cleanup will retry on the next refresh.",
				};
			}
			const committed = await reconcile(journalFile, journal).catch(() => null);
			if (committed === "committed") return { path: destinationPath };
		} else {
			// Only a unique candidate generated by this invocation can exist before journaling.
			await fs.unlink(candidatePath).catch(() => undefined);
		}
		throw error;
	}
}

export async function recoverProjectRenameTransactions(
	override?: string,
): Promise<{ warnings: string[]; blockedPaths: string[] }> {
	const directory = await journalDirectory(override);
	const warnings: string[] = [],
		blockedPaths: string[] = [];
	const files = await fs.readdir(directory).catch((error: NodeJS.ErrnoException) => {
		if (error.code === "ENOENT") return [];
		throw error;
	});
	for (const name of files.filter((f) => f.endsWith(".json"))) {
		const file = path.join(directory, name);
		let j: Journal | undefined;
		try {
			j = validateJournal(JSON.parse(await fs.readFile(file, "utf8")), file);
			await reconcile(file, j);
		} catch (error) {
			warnings.push(`Project rename needs recovery: ${String(error)}`);
			if (j) blockedPaths.push(j.originalPath, j.destinationPath);
		}
	}
	return { warnings, blockedPaths };
}
