import { useEffect, useRef } from "react";
import { registerRecording } from "@/core/timeline/commands";
import { ProjectSession } from "@/core/timeline/projectSession";
import type { TimelineProject } from "@/core/timeline/types";
import type { CompletedRecording } from "@/recording/types";
import { completedRecordingFromSession } from "@/recording/completedRecording";

interface RecordingAssetOptions {
 getProject:()=>TimelineProject;
 update:(next:TimelineProject)=>void;
 onError:(error:unknown)=>void;
 probe?:(input:CompletedRecording)=>Promise<void>;
 ids?:()=>{assetId:string;packageId:string};
}
export class RecordingAssetController {
 private session=new ProjectSession();
 constructor(private options:RecordingAssetOptions){}
 beginProject(projectId:string):number { return this.session.beginProject(projectId); }
 isCurrent(generation:number,projectId?:string):boolean { return this.session.isCurrent(generation,projectId); }
 async acceptCompleted(generation:number,input:CompletedRecording):Promise<void> {
  const projectId=this.options.getProject().projectId;
  if(!this.session.isCurrent(generation,projectId))return;
  try {
   if(this.options.getProject().packages.some(p=>p.captureId===input.captureId))return;
   await this.options.probe?.(input);
   if(!this.session.isCurrent(generation,projectId))return;
   const current=this.options.getProject();if(current.projectId!==projectId)return;
   const ids=this.options.ids?.()??{assetId:crypto.randomUUID(),packageId:crypto.randomUUID()};
   const next=registerRecording(current,input,ids);if(next!==current)this.options.update(next);
  } catch(error) {if(this.session.isCurrent(generation,projectId))this.options.onError(error);}
 }
 dispose():void {this.session.dispose();}
}

/** Only events with provenance from a capture armed by this project are accepted. */
export function useRecordingAssets(projectId:string,options:RecordingAssetOptions) {
 const latest=useRef(options);latest.current=options;
 const controller=useRef<RecordingAssetController>();
 if(!controller.current)controller.current=new RecordingAssetController({getProject:()=>latest.current.getProject(),update:p=>latest.current.update(p),onError:e=>latest.current.onError(e)});
 const generation=useRef(0),captures=useRef(new Map<string,number>());
 useEffect(()=>{generation.current=controller.current!.beginProject(projectId);},[projectId]);
 useEffect(()=>{
  const unsubscribe=window.electronAPI?.onRecordingSessionChanged?.(session=>{
   if(!session?.captureId||!session.projectId)return;
   const ownerGeneration=captures.current.get(session.captureId)??generation.current;
   if(!controller.current!.isCurrent(ownerGeneration,session.projectId))return;
   captures.current.set(session.captureId,ownerGeneration);
   void completedRecordingFromSession(session).then(input=>controller.current!.acceptCompleted(ownerGeneration,input)).catch(error=>{if(controller.current!.isCurrent(ownerGeneration,session.projectId))latest.current.onError(error);});
  });
  return ()=>{unsubscribe?.();controller.current!.dispose();};
 },[]);
 return {prepareCapture:()=>{const captureId=crypto.randomUUID();captures.current.set(captureId,generation.current);return {captureId,projectId};}};
}
