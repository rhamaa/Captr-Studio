import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
	extractStoriesFromProject,
	generateStoryManifest,
	storyProjectionFileName,
} from "../../../src/core/story/storyUtils";
import {
	timelineMediaAssets,
	visitTimelineMediaPaths,
} from "../../../src/core/timeline/mediaPaths";
import { normalizeStoryOwnership } from "../../../src/core/timeline/normalizeStoryOwnership";
import { refreshStoryProjections } from "../../../src/core/timeline/storyOwnership";
import type { TimelineProject } from "../../../src/core/timeline/types";
import {
	assertSafeMediaPath,
	validateTimelineProject,
} from "../../../src/core/timeline/validation";
import { getAssetRootPath } from "./assetPaths";

function safeId(id: string) {
	if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Unsafe asset ID");
	return id;
}
function relativePath(p: string) {
	assertSafeMediaPath(p);
	if (path.isAbsolute(p) || /^[a-z]:/i.test(p) || p.startsWith("\\"))
		throw new Error("Bundle media path must be relative");
	return p;
}
export async function stageTimelineProject(
	project: TimelineProject,
	workspaceDir: string,
): Promise<TimelineProject> {
	const canonical = normalizeStoryOwnership(project),
		staged = structuredClone(canonical),
		requests: Array<{ original: string; set: (p: string) => void; owner: string }> = [];
	visitTimelineMediaPaths(staged, (original, set, owner) =>
		requests.push({ original, set, owner }),
	);
	const copies = new Map<string, string>(),
		resolvedSources = new Map<string, string>();
	await fs.mkdir(workspaceDir, { recursive: true });
	for (const request of requests) {
		const owner = safeId(request.owner),
			key = `${owner}\0${request.original}`;
		let relative = copies.get(key);
		if (!relative) {
			let source: string;
			const cleanOriginal = request.original.split(/[?#]/)[0] ?? request.original;
			const normalizedOriginal = cleanOriginal.replace(/^\/+/, "");
			if (/^(wallpapers|app-icons)\//i.test(normalizedOriginal)) {
				const candidate = path.join(getAssetRootPath(), normalizedOriginal);
				if (existsSync(candidate)) {
					source = candidate;
				} else {
					const cwdCandidate = path.join(process.cwd(), "public", normalizedOriginal);
					if (existsSync(cwdCandidate)) {
						source = cwdCandidate;
					} else {
						continue;
					}
				}
			} else if (path.isAbsolute(cleanOriginal)) {
				source = cleanOriginal;
			} else {
				source = path.resolve(workspaceDir, relativePath(cleanOriginal));
			}
			const real = await fs.realpath(source);
			const stat = await fs.stat(real);
			if (!stat.isFile()) throw new Error(`Asset source is not a file: ${request.original}`);
			const basename = path.basename(real).replace(/[^a-zA-Z0-9_.-]/g, "_") || "media";
			relative = `assets/${owner}/${copies.size}-${basename}`;
			const target = path.join(workspaceDir, relative);
			await fs.mkdir(path.dirname(target), { recursive: true });
			if (path.resolve(real) !== path.resolve(target)) await fs.copyFile(real, target);
			copies.set(key, relative);
			resolvedSources.set(key, real);
		}
		request.set(relative);
	}
	const originalAssets = new Map(
		timelineMediaAssets(canonical).map((asset) => [asset.id, asset]),
	);
	for (const asset of timelineMediaAssets(staged)) {
		const dir = path.join(workspaceDir, "assets", safeId(asset.id));
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(path.join(dir, "asset.json"), JSON.stringify(asset, null, 2));
		const pkg = staged.packages.find((r) => r.id === asset.packageId);
		if (pkg) await fs.writeFile(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2));
		const origAsset = originalAssets.get(asset.id);
		const origPkg = canonical.packages.find((p) => p.id === asset.packageId);
		const mediaSourceCandidate = origAsset?.source?.path ?? origPkg?.screen?.path;
		if (mediaSourceCandidate) {
			const resolvedSource = resolvedSources.get(`${asset.id}\0${mediaSourceCandidate}`);
			const sourceAssetDir = path.dirname(
				resolvedSource ?? path.resolve(workspaceDir, mediaSourceCandidate),
			);
			for (const sidecar of ["transcript.json", "captions.vtt"]) {
				const srcFile = path.join(sourceAssetDir, sidecar);
				const dstFile = path.join(dir, sidecar);
				if (existsSync(srcFile) && path.resolve(srcFile) !== path.resolve(dstFile)) {
					await fs.copyFile(srcFile, dstFile);
				}
			}
		}
	}
	await fs.mkdir(path.join(workspaceDir, "compositions"), { recursive: true });
	for (const c of staged.compositions)
		await fs.writeFile(
			path.join(workspaceDir, "compositions", `${safeId(c.id)}.json`),
			JSON.stringify(c, null, 2),
		);

	// Stage modular Story sub-projects
	const stories = extractStoriesFromProject(staged);
	const storyDir = path.join(workspaceDir, "Story");
	await fs.mkdir(storyDir, { recursive: true });
	for (const story of stories) {
		const storyFileName = storyProjectionFileName(story.id);
		await fs.writeFile(path.join(storyDir, storyFileName), JSON.stringify(story, null, 2));
	}
	staged.stories = stories;
	staged.storyManifest = generateStoryManifest(stories);

	// Stage code-driven Hyperframe compositions
	if (staged.hyperframes && staged.hyperframes.length > 0) {
		const hfDir = path.join(workspaceDir, "hyperframe");
		await fs.mkdir(hfDir, { recursive: true });
		for (const hf of staged.hyperframes) {
			const hfFileName = `hyperframe-${safeId(hf.id)}.html`;
			const targetHtml = path.join(hfDir, hfFileName);
			if (hf.htmlContent) {
				await fs.writeFile(targetHtml, hf.htmlContent, "utf8");
			} else if (hf.entryHtml) {
				const candidate = path.isAbsolute(hf.entryHtml)
					? hf.entryHtml
					: path.resolve(workspaceDir, hf.entryHtml);
				if (existsSync(candidate) && path.resolve(candidate) !== path.resolve(targetHtml)) {
					await fs.copyFile(candidate, targetHtml);
				}
			}
			hf.entryHtml = `hyperframe/${hfFileName}`;

			if (hf.specJson) {
				const specFileName = `hyperframe-${safeId(hf.id)}.json`;
				const targetSpec = path.join(hfDir, specFileName);
				const candidate = path.isAbsolute(hf.specJson)
					? hf.specJson
					: path.resolve(workspaceDir, hf.specJson);
				if (existsSync(candidate) && path.resolve(candidate) !== path.resolve(targetSpec)) {
					await fs.copyFile(candidate, targetSpec);
				}
				hf.specJson = `hyperframe/${specFileName}`;
			}
		}
	}

	validateTimelineProject(staged);
	await fs.writeFile(path.join(workspaceDir, "project.json"), JSON.stringify(staged, null, 2));
	return staged;
}
export function resolveTimelineProject(
	project: TimelineProject,
	workspaceDir: string,
): TimelineProject {
	const result = normalizeStoryOwnership(project);
	visitTimelineMediaPaths(result, (p, set) => {
		relativePath(p);
		const resolved = path.resolve(workspaceDir, p);
		const relative = path.relative(workspaceDir, resolved);
		if (relative.startsWith("..") || path.isAbsolute(relative))
			throw new Error("Media path escapes bundle");
		set(resolved.replace(/\\/g, "/"));
	});
	if (result.hyperframes) {
		for (const hf of result.hyperframes) {
			if (hf.entryHtml && !path.isAbsolute(hf.entryHtml)) {
				hf.entryHtml = path.resolve(workspaceDir, hf.entryHtml).replace(/\\/g, "/");
			}
		}
	}
	return validateTimelineProject(refreshStoryProjections(result));
}
