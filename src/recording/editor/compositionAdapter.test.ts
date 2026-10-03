import { expect, it } from "vitest";
import { createTimelineProject, registerRecording, placeAsset, updateComposition } from "@/core/timeline/commands";
import { changeRecordingSettings, resolveRecordingSettings } from "./compositionAdapter";
it("edits one recording placement independently, protects sources and survives reload",()=>{
 const original=registerRecording(createTimelineProject("p","P"),{captureId:"take",name:"Take",durationUs:10_000_000,width:1920,height:1080,screen:{path:"screen.mp4",durationUs:10_000_000,offsetUs:0},webcam:{path:"camera.mp4",durationUs:10_000_000,offsetUs:200_000},settings:{}},{assetId:"a",packageId:"r"});
 const one=placeAsset(original,"a","visual-1",0,{clipId:"c1",compositionId:"e1"}),two=placeAsset(one,"a","visual-1",10_000_000,{clipId:"c2",compositionId:"e2"});const pkgBefore=structuredClone(two.packages[0]);
 const edited=changeRecordingSettings(two.packages[0],two.compositions[0],{showCursor:false,cursorSpringMassMultiplier:2,sourceAudioSettings:{microphone:{volume:0.4,normalize:false}},videoPath:"replacement.mp4",webcam:{...resolveRecordingSettings(two.packages[0],two.compositions[0]).webcam,size:40},trimRegions:[{id:"cut",startMs:8000,endMs:10000}]});const next=updateComposition(two,"e1",edited);
 expect(next.tracks[0].clips[0].sourceOutUs).toBe(8_000_000);expect(next.compositions[1]).toEqual(two.compositions[1]);expect(next.packages[0]).toEqual(pkgBefore);
 const reopened=JSON.parse(JSON.stringify(next));expect(resolveRecordingSettings(reopened.packages[0],reopened.compositions[0])).toMatchObject({showCursor:false,cursorSpringMassMultiplier:2,videoPath:"screen.mp4",webcam:{sourcePath:"camera.mp4",size:40,timeOffsetMs:200}});
 expect(()=>changeRecordingSettings(next.packages[0],next.compositions[0],{trimRegions:[{id:"all",startMs:0,endMs:10000}]})).toThrow(/empty/);
});
