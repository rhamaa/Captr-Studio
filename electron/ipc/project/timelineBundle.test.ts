import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { addClipTransition, setComponentAnimation } from "../../../src/core/timeline/clipTransitions";
import { addTextOverlay, createTimelineProject, placeAsset, registerMedia, registerRecording } from "../../../src/core/timeline/commands";
import { timelineMediaPaths } from "../../../src/core/timeline/mediaPaths";
import { normalizeStoryOwnership } from "../../../src/core/timeline/normalizeStoryOwnership";
import { createAndPlaceShape, setShapeStyleOverride } from "../../../src/core/timeline/shapeCommands";
import { fixtureClip, fixtureText, ownershipFixture } from "../../../src/core/timeline/storyOwnership.fixtures";
import type { ShapeDefinition } from "../../../src/core/timeline/types";
import { inspectProjectBundle, packProjectWorkspace, readProjectBundleEntry, unpackProjectBundle } from "./projectBundle";
import { resolveTimelineProject, stageTimelineProject } from "./timelineBundle";

const roots:string[]=[];afterEach(async()=>{for(const r of roots.splice(0))await fs.rm(r,{recursive:true,force:true});});
it.each([
	["foo", "story-foo", "Story/story-0.json", "Story/story-1.json"],
	["Foo", "foo", "Story/story-0.json", "Story/story-1.json"],
	["CON", "con", "Story/story-0.json", "Story/story-1.json"],
])("bundles distinct Story IDs %s and %s without replacing either owner's projection", async (rootId, artboardStoryId, rootFile, artboardFile) => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-story-filename-"));
	roots.push(root);
	const project = createTimelineProject("story-filenames", "Story filenames");
	project.defaultStoryId = rootId;
	project.repurposeBoard = {
		artboards: [
			{
				id: "bar",
				name: "Artboard",
				storyMetadata: { id: artboardStoryId },
				aspectRatio: "16:9",
				width: 1920,
				height: 1080,
				framing: { scale: 1, offsetX: 0, offsetY: 0, fitMode: "contain" },
				tracks: [],
			},
		],
		slices: [],
		activeSliceId: null,
	};
	const staged = await stageTimelineProject(project, path.join(root, "staged"));
	const bundle = path.join(root, "distinct.captr");
	await packProjectWorkspace(path.join(root, "staged"), bundle);
	for (const [id, ownerId, name, tracks] of [
		[rootId, undefined, "Main Video", project.tracks],
		[artboardStoryId, "bar", "Artboard", []],
	] as const) {
		const manifest = staged.storyManifest!.find((entry) => entry.id === id)!;
		const saved = await readProjectBundleEntry(bundle, manifest.file);
		expect(saved.success).toBe(true);
		const story = JSON.parse(saved.content!);
		expect(story.id).toBe(id);
		expect(story.artboardId).toBe(ownerId);
		expect(story.name).toBe(name);
		expect(story.tracks).toEqual(tracks);
	}
	expect(staged.storyManifest!.map((entry) => entry.file)).toEqual([rootFile, artboardFile]);
	const bundleEntries = (await inspectProjectBundle(bundle)).entries.map((entry) => entry.path);
	expect(bundleEntries).toContain(rootFile);
	expect(bundleEntries).toContain(artboardFile);
	expect(new Set(staged.storyManifest!.map((entry) => entry.file.toLowerCase())).size).toBe(2);
});

