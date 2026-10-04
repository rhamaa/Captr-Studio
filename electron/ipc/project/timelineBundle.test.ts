import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { addTextOverlay, createTimelineProject, registerMedia, registerRecording, placeAsset } from "../../../src/core/timeline/commands";
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
