import { useRef, useSyncExternalStore } from "react";
import { ProjectHistory, type ProjectCommand } from "@/core/timeline/history";
import { ProjectSession } from "@/core/timeline/projectSession";
import { projectDurationUs, type TimelineProject } from "@/core/timeline/types";
import { validateTimelineProject } from "@/core/timeline/validation";
import { TimelinePersistence, type SaveProject } from "./useTimelinePersistence";
export interface ProjectControllerState {project:TimelineProject;revision:number;savedRevision:number;path:string|null;dirty:boolean;selection:string[];selectedAssetId:string|null;playheadUs:number;canUndo:boolean;canRedo:boolean;saving:boolean;openingKey:number}
export class ProjectController {
 private history:ProjectHistory;
 private persistence:TimelinePersistence;
 private listeners=new Set<()=>void>();
 private importSession=new ProjectSession();
 private generation:number;
 private state:ProjectControllerState;
 constructor(project:TimelineProject,save:SaveProject) {
  this.history=new ProjectHistory(project);this.generation=this.importSession.beginProject(project.projectId);
  this.state={project:this.history.project,revision:0,savedRevision:0,path:null,dirty:false,selection:[],selectedAssetId:null,playheadUs:0,canUndo:false,canRedo:false,saving:false,openingKey:0};
  this.persistence=new TimelinePersistence({save,onSaved:(revision,path,saved)=>{
   if(saved.projectId!==this.state.project.projectId){
    // Save As changes identity after success while keeping edits made during saving.
    this.history=new ProjectHistory({...this.history.project,projectId:saved.projectId});this.generation=this.importSession.beginProject(saved.projectId);this.persistence.beginProject(saved.projectId);
   }
   this.publish({savedRevision:revision,path});
  }});this.persistence.beginProject(project.projectId);
 }
 get snapshot():ProjectControllerState{return this.state;}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
 private publish(patch:Partial<ProjectControllerState>={}):void {this.state={...this.state,...patch,project:this.history.project,selection:this.history.selection,canUndo:this.history.canUndo,canRedo:this.history.canRedo};this.state.dirty=this.state.revision!==this.state.savedRevision;for(const listener of this.listeners)listener();}
 execute(command:ProjectCommand,selection?:string[]):void {const previous=this.history.project;this.history.execute(command,selection);if(previous!==this.history.project)this.publish({revision:this.state.revision+1});}
 select(selection:string[]):void {this.history.select(selection);this.publish({selectedAssetId:null});}
 preview(assetId:string|null):void {if(assetId&&!this.history.project.assets.some(a=>a.id===assetId))return;this.publish({selectedAssetId:assetId});}
 seek(timeUs:number):void {this.publish({playheadUs:Math.max(0,Math.min(projectDurationUs(this.history.project),Math.round(timeUs)))});}
 undo():void {if(!this.history.canUndo)return;this.history.undo();this.publish({revision:this.state.revision+1});}
 redo():void {if(!this.history.canRedo)return;this.history.redo();this.publish({revision:this.state.revision+1});}
 open(project:TimelineProject,path:string|null):void {this.history=new ProjectHistory(validateTimelineProject(project));this.generation=this.importSession.beginProject(project.projectId);this.persistence.beginProject(project.projectId);this.publish({revision:0,savedRevision:0,path,selectedAssetId:null,playheadUs:0,saving:false,openingKey:this.state.openingKey+1});}
 importToken():{generation:number;projectId:string} {return {generation:this.generation,projectId:this.state.project.projectId};}
 acceptImport(token:{generation:number;projectId:string},command:ProjectCommand):boolean {if(!this.importSession.isCurrent(token.generation,token.projectId))return false;this.execute(command);return true;}
 async save(saveAs=false):Promise<import("./useTimelinePersistence").ProjectSaveResult> {
  const generation=this.generation;const project=saveAs?{...this.history.project,projectId:crypto.randomUUID()}:this.history.project;
  this.publish({saving:true});try{return await this.persistence.save(project,this.state.revision,this.state.path,saveAs);}finally{if(generation===this.generation||this.state.project.projectId===project.projectId)this.publish({saving:false});}
 }
 dispose():void {this.persistence.dispose();this.importSession.dispose();this.listeners.clear();}
}
export function useProjectController(initial:TimelineProject) {
 const controller=useRef<ProjectController>();if(!controller.current)controller.current=new ProjectController(initial,(project,title,path)=>window.electronAPI.saveProjectFile(project,title,path));
 const state=useSyncExternalStore(controller.current.subscribe,()=>controller.current!.snapshot,()=>controller.current!.snapshot);
 return {controller:controller.current,state};
}