it("saves legacy Story IDs of 123 and 1024 ASCII characters with bounded projection paths", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-long-story-id-"));
	roots.push(root);
	const project = createTimelineProject("long-story-identities", "Long identities");
	project.defaultStoryId = "a".repeat(123);
	project.repurposeBoard = {
		artboards: [
			{
				id: "long-owner",
				name: "Long Story",
				storyMetadata: { id: "b".repeat(1024) },
				aspectRatio: "16:9",
				width: 1920,
				height: 1080,
				framing: { scale: 1, offsetX: 0, offsetY: 0, fitMode: "contain" },
				tracks: [],
			},
		],
		slices: [],
		activeSliceId: null,
	};
	const staged = await stageTimelineProject(project, path.join(root, "stage"));
	const bundle = path.join(root, "long-identities.captr");
	await packProjectWorkspace(path.join(root, "stage"), bundle);
	expect(staged.defaultStoryId).toBe(project.defaultStoryId);
	expect(staged.storyManifest!.map((entry) => entry.file)).toEqual([
		"Story/story-0.json",
		"Story/story-1.json",
	]);
	for (const [index, manifest] of staged.storyManifest!.entries()) {
		expect(path.basename(manifest.file).length).toBeLessThanOrEqual(255);
		const entry = await readProjectBundleEntry(bundle, manifest.file);
		expect(entry.success).toBe(true);
		const story = JSON.parse(entry.content!);
		expect(story.id).toBe(index === 0 ? "a".repeat(123) : "b".repeat(1024));
		expect(story.artboardId).toBe(index === 0 ? undefined : "long-owner");
		expect(story.tracks).toEqual(index === 0 ? project.tracks : []);
	}
	const reopenedDir = path.join(root, "reopened");
	await unpackProjectBundle(bundle, reopenedDir);
	const reopened = resolveTimelineProject(
		JSON.parse(await fs.readFile(path.join(reopenedDir, "project.json"), "utf8")),
		reopenedDir,
	);
	expect(reopened.defaultStoryId).toBe("a".repeat(123));
	expect(reopened.stories!.map((story) => story.id)).toEqual(["a".repeat(123), "b".repeat(1024)]);
	expect(reopened.repurposeBoard!.artboards[0].storyMetadata!.id).toBe("b".repeat(1024));
});

it("round trips every canonical media library, sidecars and current Story projections", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-private-roundtrip-"));
	roots.push(root);
	let project = ownershipFixture();
	const owner = project.repurposeBoard!.artboards[0];
	owner.tracks = [];
	owner.subtitles = { enabled: true, style: "classic", fontSize: 28 };
	owner.localAssets!.push({
		id: "video-A",
		kind: "video",
		name: "Private B-roll",
		width: 1920,
		height: 1080,
		durationUs: 5_000_000,
		source: { path: "private.mp4", durationUs: 5_000_000, offsetUs: 0 },
	});
	project.localAssets = [
		{
			...owner.localAssets![0],
			id: "voice-root",
			source: { ...owner.localAssets![0].source!, path: "root.wav" },
		},
	];
	project.tracks[0].clips.push(
		fixtureClip("inline-title", {
			startUs: 5_000_000,
			content: { kind: "text", text: fixtureText, durationUs: 5_000_000 },
		}),
	);
	project.designTemplates = [
		{
			id: "preset",
			name: "Title preset",
			kind: "text",
			content: { kind: "text", text: fixtureText, durationUs: 5_000_000 },
			width: 1920,
			height: 1080,
			defaultDurationUs: 5_000_000,
		},
	];
	for (const asset of [...project.assets, ...project.localAssets, ...owner.localAssets!]) {
		const dir = path.join(root, asset.id);
		await fs.mkdir(dir);
		if (asset.source) {
			asset.source.path = path.join(dir, path.basename(asset.source.path));
			await fs.writeFile(asset.source.path, asset.id);
		}
	}
	project.packages[0].screen.path = path.join(root, "record", "screen.mp4");
	await fs.writeFile(project.packages[0].screen.path, "screen");
	await fs.writeFile(path.join(root, "voice-A", "transcript.json"), '{"segments":[]}');
	await fs.writeFile(path.join(root, "voice-A", "captions.vtt"), "WEBVTT\n\nPrivate captions");
	project = normalizeStoryOwnership(project);
	// Old projections deliberately disagree with the authoritative owners.
	project.stories!.find((s) => s.artboardId === "A")!.tracks = [
		structuredClone(project.tracks[0]),
	];
	const staged = await stageTimelineProject(project, path.join(root, "stage"));
	const bundle = path.join(root, "all.captr");
	await packProjectWorkspace(path.join(root, "stage"), bundle);
	const bundleEntries = (await inspectProjectBundle(bundle)).entries.map((e) => e.path);
	expect(bundleEntries).toContain("assets/voice-A/asset.json");
	expect(bundleEntries).toContain("assets/voice-A/transcript.json");
	expect(bundleEntries).toContain("assets/voice-A/captions.vtt");
	expect(bundleEntries.some((p) => p.startsWith("slides/"))).toBe(false);
	expect(bundleEntries.some((p) => p === "assets/inline-title/asset.json")).toBe(false);
	for (const manifest of staged.storyManifest!) expect(bundleEntries).toContain(manifest.file);
	expect(bundleEntries).toContain("Story/story-1.json");
	expect(bundleEntries).not.toContain("Story/story-story-A.json");
	expect(timelineMediaPaths(staged)).toHaveLength(5);
	const savedStory = staged.stories!.find((s) => s.artboardId === "A")!;
	expect(savedStory.tracks).toEqual(staged.repurposeBoard!.artboards[0].tracks);
	expect(savedStory.localAssets![0].source!.path).toMatch(/^assets\/voice-A\//);
	const extracted = path.join(root, "reopen");
	await unpackProjectBundle(bundle, extracted);
	const reopened = resolveTimelineProject(
		JSON.parse(await fs.readFile(path.join(extracted, "project.json"), "utf8")),
		extracted,
	);
	const reopenedArtboard = reopened.repurposeBoard!.artboards[0];
	expect(reopenedArtboard.localAssets?.length).toBe(2);
	expect(await fs.readFile(reopenedArtboard.localAssets![0].source!.path, "utf8")).toBe(
		"voice-A",
	);
	expect(reopened.stories!.find((s) => s.artboardId === "A")!.localAssets).toEqual(
		reopenedArtboard.localAssets,
	);
	expect(reopenedArtboard.subtitles).toEqual(owner.subtitles);
	expect(reopened.designTemplates).toEqual(project.designTemplates);
	expect(reopened.compositions).toEqual(project.compositions);
	reopened.repurposeBoard!.artboards[1].tracks = [];
	const savedAgain = await stageTimelineProject(reopened, path.join(root, "again"));
	expect(savedAgain.stories!.find((s) => s.artboardId === "B")!.tracks).toEqual([]);
});

