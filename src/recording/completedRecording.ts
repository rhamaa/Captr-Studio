import type { CompletedRecording, MediaSource } from "./types";
import { probeMedia } from "./mediaProbe";
import type { RecordingSessionData } from "../../electron/ipc/types";
import { createDefaultRecordingSettings } from "./schema";
import { buildInteractionZoomSuggestions } from "@/components/video-editor/timeline/zoomSuggestionUtils";

export async function completedRecordingFromSession(session:RecordingSessionData):Promise<CompletedRecording> {
 if(!session.captureId)throw new Error("Recording provenance is missing");
 const screen=await probeMedia(session.videoPath,"video");
 const sources=await window.electronAPI.inspectRecordingSources(session.videoPath);
 if(!sources.success)throw new Error(sources.error??"Could not inspect recording streams");
 const stream=async(path:string|undefined|null,offsetUs=0):Promise<MediaSource|undefined>=>{if(!path)return;const media=await probeMedia(path,path===session.webcamPath?"video":"audio");return {path,durationUs:media.durationUs,offsetUs};};
 const [webcam,microphone,system]=await Promise.all([stream(session.webcamPath,Math.round((session.timeOffsetMs??0)*1000)),stream(sources.microphonePath,Math.round((sources.microphoneOffsetMs??0)*1000)),stream(sources.systemPath??(sources.embeddedAudio?session.videoPath:null),Math.round((sources.systemOffsetMs??0)*1000))]);
 const telemetry=await window.electronAPI.getCursorTelemetry(session.videoPath,sources.cursorPath??undefined);
 if(sources.cursorPath&&!telemetry.success)throw new Error("Recording cursor metadata is unreadable");
 const defaults=createDefaultRecordingSettings();
 const zooms=buildInteractionZoomSuggestions({cursorTelemetry:telemetry.samples??[],totalMs:screen.durationUs/1000,defaultDurationMs:2500}).suggestions;
 return {captureId:session.captureId,name:session.videoPath.split(/[\\/]/).at(-1)??"Recording",durationUs:screen.durationUs,width:screen.width,height:screen.height,screen:{path:session.videoPath,durationUs:screen.durationUs,offsetUs:0},webcam,microphone,system,cursorPath:sources.cursorPath??undefined,settings:{showCursor:!session.hideOverlayCursorByDefault,cursorTelemetry:telemetry.samples,webcam:{...defaults.webcam,enabled:Boolean(webcam),sourcePath:webcam?.path??null,timeOffsetMs:(webcam?.offsetUs??0)/1000},zoomRegions:zooms.map(z=>({id:crypto.randomUUID(),startMs:z.start,endMs:z.end,depth:z.depth??2,focus:z.focus,mode:"auto"}))},diagnostics:sources.diagnostics};
}
