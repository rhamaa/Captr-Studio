import { useEffect, useRef, useState } from "react";
import { MusicNote } from "@phosphor-icons/react";
import type { MediaAsset } from "@/core/timeline/types";
import { localMediaUrl } from "@/recording/mediaProbe";
/** Library source preview never creates or changes a timeline placement. */
export function AssetSourcePreview({asset,path,timeUs,onError}:{asset:MediaAsset;path:string;timeUs?:number;onError?:(error:string)=>void}) {
 const [url,setUrl]=useState(""),video=useRef<HTMLVideoElement>(null);
 useEffect(()=>{let active=true;setUrl("");void localMediaUrl(path).then(u=>{if(active)setUrl(u);}).catch(e=>{if(active)onError?.(String(e));});return()=>{active=false;};},[path]);
 useEffect(()=>{if(video.current&&timeUs!==undefined&&Math.abs(video.current.currentTime-timeUs/1_000_000)>0.03)video.current.currentTime=timeUs/1_000_000;},[timeUs,url]);
 return <div className="project-source-preview" aria-label={`Source preview: ${asset.name}`}>
  {asset.kind==="image"?<img src={url||undefined} alt={asset.name}/>:asset.kind==="audio"?<div className="project-audio-preview"><MusicNote size={60}/><strong>{asset.name}</strong>{url&&<audio src={url} controls/>}</div>:url&&<video ref={video} src={url} controls={timeUs===undefined} onLoadedMetadata={()=>{if(video.current&&timeUs!==undefined)video.current.currentTime=timeUs/1_000_000;}} onError={()=>onError?.("Could not decode preview media")}/>}
 </div>;
}