it("bundles unused recording assets with every sidecar and no Slide folders",async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"captr-timeline-"));roots.push(root);const sources=path.join(root,"sources");await fs.mkdir(sources);
 for(const name of ["screen.mp4","camera.mp4","mic.wav","system.wav","cursor.json"])await fs.writeFile(path.join(sources,name),name);
 const src=(name:string)=>({path:path.join(sources,name),durationUs:20_000_000,offsetUs:0});
 const p=registerRecording(createTimelineProject("p","Library only"),{captureId:"take",name:"Take",durationUs:20_000_000,width:1920,height:1080,screen:src("screen.mp4"),webcam:src("camera.mp4"),microphone:src("mic.wav"),system:src("system.wav"),cursorPath:path.join(sources,"cursor.json"),settings:{}},{assetId:"a",packageId:"r"});
 const workspace=path.join(root,"workspace"),staged=await stageTimelineProject(p,workspace);
 expect(staged.packages[0].screen.path).toMatch(/^assets\/a\//);expect(staged.tracks.flatMap(t=>t.clips)).toEqual([]);
 expect(await fs.readdir(workspace)).not.toContain("slides");expect(JSON.parse(await fs.readFile(path.join(workspace,"project.json"),"utf8"))).not.toHaveProperty("slides");
 const bundle=path.join(root,"project.captr");await packProjectWorkspace(workspace,bundle);const loaded=path.join(root,"loaded");await unpackProjectBundle(bundle,loaded);
 const reopened=resolveTimelineProject(JSON.parse(await fs.readFile(path.join(loaded,"project.json"),"utf8")),loaded);
 expect(await fs.readFile(reopened.packages[0].microphone!.path,"utf8")).toBe("mic.wav");expect(await fs.readFile(reopened.packages[0].cursorPath!,"utf8")).toBe("cursor.json");
 const one=placeAsset(p,"a","visual-1",0,{clipId:"c",compositionId:"e"}),two=placeAsset(one,"a","visual-1",20_000_000,{clipId:"c2",compositionId:"e2"});
 await stageTimelineProject(two,path.join(root,"second"));expect((await fs.readdir(path.join(root,"second","assets","a"))).filter(f=>f.endsWith(".mp4"))).toHaveLength(2);
 expect(()=>resolveTimelineProject({...staged,packages:[{...staged.packages[0],screen:{...staged.packages[0].screen,path:"../escape.mp4"}}]},loaded)).toThrow(/path/i);
});
it("saves and reopens text overlays as project data without staging fake media",async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"captr-text-"));roots.push(root);
 const project=addTextOverlay(createTimelineProject("text-project","Text project"),1_000_000,{assetId:"title",trackId:"title-track",clipId:"title-clip"});
 const workspace=path.join(root,"workspace"),staged=await stageTimelineProject(project,workspace);
 expect(staged.assets).toEqual([]);
 expect(staged.tracks.find(t=>t.id==="title-track")?.clips[0].content?.kind).toBe("text");
 await expect(fs.access(path.join(workspace,"assets","title"))).rejects.toThrow();
 const bundle=path.join(root,"text.captr"),loaded=path.join(root,"loaded");
 await packProjectWorkspace(workspace,bundle);await unpackProjectBundle(bundle,loaded);
 const reopened=resolveTimelineProject(JSON.parse(await fs.readFile(path.join(loaded,"project.json"),"utf8")),loaded);
 expect(reopened.tracks.find(t=>t.id==="title-track")?.clips[0].content).toMatchObject({kind:"text",text:{content:"Your text"}});
});
it("stages an unplaced voiceover Asset and reopens it alongside a placed audio clip", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-voiceover-bundle-"));
	roots.push(root);
	const sourceDir = path.join(root, "sources");
	await fs.mkdir(sourceDir);
	const unplacedSource = path.join(sourceDir, "unplaced-voiceover.webm");
	const placedSource = path.join(sourceDir, "placed-voiceover.webm");
	await fs.writeFile(unplacedSource, "unplaced voice bytes");
	await fs.writeFile(placedSource, "placed voice bytes");
	let project = createTimelineProject("voiceover-project", "Narration project");
	project = registerMedia(project, {
		id: "voice-unplaced",
		kind: "audio",
		name: "Unplaced voiceover",
		durationUs: 2_500_000,
		width: 0,
		height: 0,
		source: { path: unplacedSource, durationUs: 2_500_000, offsetUs: 0 },
	});
	project = registerMedia(project, {
		id: "voice-placed",
		kind: "audio",
		name: "Placed voiceover",
		durationUs: 3_000_000,
		width: 0,
		height: 0,
		source: { path: placedSource, durationUs: 3_000_000, offsetUs: 0 },
	});
	project = placeAsset(project, "voice-placed", "audio-1", 4_000_000, { clipId: "voice-clip" });
	const workspace = path.join(root, "workspace");
	const staged = await stageTimelineProject(project, workspace);
	expect(staged.assets.find((asset) => asset.id === "voice-unplaced")?.source?.path).toMatch(
		/^assets\/voice-unplaced\//,
	);
	expect(staged.tracks.find((track) => track.id === "audio-1")?.clips.map((clip) => clip.assetId)).toEqual([
		"voice-placed",
	]);
	const bundle = path.join(root, "voiceover.captr");
	const unpacked = path.join(root, "unpacked");
	await packProjectWorkspace(workspace, bundle);
	await unpackProjectBundle(bundle, unpacked);
	const reopened = resolveTimelineProject(
		JSON.parse(await fs.readFile(path.join(unpacked, "project.json"), "utf8")),
		unpacked,
	);
	const unplaced = reopened.assets.find((asset) => asset.id === "voice-unplaced");
	const placed = reopened.assets.find((asset) => asset.id === "voice-placed");
	expect(unplaced?.source).toBeDefined();
	expect(placed?.source).toBeDefined();
	expect(reopened.tracks.flatMap((track) => track.clips).map((clip) => clip.assetId)).toEqual([
		"voice-placed",
	]);
	expect(await fs.readFile(unplaced!.source!.path, "utf8")).toBe("unplaced voice bytes");
	expect(await fs.readFile(placed!.source!.path, "utf8")).toBe("placed voice bytes");
});

