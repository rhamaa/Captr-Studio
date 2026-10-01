import { useState } from "react";
import { Eye, EyeSlash as EyeOff, LockKey as LockKeyhole, LockKeyOpen as UnlockKeyhole, SpeakerHigh as Volume2, SpeakerSlash as VolumeX } from "@phosphor-icons/react";
import { moveClip, updateTrack } from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import { projectDurationUs, type TimelineProject } from "@/core/timeline/types";
import { ASSET_DRAG_TYPE, CLIP_DRAG_TYPE, assetDropCommand, pixelsToTime, snapTimelineTime, timeToPixels, timelineActionCommand } from "./timelineInteractions";
import { TimelineClipItem } from "./TimelineClipItem";
import { TimelineToolbar } from "./TimelineToolbar";
export interface ProjectTimelineProps {project:TimelineProject;selection:string[];playheadUs:number;onCommand:(command:ProjectCommand)=>void;onSelect:(ids:string[])=>void;onSeek:(timeUs:number)=>void;onOpenRecording:(id:string)=>void}
export function ProjectTimeline({project,selection,playheadUs,onCommand,onSelect,onSeek,onOpenRecording}:ProjectTimelineProps) {
 const [scale,setScale]=useState(65);
 const duration=Math.max(20_000_000,projectDurationUs(project)+10_000_000),width=timeToPixels(duration,scale);
 const tickSeconds=scale<20?10:scale<50?5:scale<110?2:1;
 const selectedTrack=project.tracks.find(t=>t.clips.some(c=>selection.includes(c.id)));
 const locked=Boolean(selectedTrack?.locked);
 return <section className="project-timeline" aria-label="Project timeline" tabIndex={0} onKeyDown={event=>{
  if((event.target as HTMLElement).matches("input,textarea,select"))return;
  if(event.key==="Delete"||event.key==="Backspace"){event.preventDefault();onCommand(timelineActionCommand("delete",selection,playheadUs));}
  else if(event.key.toLowerCase()==="s"&&!event.ctrlKey&&!event.metaKey){event.preventDefault();onCommand(timelineActionCommand("split",selection,playheadUs));}
  else if(event.key.toLowerCase()==="d"&&(event.ctrlKey||event.metaKey)){event.preventDefault();onCommand(timelineActionCommand("duplicate",selection,playheadUs));}
 }}>
  <TimelineToolbar selection={selection} playheadUs={playheadUs} onCommand={onCommand} scale={scale} onScale={setScale} locked={locked}/>
  <div className="project-timeline-scroll" onWheel={event=>{if(event.ctrlKey||event.metaKey){event.preventDefault();setScale(v=>Math.max(8,Math.min(250,v*(event.deltaY<0?1.12:0.89))));}}}>
   <div className="project-track-list" style={{width:width+150}}>
    <div className="project-ruler-row"><div className="project-track-heading">Timeline</div><div className="project-ruler" style={{width}} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);onSeek(Math.max(0,pixelsToTime(event.clientX-event.currentTarget.getBoundingClientRect().left,scale)));}} onPointerMove={event=>{if(event.buttons===1)onSeek(Math.max(0,pixelsToTime(event.clientX-event.currentTarget.getBoundingClientRect().left,scale)));}}>
     {Array.from({length:Math.ceil(duration/1_000_000/tickSeconds)},(_,i)=><span key={i} style={{left:timeToPixels(i*tickSeconds*1_000_000,scale)}}>{Math.floor(i*tickSeconds/60)}:{String(i*tickSeconds%60).padStart(2,"0")}</span>)}
    </div></div>
    {project.tracks.map(track=><div className={`project-track-row ${track.locked?"locked":""}`} key={track.id}>
     <div className="project-track-heading"><span>{track.name}</span><div>
      <button aria-label={`${track.muted?"Unmute":"Mute"} ${track.name}`} title="Mute track" onClick={()=>onCommand(p=>updateTrack(p,track.id,{muted:!track.muted}))}>{track.muted?<VolumeX size={14}/>:<Volume2 size={14}/>}</button>
      {track.kind==="visual"&&<button aria-label={`${track.hidden?"Show":"Hide"} ${track.name}`} title="Show or hide track" onClick={()=>onCommand(p=>updateTrack(p,track.id,{hidden:!track.hidden}))}>{track.hidden?<EyeOff size={14}/>:<Eye size={14}/>}</button>}
      <button aria-label={`${track.locked?"Unlock":"Lock"} ${track.name}`} title="Lock track" onClick={()=>onCommand(p=>updateTrack(p,track.id,{locked:!track.locked}))}>{track.locked?<LockKeyhole size={14}/>:<UnlockKeyhole size={14}/>}</button>
     </div></div>
     <div className="project-track-lane" style={{width,backgroundSize:`${timeToPixels(tickSeconds*1_000_000,scale)}px 100%`}} onClick={()=>onSelect([])} onDragOver={event=>{if(!track.locked){event.preventDefault();event.dataTransfer.dropEffect=event.dataTransfer.types.includes(CLIP_DRAG_TYPE)?"move":"copy";}}} onDrop={event=>{
      event.preventDefault();if(track.locked)return;const clipId=event.dataTransfer.getData(CLIP_DRAG_TYPE),assetId=event.dataTransfer.getData(ASSET_DRAG_TYPE);
      const startUs=snapTimelineTime(pixelsToTime(event.clientX-event.currentTarget.getBoundingClientRect().left,scale),project,playheadUs,scale,clipId||undefined);
      if(clipId)onCommand(p=>moveClip(p,clipId,track.id,startUs));else if(assetId)onCommand(assetDropCommand(assetId,track.id,startUs,{clipId:crypto.randomUUID(),compositionId:crypto.randomUUID()}));
     }}>
      {!track.clips.length&&<span className="project-track-empty">{track.kind==="visual"?"Drag video, images or recordings here":"Drag audio here"}</span>}
      {track.clips.map(clip=><TimelineClipItem key={clip.id} project={project} clip={clip} scale={scale} playheadUs={playheadUs} selected={selection.includes(clip.id)} locked={track.locked} onCommand={onCommand} onSelect={onSelect} onOpenRecording={onOpenRecording}/>)}
     </div>
    </div>)}
    <div className="project-playhead" style={{left:150+timeToPixels(playheadUs,scale)}}><span/></div>
   </div>
  </div>
 </section>;
}
