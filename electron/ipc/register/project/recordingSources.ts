import fs from "node:fs/promises";
import { ipcMain } from "electron";
import { isAllowedLocalMediaPath, rememberApprovedLocalReadPath } from "../../project/manager";
import { getCompanionAudioStartDelayMs, getRecordingDiagnosticsPath, getUsableCompanionAudioCandidates, hasEmbeddedAudioStream } from "../../recording/diagnostics";
import { getTelemetryPathForVideo } from "../../utils";

export function registerRecordingSourceHandlers():void {
 ipcMain.handle("inspect-recording-sources",async(_,videoPath:string)=>{
  try {
   if(!await isAllowedLocalMediaPath(videoPath))throw new Error("Recording source is not approved");
   const candidates=await getUsableCompanionAudioCandidates(videoPath);
   const microphonePath=candidates.flatMap(c=>c.usablePaths.filter(p=>p===c.micPath))[0]??null;
   const systemPath=candidates.flatMap(c=>c.usablePaths.filter(p=>p===c.systemPath))[0]??null;
   const cursorCandidate=getTelemetryPathForVideo(videoPath);
   const cursorPath=await fs.access(cursorCandidate).then(()=>cursorCandidate,()=>null);
   const [microphoneOffsetMs,systemOffsetMs,embeddedAudio]=await Promise.all([microphonePath?getCompanionAudioStartDelayMs(microphonePath):null,systemPath?getCompanionAudioStartDelayMs(systemPath):null,systemPath?false:hasEmbeddedAudioStream(videoPath)]);
   const diagnostics=await fs.readFile(getRecordingDiagnosticsPath(videoPath),"utf8").then(s=>JSON.parse(s) as Record<string,unknown>,()=>undefined);
   for(const p of [microphonePath,systemPath,cursorPath])await rememberApprovedLocalReadPath(p);
   return {success:true,microphonePath,systemPath,cursorPath,microphoneOffsetMs:microphoneOffsetMs??0,systemOffsetMs:systemOffsetMs??0,embeddedAudio,diagnostics};
  } catch(error) {return {success:false,error:String(error)};}
 });
}