it("timelineBundle_roundTripsClipTransitionAndComponentAnimations", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-transition-roundtrip-"));
	roots.push(root);
	let project = createTimelineProject("transition-roundtrip", "Transitions");
	for (const id of ["outgoing", "incoming"]) {
		const sourcePath = path.join(root, `${id}.mp4`);
		await fs.writeFile(sourcePath, `${id} media`);
		project = registerMedia(project, {
			id,
			kind: "video",
			name: id,
			durationUs: 8_000_000,
			width: 1920,
			height: 1080,
			source: { path: sourcePath, durationUs: 8_000_000, offsetUs: 0 },
		});
	}
	project = placeAsset(project, "outgoing", "visual-1", 0, { clipId: "out" });
	project = placeAsset(project, "incoming", "visual-1", 8_000_000, { clipId: "in" });
	project.tracks[0]!.clips[0]!.sourceOutUs = 6_000_000;
	project.tracks[0]!.clips[1]!.sourceInUs = 2_000_000;
	project.tracks[0]!.clips[1]!.startUs = 6_000_000;
	project = setComponentAnimation(project, "in", "enter", {
		preset: "slide",
		direction: "left",
		durationUs: 400_000,
		easing: "ease-out",
	});
	project = addClipTransition(
		project,
		{
			trackId: "visual-1",
			fromClipId: "out",
			toClipId: "in",
			preset: { kind: "wipe", direction: "right" },
			easing: "ease-in-out",
		},
		"transition",
	);

	const workspace = path.join(root, "workspace"),
		staged = await stageTimelineProject(project, workspace),
		bundle = path.join(root, "transition.captr"),
		loaded = path.join(root, "loaded");
	await packProjectWorkspace(workspace, bundle);
	await unpackProjectBundle(bundle, loaded);
	const reopened = resolveTimelineProject(
		JSON.parse(await fs.readFile(path.join(loaded, "project.json"), "utf8")),
		loaded,
	);
	expect(staged.clipTransitions).toEqual(project.clipTransitions);
	expect(reopened.clipTransitions).toEqual(project.clipTransitions);
	expect(reopened.tracks[0]!.clips.find((clip) => clip.id === "in")?.componentAnimation)
		.toEqual(project.tracks[0]!.clips.find((clip) => clip.id === "in")?.componentAnimation);
	expect(await fs.readFile(reopened.assets.find((asset) => asset.id === "outgoing")!.source!.path, "utf8"))
		.toBe("outgoing media");
});

