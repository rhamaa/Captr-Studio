import { expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import type { CompletedRecording } from "@/recording/types";
import { RecordingAssetController } from "./useRecordingAssets";
const recording=(captureId:string):CompletedRecording=>({captureId,name:captureId,durationUs:1_000_000,width:1920,height:1080,screen:{path:`${captureId}.mp4`,durationUs:1_000_000,offsetUs:0},settings:{}});
it("accepts two recordings into Assets without placements, deduplicates and ignores stale completion",async()=>{
 let project=createTimelineProject("one","One");const error=vi.fn();let seq=0;const controller=new RecordingAssetController({getProject:()=>project,update:next=>{project=next;},onError:error,ids:()=>({assetId:`a${seq}`,packageId:`p${seq++}`})});const generation=controller.beginProject("one");
 await controller.acceptCompleted(generation,recording("capture1"));await controller.acceptCompleted(generation,recording("capture2"));const current=project;await controller.acceptCompleted(generation,recording("capture1"));expect(project).toBe(current);expect(project.assets).toHaveLength(2);expect(project.tracks.flatMap(t=>t.clips)).toEqual([]);
 project=createTimelineProject("two","Two");controller.beginProject("two");await controller.acceptCompleted(generation,recording("late"));expect(project.assets).toEqual([]);expect(error).not.toHaveBeenCalled();
});
it("probing failure and project changes during probing preserve state",async()=>{
 let project=createTimelineProject("one","One"),resolve!:()=>void;const error=vi.fn();const controller=new RecordingAssetController({getProject:()=>project,update:p=>{project=p;},onError:error,probe:()=>new Promise<void>(r=>{resolve=r;})});const first=controller.beginProject("one"),pending=controller.acceptCompleted(first,recording("late"));project=createTimelineProject("two","Two");controller.beginProject("two");resolve();await pending;expect(project.assets).toEqual([]);
 const failing=new RecordingAssetController({getProject:()=>project,update:p=>{project=p;},onError:error,probe:async()=>{throw new Error("missing screen");}});const before=project;await failing.acceptCompleted(failing.beginProject("two"),recording("bad"));expect(project).toBe(before);expect(error).toHaveBeenCalledOnce();
});
