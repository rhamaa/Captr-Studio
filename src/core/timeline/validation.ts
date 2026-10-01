import { clipDurationUs, type TimelineProject, type MediaSource } from "./types";

function requireValue(condition: unknown, message: string): asserts condition { if(!condition)throw new Error(message); }
const integer=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const positive=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>0;
export function assertSafeMediaPath(value: unknown): asserts value is string {
 requireValue(typeof value==="string"&&value.trim().length>0&&!value.includes("\0")&&!value.split(/[\\/]/).includes(".."),"Invalid media path");
 requireValue(!/^[a-z]+:\/\//i.test(value)&&!value.startsWith("\\\\"),"Remote media path is unsupported");
}
function source(s:MediaSource|undefined,required=false){
 requireValue(!required||s,"Missing required media source");if(!s)return;
 assertSafeMediaPath(s.path);requireValue(integer(s.durationUs)&&s.durationUs>0&&integer(s.offsetUs),"Invalid source clock");
}
function serializable(value:unknown,seen=new Set<unknown>()) {
 if(value===undefined||value===null||typeof value==="string"||typeof value==="boolean")return;
 if(typeof value==="number"){requireValue(Number.isFinite(value),"Non-finite settings");return;}
 requireValue(typeof value==="object"&&!seen.has(value),"Invalid settings value");seen.add(value);
 for(const v of Object.values(value))serializable(v,seen);seen.delete(value);
}
export function validateTimelineProject(value:unknown):TimelineProject {
 requireValue(value&&typeof value==="object","Invalid timeline project");
 const p=value as TimelineProject;
 requireValue(p.version===3&&typeof p.projectId==="string"&&p.projectId.length>0&&typeof p.title==="string","Invalid timeline identity");
 requireValue(p.canvas&&integer(p.canvas.width)&&p.canvas.width>0&&integer(p.canvas.height)&&p.canvas.height>0&&positive(p.canvas.fps),"Invalid canvas");
 for(const key of ["assets","packages","compositions","tracks"] as const)requireValue(Array.isArray(p[key]),`Invalid ${key}`);
 const ids=new Set<string>();const id=(v:string)=>{requireValue(typeof v==="string"&&v.length>0&&!ids.has(v),"Duplicate or invalid ID");ids.add(v);};
 for(const r of p.packages){id(r.id);requireValue(r.schemaVersion===1&&typeof r.captureId==="string"&&r.captureId.length>0,"Invalid recording identity");requireValue(integer(r.durationUs)&&r.durationUs>0&&integer(r.width)&&r.width>0&&integer(r.height)&&r.height>0,"Invalid recording duration/dimensions");source(r.screen,true);requireValue(r.screen.offsetUs===0&&r.screen.durationUs>=r.durationUs,"Invalid recording screen range");source(r.webcam);source(r.microphone);source(r.system);if(r.cursorPath)assertSafeMediaPath(r.cursorPath);requireValue(r.settings&&typeof r.settings==="object","Invalid recording settings");serializable(r.settings);}
 requireValue(new Set(p.packages.map(r=>r.captureId)).size===p.packages.length,"Duplicate capture ID");
 for(const a of p.assets){id(a.id);requireValue(["video","image","audio","recording"].includes(a.kind)&&typeof a.name==="string"&&integer(a.durationUs)&&a.durationUs>0&&integer(a.width)&&integer(a.height),"Invalid asset");if(a.kind==="recording"){const pkg=p.packages.find(r=>r.id===a.packageId);requireValue(pkg&&a.durationUs===pkg.durationUs,"Invalid recording asset reference");}else source(a.source,true);}
 for(const c of p.compositions){id(c.id);const pkg=p.packages.find(r=>r.id===c.packageId);requireValue(pkg&&integer(c.durationUs)&&c.durationUs>0&&integer(c.revision)&&Array.isArray(c.timeMap)&&c.timeMap.length>0,"Invalid composition");let end=0;for(const s of c.timeMap){requireValue(integer(s.outputStartUs)&&s.outputStartUs===end&&integer(s.outputEndUs)&&s.outputEndUs>s.outputStartUs&&integer(s.sourceStartUs)&&positive(s.rate),"Invalid composition clock");requireValue(s.sourceStartUs+(s.outputEndUs-s.outputStartUs)*s.rate<=pkg.durationUs+1,"Composition exceeds recording");end=s.outputEndUs;}requireValue(end===c.durationUs,"Composition duration mismatch");serializable(c.settings);}
 for(const t of p.tracks){id(t.id);requireValue(["visual","audio"].includes(t.kind)&&Array.isArray(t.clips)&&[t.locked,t.muted,t.hidden].every(v=>typeof v==="boolean"),"Invalid track");let end=0;for(const c of [...t.clips].sort((a,b)=>a.startUs-b.startUs)){id(c.id);const a=p.assets.find(a=>a.id===c.assetId);requireValue(a,"Missing clip asset");requireValue((t.kind==="audio")===(a.kind==="audio"),"Incompatible asset track");const composition=c.compositionId?p.compositions.find(e=>e.id===c.compositionId):undefined;requireValue(a.kind!=="recording"||(composition&&composition.packageId===a.packageId),"Missing clip composition");requireValue(a.kind==="recording"||!c.compositionId,"Unexpected clip composition");const duration=composition?.durationUs??a.durationUs;requireValue(integer(c.startUs)&&integer(c.sourceInUs)&&integer(c.sourceOutUs)&&c.sourceOutUs>c.sourceInUs&&c.sourceOutUs<=duration&&positive(c.rate)&&c.rate>=0.125&&c.rate<=8&&clipDurationUs(c)>0,"Invalid clip clock or rate");requireValue(c.startUs>=end,"Clip overlap on track");end=c.startUs+clipDurationUs(c);requireValue(Number.isSafeInteger(end),"Unsafe clip end");requireValue(c.transform&&Object.values(c.transform).every(v=>typeof v==="number"&&Number.isFinite(v))&&c.transform.scale>0&&c.transform.opacity>=0&&c.transform.opacity<=1&&typeof c.gain==="number"&&Number.isFinite(c.gain)&&c.gain>=0&&typeof c.enabled==="boolean","Invalid clip transform/gain");}}
 return p;
}