it("timelineBundle_roundTripsInlineShapeAndPlacementOverride", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-shape-roundtrip-"));
	roots.push(root);
	const rectangle: ShapeDefinition = {
		kind: "rectangle",
		width: 320,
		height: 180,
		style: { fill: "#ffffff", stroke: { color: "#111111", width: 2 } },
	};
	let project = createAndPlaceShape(createTimelineProject("shape-roundtrip", "Shapes"), rectangle, 0, {
		assetId: "shape",
		clipId: "shape-clip",
		trackId: "shape-track",
	});
	project = setShapeStyleOverride(project, "shape-clip", {
		fill: "#abcdef",
		stroke: { color: "#123456", width: 1.5 },
	});
	project.clipTransitions = [];
	const workspace = path.join(root, "workspace"),
		staged = await stageTimelineProject(project, workspace);
	await expect(fs.access(path.join(workspace, "assets", "shape"))).rejects.toThrow();
	expect(staged.assets).toEqual([]);
	expect(staged.tracks[0]!.clips[0]!.content).toMatchObject({kind:"shape",shapeDefinition:rectangle});

	const bundle = path.join(root, "shape.captr"), loaded = path.join(root, "loaded");
	await packProjectWorkspace(workspace, bundle);
	await unpackProjectBundle(bundle, loaded);
	const reopened = resolveTimelineProject(
		JSON.parse(await fs.readFile(path.join(loaded, "project.json"), "utf8")),
		loaded,
	);
	expect(reopened.tracks[0]!.clips[0]!.content).toMatchObject({kind:"shape",shapeDefinition:rectangle});
	expect(reopened.tracks[0]!.clips[0]!.shapeStyleOverride).toEqual({
		fill: "#abcdef",
		stroke: { color: "#123456", width: 1.5 },
	});
	expect(reopened.assets).toEqual([]);
});

