import { useEffect, useState } from "react";
import { FilmStrip, Image as ImageIcon, Microphone, MusicNote, Plus, TextT, Trash, VideoCamera } from "@phosphor-icons/react";
import type { MediaAsset } from "@/core/timeline/types";
import { ASSET_DRAG_TYPE, beginTimelineDrag, endTimelineDrag } from "./timelineInteractions";
import { localMediaUrl } from "@/recording/mediaProbe";
export interface AssetCardProps {asset:MediaAsset;sourcePath?:string;selected:boolean;onPreview:()=>void;onPlace:()=>void;onRemove:()=>void}
export function AssetCard({asset,sourcePath,selected,onPreview,onPlace,onRemove}:AssetCardProps) {
 const [url,setUrl]=useState("");useEffect(()=>{let current=true;setUrl("");if(sourcePath)void localMediaUrl(sourcePath).then(u=>{if(current)setUrl(u);}).catch(()=>undefined);return()=>{current=false;};},[sourcePath]);
 const Icon=asset.kind==="recording"?VideoCamera:asset.kind==="audio"?MusicNote:asset.kind==="image"?ImageIcon:asset.kind==="text"?TextT:FilmStrip;
 return <article className={`project-asset-card ${selected?"selected":""}`} draggable onDragStart={event=>{beginTimelineDrag({type:"asset",id:asset.id,durationUs:asset.durationUs,mediaKind:asset.kind==="audio"?"audio":"visual",pointerOffsetPx:0});event.dataTransfer.setData(ASSET_DRAG_TYPE,asset.id);event.dataTransfer.effectAllowed="copy";}} onDragEnd={()=>endTimelineDrag(asset.id)}>
  <button className="project-asset-preview" aria-label={`Preview ${asset.name}`} onClick={onPreview}>
   {asset.kind==="text"?<span className="project-asset-text-thumbnail" style={{color:asset.text?.color,fontFamily:asset.text?.fontFamily,fontSize:Math.min(20,asset.text?.fontSizePx??20),fontWeight:asset.text?.fontWeight}}>{asset.text?.content||"Text"}</span>:url&&asset.kind==="image"?<img src={url} alt={asset.name}/>:url&&asset.kind!=="audio"?<video src={url} muted preload="metadata"/>:<Icon size={32} weight="duotone"/>}
   <span className="project-asset-duration">{(asset.durationUs/1_000_000).toFixed(1)}s</span>{asset.kind==="recording"&&<span className="project-package-badge"><VideoCamera size={12}/>Recording</span>}
  </button>
  <div className="project-asset-info"><span title={asset.name}>{asset.name}</span><div className="project-asset-actions"><button aria-label={`Add ${asset.name} to timeline`} title="Add to timeline" onClick={onPlace}><Plus size={15}/></button><button aria-label={`Remove ${asset.name}`} title="Remove asset" onClick={onRemove}><Trash size={15}/></button></div></div>
  <span className="project-asset-meta"><Icon size={12}/>{asset.kind==="recording"?<><Microphone size={12}/>Editable package</>:asset.kind==="audio"?"Audio":asset.kind==="text"?"Text overlay":`${asset.width} × ${asset.height}`}</span>
 </article>;
}
