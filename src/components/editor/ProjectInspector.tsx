import { SlidersHorizontal, VideoCamera } from "@phosphor-icons/react";
import { moveClip, setClipRate, trimClip, updateClip } from "@/core/timeline/commands";
import { clipDurationUs, type TimelineProject } from "@/core/timeline/types";
import type { ProjectCommand } from "@/core/timeline/history";
export function ProjectInspector({project,selection,onCommand,onOpenRecording}:{project:TimelineProject;selection:string[];onCommand:(command:ProjectCommand)=>void;onOpenRecording:(id:string)=>void}) {
 const track=project.tracks.find(t=>t.clips.some(c=>selection.includes(c.id))),clip=track?.clips.find(c=>selection.includes(c.id)),asset=project.assets.find(a=>a.id===clip?.assetId);
 return <aside className="project-inspector" aria-label="Clip inspector"><header className="project-panel-header"><h2>Inspector</h2><SlidersHorizontal size={18}/></header>
  {!clip||!asset||!track?<div className="project-inspector-empty"><SlidersHorizontal size={27}/><p>Select a clip to edit its properties</p></div>:<fieldset disabled={track.locked}>
   <div className="project-inspector-title"><strong>{asset.name}</strong><span>{asset.kind}</span></div>
   {asset.kind==="recording"&&<button className="project-edit-recording" onClick={()=>onOpenRecording(clip.id)}><VideoCamera size={18}/>Edit recording effects</button>}
   <label>Start<input aria-label="Clip start seconds" type="number" min={0} step={0.1} value={clip.startUs/1_000_000} onChange={e=>onCommand(p=>moveClip(p,clip.id,track.id,Math.round(Number(e.target.value)*1_000_000)))}/><span>sec</span></label>
   <label>Duration<span>{(clipDurationUs(clip)/1_000_000).toFixed(2)} sec</span></label>
   <label>In<input aria-label="Clip source in seconds" type="number" min={0} step={0.1} value={clip.sourceInUs/1_000_000} onChange={e=>onCommand(p=>trimClip(p,clip.id,Math.round(Number(e.target.value)*1_000_000),clip.sourceOutUs))}/><span>sec</span></label>
   <label>Out<input aria-label="Clip source out seconds" type="number" min={0} step={0.1} value={clip.sourceOutUs/1_000_000} onChange={e=>onCommand(p=>trimClip(p,clip.id,clip.sourceInUs,Math.round(Number(e.target.value)*1_000_000)))}/><span>sec</span></label>
   <label>Speed<select aria-label="Clip playback speed" value={clip.rate} onChange={e=>onCommand(p=>setClipRate(p,clip.id,Number(e.target.value)))}>{[0.5,1,2].map(rate=><option key={rate} value={rate}>{rate}×</option>)}</select></label>
   <label>Volume<input aria-label="Clip volume" type="range" min={0} max={2} step={0.01} value={clip.gain} onChange={e=>onCommand(p=>updateClip(p,clip.id,{gain:Number(e.target.value)}))}/><span>{Math.round(clip.gain*100)}%</span></label>
   {asset.kind!=="audio"&&<><h3>Transform</h3>{(["x","y","scale","rotation","opacity"] as const).map(key=><label key={key}>{key.charAt(0).toUpperCase()+key.slice(1)}<input aria-label={`Clip ${key}`} type="number" step={key==="scale"||key==="opacity"?0.05:1} value={clip.transform[key]} min={key==="scale"?0.05:key==="opacity"?0:undefined} max={key==="opacity"?1:undefined} onChange={e=>onCommand(p=>updateClip(p,clip.id,{transform:{...clip.transform,[key]:Number(e.target.value)}}))}/></label>)}</>}
   {track.locked&&<p className="project-muted">Unlock the track to edit this clip</p>}
  </fieldset>}
 </aside>;
}
