import { afterEach, expect, it, vi } from "vitest";
vi.mock("./mediaProbe",()=>({probeMedia:vi.fn(async(path:string)=>{if(path==="missing.mp4")throw new Error("missing required screen");return {durationUs:path.endsWith("wav")?9_000_000:10_000_000,width:1920,height:1080,url:path};})}));
import { completedRecordingFromSession } from "./completedRecording";
afterEach(()=>vi.unstubAllGlobals());
it("prefers canonical sidecars over embedded audio and probes offsets and cursor",async()=>{
 vi.stubGlobal("window",{electronAPI:{inspectRecordingSources:async()=>({success:true,microphonePath:"mic.wav",systemPath:"system.wav",microphoneOffsetMs:200,embeddedAudio:true,cursorPath:"cursor.json"}),getCursorTelemetry:async()=>({success:true,samples:[{timeMs:1,cx:0.5,cy:0.5}]})}});
 const completed=await completedRecordingFromSession({captureId:"capture",projectId:"project",videoPath:"screen.mp4",webcamPath:"camera.mp4",timeOffsetMs:-400});
 expect(completed).toMatchObject({captureId:"capture",durationUs:10_000_000,microphone:{path:"mic.wav",offsetUs:200_000,durationUs:9_000_000},system:{path:"system.wav"},webcam:{offsetUs:-400_000},cursorPath:"cursor.json"});expect(completed.settings.cursorTelemetry).toHaveLength(1);
 await expect(completedRecordingFromSession({captureId:"capture",videoPath:"missing.mp4"})).rejects.toThrow(/screen/);
});
