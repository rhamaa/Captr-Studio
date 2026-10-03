import { createDefaultRecordingSettings } from "@/recording/schema";
import type { CompletedRecording, RecordComposition, RecordingPackage, RecordingSettings } from "./types";
export function createRecordingPackage(input: CompletedRecording, id: string): RecordingPackage {
 return { ...structuredClone(input), id, schemaVersion: 1, settings: {...createDefaultRecordingSettings(),...structuredClone(input.settings)} };
}
export function compositionTimeMap(durationUs: number,settings: RecordingSettings) {
 const trims=settings.trimRegions??[],speeds=settings.speedRegions??[],durationMs=durationUs/1000;
 const boundaries=new Set([0,durationMs]);
 for(const region of [...trims,...speeds]){
  if(!Number.isFinite(region.startMs)||!Number.isFinite(region.endMs)||region.startMs<0||region.endMs<=region.startMs||region.endMs>durationMs)throw new Error("Invalid recording region range");
  boundaries.add(region.startMs);boundaries.add(region.endMs);
 }
 for(const region of speeds)if(!Number.isFinite(region.speed)||region.speed<0.125||region.speed>8)throw new Error("Invalid recording speed");
 const sorted=[...boundaries].sort((a,b)=>a-b),segments:Array<{startMs:number;endMs:number;speed:number}>=[];
 for(let i=0;i<sorted.length-1;i++){const startMs=sorted[i],endMs=sorted[i+1],mid=(startMs+endMs)/2;if(trims.some(r=>mid>=r.startMs&&mid<r.endMs))continue;segments.push({startMs,endMs,speed:speeds.find(r=>mid>=r.startMs&&mid<r.endMs)?.speed??1});}
 let outputUs=0;
 return segments.map(s=>{const start=outputUs;outputUs+=Math.round((s.endMs-s.startMs)*1000/s.speed);return {outputStartUs:start,outputEndUs:outputUs,sourceStartUs:Math.round(s.startMs*1000),rate:s.speed};});
}
export function createRecordComposition(pkg: RecordingPackage,id: string): RecordComposition {
 const timeMap=compositionTimeMap(pkg.durationUs,pkg.settings);
 if(!timeMap.length)throw new Error("Recording composition cannot be empty");
 return {id,packageId:pkg.id,revision:0,settings:structuredClone(pkg.settings),timeMap,durationUs:timeMap.at(-1)!.outputEndUs};
}