it("timelineBundle_loadsOldV3WithoutVisualEffectFields", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-old-v3-"));
	roots.push(root);
	const workspace = path.join(root, "workspace");
	await stageTimelineProject(createTimelineProject("old-v3", "Old V3"), workspace);
	const legacy = JSON.parse(await fs.readFile(path.join(workspace, "project.json"), "utf8"));
	delete legacy.clipTransitions;
	delete legacy.localAssets;
	delete legacy.stories;
	delete legacy.storyManifest;
	await fs.writeFile(path.join(workspace, "project.json"), JSON.stringify(legacy));
	const bundle = path.join(root, "old.captr"), loaded = path.join(root, "loaded");
	await packProjectWorkspace(workspace, bundle);
	await unpackProjectBundle(bundle, loaded);
	const reopened = resolveTimelineProject(
		JSON.parse(await fs.readFile(path.join(loaded, "project.json"), "utf8")),
		loaded,
	);
	expect(reopened.version).toBe(3);
	expect(reopened.clipTransitions).toEqual([]);
});

it("timelineBundle_bundlesAndPreservesTranscriptSidecars", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-transcript-bundle-"));
	roots.push(root);
	const sources = path.join(root, "sources");
	await fs.mkdir(sources);
	await fs.writeFile(path.join(sources, "video.mp4"), "fake-video-bytes");
	await fs.writeFile(path.join(sources, "transcript.json"), JSON.stringify({ projectId: "proj-transcript", assetId: "v1", segments: [] }));
	await fs.writeFile(path.join(sources, "captions.vtt"), "WEBVTT\n\n00:00.000 --> 00:01.000\nHello");

	const project = registerMedia(
		createTimelineProject("proj-transcript", "Caption Test"),
		{
			id: "v1",
			kind: "video",
			name: "video.mp4",
			durationUs: 5_000_000,
			width: 1920,
			height: 1080,
			source: { path: path.join(sources, "video.mp4"), durationUs: 5_000_000, offsetUs: 0 },
		},
	);

	const workspace = path.join(root, "workspace");
	await stageTimelineProject(project, workspace);

	// Verify transcript and captions were bundled into assets/v1/
	expect(await fs.readFile(path.join(workspace, "assets", "v1", "transcript.json"), "utf8")).toContain('"proj-transcript"');
	expect(await fs.readFile(path.join(workspace, "assets", "v1", "captions.vtt"), "utf8")).toContain("WEBVTT");

	// Pack to .captr and unpack to verify preservation
	const bundle = path.join(root, "project.captr");
	await packProjectWorkspace(workspace, bundle);
	const loaded = path.join(root, "loaded");
	await unpackProjectBundle(bundle, loaded);

	expect(await fs.readFile(path.join(loaded, "assets", "v1", "transcript.json"), "utf8")).toContain('"proj-transcript"');
	expect(await fs.readFile(path.join(loaded, "assets", "v1", "captions.vtt"), "utf8")).toContain("WEBVTT");
});

