import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		isPackaged: false,
		getAppPath: () => os.tmpdir(),
		getPath: (name: string) => path.join(os.tmpdir(), name),
		setPath: () => undefined,
	},
}));

import { addTextOverlay, createTimelineProject } from "../../../src/core/timeline/commands";
import {
	inspectProjectBundle,
	isProjectBundle,
	packProjectWorkspace,
	readBundleThumbnailDataUrl,
	readProjectBundleEntry,
	unpackProjectBundle,
} from "./projectBundle";
import {
	convertProjectToBundleRelative,
	convertProjectToWorkspaceAbsolute,
} from "./projectWorkspace";
import { stageTimelineProject } from "./timelineBundle";

async function ensureAssetDir(workspace:string,id:string){const dir=path.join(workspace,"assets",id);await fs.mkdir(dir,{recursive:true});return dir;}

describe("Project Bundle (ZIP) & Asset Isolation", () => {
	let tempRoot: string;

	beforeEach(async () => {
		tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "captr-bundle-test-"));
	});

	afterEach(async () => {
		await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
	});

	it("reads a Story directly using its portable filename from the exact manifest path", async () => {
		const project = addTextOverlay(createTimelineProject("manifest", "Manifest"), 0, {
			clipId: "inline-title",
			trackId: "title-track",
		});
		const workspace = path.join(tempRoot, "workspace");
		await stageTimelineProject(project, workspace);
		const bundle = path.join(tempRoot, "manifest.captr");
		await packProjectWorkspace(workspace, bundle);
		const inspection = await inspectProjectBundle(bundle);
		expect(inspection.entries.some((e) => e.path === "Story/story-0.json")).toBe(true);
		expect(inspection.entries.some((e) => e.path === "Story/story-story-main.json")).toBe(false);
		const manifests = inspection.projectData!.storyManifest as Array<{ file: string }>;
		expect(manifests[0].file).toBe("Story/story-0.json");
		const entry = await readProjectBundleEntry(bundle, manifests[0].file);
		expect(entry.success).toBe(true);
		expect(
			JSON.parse(entry.content!).tracks.find((t: { id: string }) => t.id === "title-track")
				.clips[0].content.kind,
		).toBe("text");
		expect(inspection.entries.some((e) => e.path === "assets/inline-title/asset.json")).toBe(false);
	});

	it("identifies ZIP bundle vs non-ZIP file via magic bytes", async () => {
		const jsonFile = path.join(tempRoot, "plain.captr");
		await fs.writeFile(jsonFile, JSON.stringify({ version: 1 }), "utf-8");

		expect(await isProjectBundle(jsonFile)).toBe(false);

		// Create a real small zip archive
		const workspace = path.join(tempRoot, "workspace");
		await fs.mkdir(workspace, { recursive: true });
		await fs.writeFile(
			path.join(workspace, "project.json"),
			JSON.stringify({ version: 1 }),
			"utf-8",
		);

		const bundleFile = path.join(tempRoot, "packaged.captr");
		await packProjectWorkspace(workspace, bundleFile);

		expect(await isProjectBundle(bundleFile)).toBe(true);
	});

	it("packs workspace and unpacks with asset subdirectories intact", async () => {
		const workspace = path.join(tempRoot, "source-workspace");
		const slide1Dir = await ensureAssetDir(workspace, "slide-1");
		const slide2Dir = await ensureAssetDir(workspace, "slide-2");

		// Put slide 1 video & assets
		await fs.writeFile(path.join(slide1Dir, "main.mp4"), "fake-mp4-slide-1", "utf-8");
		await fs.mkdir(path.join(slide1Dir, "assets"), { recursive: true });
		await fs.writeFile(path.join(slide1Dir, "assets", "logo.png"), "fake-png-slide-1", "utf-8");

		// Put slide 2 video & assets
		await fs.writeFile(path.join(slide2Dir, "main.mp4"), "fake-mp4-slide-2", "utf-8");
		await fs.mkdir(path.join(slide2Dir, "assets"), { recursive: true });
		await fs.writeFile(
			path.join(slide2Dir, "assets", "broll.mp4"),
			"fake-broll-slide-2",
			"utf-8",
		);

		// Put project.json
		await fs.writeFile(
			path.join(workspace, "project.json"),
			JSON.stringify({
				version: 1,
				clips: [
					{ id: "slide-1", videoPath: "assets/slide-1/main.mp4" },
					{ id: "slide-2", videoPath: "assets/slide-2/main.mp4" },
				],
			}),
			"utf-8",
		);

		const captrFile = path.join(tempRoot, "my-project.captr");
		await packProjectWorkspace(workspace, captrFile);

		// Unpack to fresh workspace
		const unpackedWorkspace = path.join(tempRoot, "unpacked-workspace");
		await unpackProjectBundle(captrFile, unpackedWorkspace);

		// Verify slide 1 contents
		const s1Video = await fs.readFile(
			path.join(unpackedWorkspace, "assets", "slide-1", "main.mp4"),
			"utf-8",
		);
		expect(s1Video).toBe("fake-mp4-slide-1");
		const s1Asset = await fs.readFile(
			path.join(unpackedWorkspace, "assets", "slide-1", "assets", "logo.png"),
			"utf-8",
		);
		expect(s1Asset).toBe("fake-png-slide-1");

		// Verify slide 2 contents
		const s2Video = await fs.readFile(
			path.join(unpackedWorkspace, "assets", "slide-2", "main.mp4"),
			"utf-8",
		);
		expect(s2Video).toBe("fake-mp4-slide-2");
		const s2Asset = await fs.readFile(
			path.join(unpackedWorkspace, "assets", "slide-2", "assets", "broll.mp4"),
			"utf-8",
		);
		expect(s2Asset).toBe("fake-broll-slide-2");
	});

	it("converts paths between workspace absolute and bundle relative", () => {
		const workspace = "C:/Users/test/AppData/Captr Studio/workspaces/proj-1";

		const absoluteProject = {
			videoPath:
				"C:/Users/test/AppData/Captr Studio/workspaces/proj-1/slides/slide-1/main.mp4",
			clips: [
				{
					id: "slide-1",
					videoPath:
						"C:/Users/test/AppData/Captr Studio/workspaces/proj-1/slides/slide-1/main.mp4",
					assetFiles: [
						{
							id: "a1",
							path: "C:/Users/test/AppData/Captr Studio/workspaces/proj-1/slides/slide-1/assets/logo.png",
						},
					],
				},
			],
		};

		const relative = convertProjectToBundleRelative(absoluteProject, workspace);
		expect(relative.videoPath).toBe("slides/slide-1/main.mp4");
		expect(relative.clips[0].videoPath).toBe("slides/slide-1/main.mp4");
		expect(relative.clips[0].assetFiles[0].path).toBe("slides/slide-1/assets/logo.png");

		const restored = convertProjectToWorkspaceAbsolute(relative, workspace);
		expect(restored.videoPath.toLowerCase()).toBe(
			path.resolve(absoluteProject.videoPath).toLowerCase(),
		);
		expect(restored.clips[0].videoPath.toLowerCase()).toBe(
			path.resolve(absoluteProject.clips[0].videoPath).toLowerCase(),
		);
		expect(restored.clips[0].assetFiles[0].path.toLowerCase()).toBe(
			path.resolve(absoluteProject.clips[0].assetFiles[0].path).toLowerCase(),
		);
	});

	it("inspects ZIP bundle returning projectData, thumbnail, and categorized slide entries without full extraction", async () => {
		const workspace = path.join(tempRoot, "inspect-workspace");
		const slideDir = await ensureAssetDir(workspace, "slide-intro");
		await fs.writeFile(path.join(slideDir, "clip.mp4"), "fake-video-bytes", "utf-8");
		await fs.mkdir(path.join(slideDir, "assets", "audio"), { recursive: true });
		await fs.writeFile(
			path.join(slideDir, "assets", "audio", "voiceover.mp3"),
			"fake-audio-bytes",
			"utf-8",
		);

		// Project JSON & Thumbnail
		const dummyProject = {
			projectName: "Awesome Video",
			aspectRatio: "16:9",
			duration: 15.5,
			clips: [{ id: "slide-intro", duration: 15.5 }],
		};
		await fs.writeFile(
			path.join(workspace, "project.json"),
			JSON.stringify(dummyProject),
			"utf-8",
		);
		await fs.writeFile(
			path.join(workspace, "thumbnail.png"),
			Buffer.from("fake-png-thumbnail"),
		);

		const captrFile = path.join(tempRoot, "inspected.captr");
		await packProjectWorkspace(workspace, captrFile);

		const inspection = await inspectProjectBundle(captrFile);
		expect(inspection.success).toBe(true);
		expect(inspection.isBundle).toBe(true);
		expect(inspection.fileName).toBe("inspected.captr");
		expect(inspection.fileSize).toBeGreaterThan(0);
		expect(inspection.projectData).toEqual(dummyProject);
		expect(inspection.thumbnailDataUrl).toContain("data:image/png;base64,");

		// Check entries breakdown
		const videoEntry = inspection.entries.find((e) => e.category === "video");
		expect(videoEntry).toBeDefined();
		expect(videoEntry?.assetId).toBe("slide-intro");
		expect(videoEntry?.path).toBe("assets/slide-intro/clip.mp4");

		const audioEntry = inspection.entries.find((e) => e.category === "audio");
		expect(audioEntry).toBeDefined();
		expect(audioEntry?.assetId).toBe("slide-intro");

		const configEntry = inspection.entries.find((e) => e.category === "config");
		expect(configEntry).toBeDefined();
		expect(configEntry?.path).toBe("project.json");
	});
	it("failed atomic installation preserves existing bytes and removes staging output",async()=>{
		const workspace=path.join(tempRoot,"atomic");await fs.mkdir(workspace);await fs.writeFile(path.join(workspace,"project.json"),"{}");const target=path.join(tempRoot,"existing.captr");await fs.writeFile(target,"original");const rename=vi.spyOn(fs,"rename").mockRejectedValueOnce(new Error("destination locked"));
		try{await expect(packProjectWorkspace(workspace,target)).rejects.toThrow("destination locked");expect(await fs.readFile(target,"utf8")).toBe("original");expect((await fs.readdir(tempRoot)).filter(p=>p.includes(".tmp-"))).toEqual([]);}finally{rename.mockRestore();}
	});

	it("rejects legacy plain JSON project file with a clear error", async () => {
		const jsonFile = path.join(tempRoot, "legacy-proj.captr");
		const legacyProject = {
			projectName: "Legacy Project",
			aspectRatio: "9:16",
			clips: [{ id: "s1" }],
		};
		await fs.writeFile(jsonFile, JSON.stringify(legacyProject), "utf-8");

		const inspection = await inspectProjectBundle(jsonFile);
		expect(inspection.success).toBe(false);
		expect(inspection.isBundle).toBe(false);
		expect(inspection.error).toContain("old .captr format");
	});

	it("reads the embedded thumbnail as a data URL without a loose sidecar file", async () => {
		const workspace = path.join(tempRoot, "thumb-workspace");
		await fs.mkdir(workspace, { recursive: true });
		await fs.writeFile(
			path.join(workspace, "project.json"),
			JSON.stringify({ version: 1 }),
			"utf-8",
		);
		const pngBytes = Buffer.from("fake-png-thumbnail");
		await fs.writeFile(path.join(workspace, "thumbnail.png"), pngBytes);

		const captrFile = path.join(tempRoot, "with-thumb.captr");
		await packProjectWorkspace(workspace, captrFile);

		const dataUrl = await readBundleThumbnailDataUrl(captrFile);
		expect(dataUrl).toBe(`data:image/png;base64,${pngBytes.toString("base64")}`);

		// No loose .preview.png sidecar is involved or required.
		await expect(fs.access(`${captrFile}.preview.png`)).rejects.toThrow();
	});

	it("returns null when the bundle has no embedded thumbnail", async () => {
		const workspace = path.join(tempRoot, "no-thumb-workspace");
		await fs.mkdir(workspace, { recursive: true });
		await fs.writeFile(
			path.join(workspace, "project.json"),
			JSON.stringify({ version: 1 }),
			"utf-8",
		);

		const captrFile = path.join(tempRoot, "no-thumb.captr");
		await packProjectWorkspace(workspace, captrFile);

		await expect(readBundleThumbnailDataUrl(captrFile)).resolves.toBeNull();
	});

	it("reads individual entries directly without extraction via readProjectBundleEntry", async () => {
		const workspace = path.join(tempRoot, "entry-read-workspace");
		await fs.mkdir(path.join(workspace, "story"), { recursive: true });
		await fs.mkdir(path.join(workspace, "hyperframe"), { recursive: true });

		const storyJson = JSON.stringify({ storyName: "Intro Sequence", durationMs: 4000 });
		await fs.writeFile(path.join(workspace, "story", "story-1.json"), storyJson, "utf-8");

		const hyperHtml = "<html><body><h1>Hyperframe Title</h1></body></html>";
		await fs.writeFile(path.join(workspace, "hyperframe", "intro.html"), hyperHtml, "utf-8");

		const captrFile = path.join(tempRoot, "entry-read.captr");
		await packProjectWorkspace(workspace, captrFile);

		// Read text entry (story-1.json)
		const storyResult = await readProjectBundleEntry(captrFile, "story/story-1.json");
		expect(storyResult.success).toBe(true);
		expect(storyResult.content).toBe(storyJson);

		// Read html entry (intro.html)
		const htmlResult = await readProjectBundleEntry(captrFile, "hyperframe/intro.html");
		expect(htmlResult.success).toBe(true);
		expect(htmlResult.content).toBe(hyperHtml);

		// Non-existent entry
		const missingResult = await readProjectBundleEntry(captrFile, "non-existent.txt");
		expect(missingResult.success).toBe(false);
		expect(missingResult.error).toContain("not found");
	});
});
