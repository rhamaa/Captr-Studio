import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createTimelineProject, registerRecording, placeAsset } from "../../../src/core/timeline/commands";
import { stageTimelineProject, resolveTimelineProject } from "./timelineBundle";
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
