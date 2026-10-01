import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { ProjectCommand } from "@/core/timeline/history";
import { clipDurationUs, type TimelineClip, type TimelineProject } from "@/core/timeline/types";
import { applyClipGesture, beginTimelineDrag, CLIP_DRAG_TYPE, endTimelineDrag, pixelsToTime, snapTimelineTime, timeToPixels, type ClipGesture } from "./timelineInteractions";
interface Props {project:TimelineProject;clip:TimelineClip;selected:boolean;scale:number;playheadUs:number;locked:boolean;onCommand:(command:ProjectCommand)=>void;onSelect:(ids:string[])=>void;onOpenRecording:(id:string)=>void}
export function TimelineClipItem({project,clip,selected,scale,playheadUs,locked,onCommand,onSelect,onOpenRecording}:Props) {
 const asset=project.assets.find(a=>a.id===clip.assetId)!,label=asset.kind==="text"?(clip.text??asset.text)?.content||asset.name:asset.name;
 const [preview,setPreview]=useState<TimelineClip|null>(null);
 const gesture=useRef<{startX:number;kind:ClipGesture["kind"];deltaUs:number}|null>(null);
 const shown=preview??clip;
 const begin=(event:PointerEvent<HTMLSpanElement>,kind:ClipGesture["kind"])=>{event.preventDefault();event.stopPropagation();if(locked)return;event.currentTarget.setPointerCapture(event.pointerId);onSelect([clip.id]);gesture.current={startX:event.clientX,kind,deltaUs:0};};
 const move=(event:PointerEvent<HTMLSpanElement>)=>{
  const current=gesture.current;if(!current)return;const edge=current.kind==="trim-out"?clip.startUs+clipDurationUs(clip):clip.startUs;
  current.deltaUs=snapTimelineTime(edge+pixelsToTime(event.clientX-current.startX,scale),project,playheadUs,scale,clip.id)-edge;
  try{const p=applyClipGesture(project,clip.id,current);setPreview(p.tracks.flatMap(t=>t.clips).find(c=>c.id===clip.id)!);}catch{setPreview(null);}
 };
 const end=(event:PointerEvent<HTMLSpanElement>)=>{event.stopPropagation();const current=gesture.current;gesture.current=null;setPreview(null);if(current?.deltaUs)onCommand(p=>applyClipGesture(p,clip.id,current));};
 return <div role="button" tabIndex={0} aria-label={`${label}, ${(shown.startUs/1_000_000).toFixed(2)} seconds`} aria-pressed={selected} className={`project-clip ${asset.kind} ${selected?"selected":""} ${locked?"locked":""}`} style={{left:timeToPixels(shown.startUs,scale),width:Math.max(2,timeToPixels(clipDurationUs(shown),scale))}} draggable={!locked}
  onDragStart={event=>{const rect=event.currentTarget.getBoundingClientRect(),pointerOffsetPx=Math.max(0,Math.min(rect.width,event.clientX-rect.left));beginTimelineDrag({type:"clip",id:clip.id,durationUs:clipDurationUs(clip),mediaKind:asset.kind==="audio"?"audio":"visual",pointerOffsetPx});event.currentTarget.classList.add("dragging");event.dataTransfer.setData(CLIP_DRAG_TYPE,clip.id);event.dataTransfer.effectAllowed="move";}}
  onDragEnd={event=>{event.currentTarget.classList.remove("dragging");endTimelineDrag(clip.id);}}
  onClick={event=>{event.stopPropagation();onSelect([clip.id]);}} onKeyDown={event=>{if(event.key==="Enter"){event.stopPropagation();onSelect([clip.id]);if(asset.kind==="recording")onOpenRecording(clip.id);}}} onDoubleClick={()=>{if(asset.kind==="recording")onOpenRecording(clip.id);}}>
  <span className="project-trim-handle left" role="slider" aria-label="Trim clip start" aria-valuemin={0} aria-valuemax={clip.sourceOutUs/1_000_000} aria-valuenow={clip.sourceInUs/1_000_000} onPointerDown={e=>begin(e,"trim-in")} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{gesture.current=null;setPreview(null);}}/>
  <span className="project-clip-label">{asset.kind==="recording"?<span className="project-record-dot"/>:null}{label}</span>
  <span className="project-clip-details">{(clipDurationUs(shown)/1_000_000).toFixed(1)}s{shown.rate!==1?` · ${shown.rate}×`:""}</span>
  <span className="project-trim-handle right" role="slider" aria-label="Trim clip end" aria-valuemin={clip.sourceInUs/1_000_000} aria-valuemax={(project.compositions.find(c=>c.id===clip.compositionId)?.durationUs??asset.durationUs)/1_000_000} aria-valuenow={clip.sourceOutUs/1_000_000} onPointerDown={e=>begin(e,"trim-out")} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{gesture.current=null;setPreview(null);}}/>
 </div>;
}
