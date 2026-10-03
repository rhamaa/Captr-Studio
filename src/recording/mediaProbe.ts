export interface ProbedMedia { durationUs:number;width:number;height:number;url:string }
export async function localMediaUrl(path:string):Promise<string> {const result=await window.electronAPI.getLocalMediaUrl(path);if(!result.success)throw new Error(`Cannot read media: ${path}`);return result.url;}
/** Await decoded metadata, including browser-recorded WebM with an unbounded header. */
export async function probeMedia(path:string,kind:"video"|"audio"|"image"):Promise<ProbedMedia> {
 const url=await localMediaUrl(path);
 return new Promise((resolve,reject)=>{
  const element=kind==="image"?new Image():document.createElement(kind);
  let seekingDuration=false;
  const timeout=window.setTimeout(()=>finish(new Error(`Media metadata timed out: ${path}`)),15_000);
  const finish=(error?:Error)=>{window.clearTimeout(timeout);if(error){cleanup();reject(error);return;}const media=element as HTMLVideoElement;const image=element as HTMLImageElement;const durationUs=kind==="image"?5_000_000:Math.round(media.duration*1_000_000);if(!Number.isSafeInteger(durationUs)||durationUs<=0){cleanup();reject(new Error(`Invalid media duration: ${path}`));return;}const result={url,durationUs,width:kind==="image"?image.naturalWidth:kind==="video"?media.videoWidth:0,height:kind==="image"?image.naturalHeight:kind==="video"?media.videoHeight:0};cleanup();resolve(result);};
  const cleanup=()=>{element.onload=null;element.onerror=null;if(kind!=="image"){const media=element as HTMLMediaElement;media.onloadedmetadata=null;media.ondurationchange=null;media.pause();media.removeAttribute("src");media.load();}};
  element.onerror=()=>finish(new Error(`Cannot decode media: ${path}`));
  if(kind==="image")element.onload=()=>finish();
  else {const media=element as HTMLMediaElement;media.preload="metadata";media.onloadedmetadata=()=>{if(Number.isFinite(media.duration)&&media.duration>0)finish();else{seekingDuration=true;media.currentTime=1e10;}};media.ondurationchange=()=>{if(seekingDuration&&Number.isFinite(media.duration)&&media.duration>0)finish();};}
  element.src=url;
 });
}
