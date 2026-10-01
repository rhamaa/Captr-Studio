import { assertSupportedLegacyProject } from "@/core/project/legacySupport";
import { createTimelineProject, registerRecording, placeAsset, registerMedia, trimClip, updateClip } from "./commands";
import { validateTimelineProject } from "./validation";
import type { TimelineProject } from "./types";
import type { RecordingSettings, MediaSource } from "@/recording/types";

export interface ConversionIds { projectId:string;prefix:string }
export function convertLegacyRecordProject(value:unknown,ids:ConversionIds):TimelineProject{
 assertSupportedLegacyProject(value);if(!value||typeof value!=="object")throw new Error("Invalid legacy project");const raw=value as Record<string,any>;
 if(raw.version!==1&&raw.version!==2)throw new Error("Unsupported legacy project version");
 if(raw.extensions&&Object.keys(raw.extensions).length)throw new Error("Unsupported legacy extensions");
 if(raw.transitions?.some((t:any)=>t.type!=="none")||raw.clips?.some((c:any)=>(c.transitionIn?.type&&c.transitionIn.type!=="none")||(c.transitionToNext?.type&&c.transitionToNext.type!=="none")))throw new Error("Legacy transitions cannot be converted without loss");
 let result=createTimelineProject(ids.projectId,typeof raw.title==="string"?raw.title:"Converted project");if(raw.canvas)result.canvas=structuredClone(raw.canvas);
 const entries=Array.isArray(raw.slides)?raw.slides:Array.isArray(raw.clips)&&raw.clips.length?raw.clips:[{id:"recording",videoPath:raw.videoPath,...raw.editor}];let startUs=0;
 for(const [index,entry]of entries.entries()){
  if(!entry||typeof entry!=="object"||(entry.type&&entry.type!=="record"))throw new Error("Unsupported legacy recording");
  const meta=(entry.meta??{...raw.editor,...entry}) as RecordingSettings;const videoPath=meta.videoPath;if(!videoPath)throw new Error("Missing legacy recording source");
  const durationUs=Math.round((entry.durationMs??raw.editor?.durationMs??0)*1000);if(durationUs<=0)throw new Error("Legacy recording duration must be probed before conversion");
  const source=(p:string|undefined|null,offsetUs=0):MediaSource|undefined=>p?{path:p,durationUs,offsetUs}:undefined;
  const assetId=`${ids.prefix}-asset-${index}`,packageId=`${ids.prefix}-package-${index}`,name=entry.title??entry.label??`Recording ${index+1}`;
  result=registerRecording(result,{captureId:`${raw.projectId??"legacy"}-${entry.id??index}`,name,durationUs,width:result.canvas.width,height:result.canvas.height,screen:source(videoPath)!,webcam:source(meta.webcamPath,Math.round((meta.webcam?.timeOffsetMs??0)*1000)),microphone:source(meta.microphoneAudioPath),system:source(meta.systemAudioPath),cursorPath:meta.cursorTelemetryPath??undefined,settings:structuredClone(meta)},{assetId,packageId});
  result=placeAsset(result,assetId,"visual-1",startUs,{clipId:`${ids.prefix}-clip-${index}`,compositionId:`${ids.prefix}-composition-${index}`});startUs+=result.compositions.at(-1)!.durationUs;
 }
 for(const [index,audio]of (raw.globalAudioTracks??[]).entries()){
  if(!audio.path||audio.loop||audio.fadeInMs>0||audio.fadeOutMs>0)throw new Error("Unsupported legacy global audio looping/fades");const startUs=Math.round((audio.startMsOffset??0)*1000),durationUs=Math.round((audio.durationMs??0)*1000);if(durationUs<=0)throw new Error("Unsupported legacy audio duration");const id=`${ids.prefix}-audio-${index}`;
  const trackId=`${ids.prefix}-audio-track-${index}`,clipId=`${id}-clip`;result.tracks.push({id:trackId,name:audio.name??"Audio",kind:"audio",locked:false,muted:false,hidden:false,clips:[]});result=registerMedia(result,{id,kind:"audio",name:audio.name??"Audio",durationUs,width:0,height:0,source:{path:audio.path,durationUs,offsetUs:0}});result=placeAsset(result,id,trackId,startUs,{clipId});result=trimClip(result,clipId,Math.round((audio.trimStartMs??0)*1000),Math.round((audio.trimEndMs??audio.durationMs)*1000));result=updateClip(result,clipId,{gain:audio.volume??1});
 }
 return validateTimelineProject(result);
}
