import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { addTextOverlay, createTimelineProject, registerMedia, registerRecording, placeAsset } from "../../../src/core/timeline/commands";
import { addClipTransition, setComponentAnimation } from "../../../src/core/timeline/clipTransitions";
import { createAndPlaceShape, setShapeStyleOverride } from "../../../src/core/timeline/shapeCommands";
import type { ShapeDefinition } from "../../../src/core/timeline/types";
import { resolveTimelineProject, stageTimelineProject } from "./timelineBundle";
import { packProjectWorkspace, unpackProjectBundle } from "./projectBundle";

const roots:string[]=[];afterEach(async()=>{for(const r of roots.splice(0))await fs.rm(r,{recursive:true,force:true});});
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
 expect(staged.assets[0].text?.content).toBe("Your text");
 expect(await fs.readdir(path.join(workspace,"assets","title"))).toEqual(["asset.json"]);
 const bundle=path.join(root,"text.captr"),loaded=path.join(root,"loaded");
 await packProjectWorkspace(workspace,bundle);await unpackProjectBundle(bundle,loaded);
 const reopened=resolveTimelineProject(JSON.parse(await fs.readFile(path.join(loaded,"project.json"),"utf8")),loaded);
 expect(reopened.tracks.find(t=>t.id==="title-track")?.clips[0].text?.content).toBe("Your text");
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

it("timelineBundle_roundTripsPathlessShapeAssetAndPlacementOverride", async () => {
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
		staged = await stageTimelineProject(project, workspace),
		shapeFiles = await fs.readdir(path.join(workspace, "assets", "shape"));
	expect(shapeFiles).toEqual(["asset.json"]);
	expect(staged.assets[0]!.source).toBeUndefined();
	expect(staged.assets[0]!.shapeDefinition).toEqual(rectangle);

	const bundle = path.join(root, "shape.captr"), loaded = path.join(root, "loaded");
	await packProjectWorkspace(workspace, bundle);
	await unpackProjectBundle(bundle, loaded);
	const reopened = resolveTimelineProject(
		JSON.parse(await fs.readFile(path.join(loaded, "project.json"), "utf8")),
		loaded,
	);
	expect(reopened.assets[0]!.shapeDefinition).toEqual(rectangle);
	expect(reopened.tracks[0]!.clips[0]!.shapeStyleOverride).toEqual({
		fill: "#abcdef",
		stroke: { color: "#123456", width: 1.5 },
	});
	expect(reopened.assets[0]!.source).toBeUndefined();
});

it("timelineBundle_loadsOldV3WithoutVisualEffectFields", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-old-v3-"));
	roots.push(root);
	const workspace = path.join(root, "workspace");
	await stageTimelineProject(createTimelineProject("old-v3", "Old V3"), workspace);
	const bundle = path.join(root, "old.captr"), loaded = path.join(root, "loaded");
	await packProjectWorkspace(workspace, bundle);
	await unpackProjectBundle(bundle, loaded);
	const reopened = resolveTimelineProject(
		JSON.parse(await fs.readFile(path.join(loaded, "project.json"), "utf8")),
		loaded,
	);
	expect(reopened.version).toBe(3);
	expect(reopened.clipTransitions).toBeUndefined();
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