it("stages private sidecars beside a relative source resolved inside the workspace", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-relative-private-"));
	roots.push(root);
	const input = path.join(root, "input");
	await fs.mkdir(input);
	await fs.writeFile(path.join(input, "voice.wav"), "voice");
	await fs.writeFile(path.join(input, "transcript.json"), '{"segments":[]}');
	await fs.writeFile(path.join(input, "captions.vtt"), "WEBVTT");
	const project = createTimelineProject("relative-private", "Relative private");
	project.localAssets = [
		{
			id: "relative-voice",
			kind: "audio",
			name: "Voice",
			width: 0,
			height: 0,
			durationUs: 5_000_000,
			source: { path: "input/voice.wav", durationUs: 5_000_000, offsetUs: 0 },
		},
	];
	await stageTimelineProject(project, root);
	expect(
		await fs.readFile(path.join(root, "assets", "relative-voice", "transcript.json"), "utf8"),
	).toBe('{"segments":[]}');
	expect(
		await fs.readFile(path.join(root, "assets", "relative-voice", "captions.vtt"), "utf8"),
	).toBe("WEBVTT");
});

it("timelineBundle_rejectsMalformedTransitionWithoutPartialLoad", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-invalid-transition-"));
	roots.push(root);
	const project = createTimelineProject("invalid-transition", "Invalid"),
		workspace = path.join(root, "workspace");
	(project as unknown as { clipTransitions: unknown[] }).clipTransitions = [
		{ id: "bad-transition", trackId: "visual-1", fromClipId: "missing-a", toClipId: "missing-b", preset: { kind: "mystery" }, durationUs: 1, easing: "linear" },
	];
	await expect(stageTimelineProject(project, workspace)).rejects.toThrow(/transition|clip|preset/i);
	await expect(fs.access(workspace)).rejects.toThrow();
});

it("timelineBundle_stagesModularStoryAndHyperframeAndCategorizesEntries", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-story-hf-bundle-"));
	roots.push(root);

	let project = createTimelineProject("story-project", "Multi-Story Project");
	project.hyperframes = [
		{
			id: "intro-card",
			name: "Kinetic Intro",
			entryHtml: "hyperframe/hyperframe-intro-card.html",
			htmlContent: "<!DOCTYPE html><html><body><h1>Kinetic Title</h1></body></html>",
			durationUs: 3_000_000,
			width: 1920,
			height: 1080,
		},
	];

	const workspace = path.join(root, "workspace");
	const staged = await stageTimelineProject(project, workspace);

	// Verify Story folder and files were generated
	expect(staged.stories).toBeDefined();
	expect(staged.stories!.length).toBeGreaterThan(0);
	expect(staged.storyManifest).toBeDefined();

	const storyDir = path.join(workspace, "Story");
	const storyFiles = await fs.readdir(storyDir);
	expect(storyFiles).toContain("story-0.json");

	// Verify Hyperframe folder and HTML were generated
	const hfDir = path.join(workspace, "hyperframe");
	const hfFiles = await fs.readdir(hfDir);
	expect(hfFiles).toContain("hyperframe-intro-card.html");
	expect(await fs.readFile(path.join(hfDir, "hyperframe-intro-card.html"), "utf8")).toContain("Kinetic Title");

	// Pack to .captr bundle and inspect
	const bundle = path.join(root, "multistory.captr");
	await packProjectWorkspace(workspace, bundle);

	const inspection = await inspectProjectBundle(bundle);
	expect(inspection.success).toBe(true);

	const storyEntry = inspection.entries.find((e) => e.path.startsWith("Story/"));
	expect(storyEntry).toBeDefined();
	expect(storyEntry?.category).toBe("story");

	const hfEntry = inspection.entries.find((e) => e.path.startsWith("hyperframe/"));
	expect(hfEntry).toBeDefined();
	expect(hfEntry?.category).toBe("hyperframe");

	// Unpack and resolve
	const unpacked = path.join(root, "unpacked");
	await unpackProjectBundle(bundle, unpacked);
	const reopened = resolveTimelineProject(
		JSON.parse(await fs.readFile(path.join(unpacked, "project.json"), "utf8")),
		unpacked,
	);

	expect(reopened.stories).toHaveLength(staged.stories!.length);
	expect(reopened.hyperframes).toHaveLength(1);
	expect(path.isAbsolute(reopened.hyperframes![0].entryHtml)).toBe(true);
});


