import type { TimelineProject } from "./types";
import { validateTimelineProject } from "./validation";
export type ProjectCommand=(project:TimelineProject)=>TimelineProject;
interface Snapshot { project:TimelineProject;selection:string[] }
export function validSelection(project:TimelineProject,selection:string[]):string[] {const ids=new Set(project.tracks.flatMap(t=>t.clips.map(c=>c.id)));return selection.filter(id=>ids.has(id));}
export class ProjectHistory {
 private current:Snapshot;
 private past:Snapshot[]=[];
 private future:Snapshot[]=[];
 constructor(project:TimelineProject){this.current={project:structuredClone(validateTimelineProject(project)),selection:[]};}
 get project(){return this.current.project;}
 get selection(){return this.current.selection;}
 get canUndo(){return this.past.length>0;}
 get canRedo(){return this.future.length>0;}
 get undoCount(){return this.past.length;}
 select(selection:string[]):void {this.current={...this.current,selection:validSelection(this.project,selection)};}
 execute(command:ProjectCommand,selection=this.selection):TimelineProject {
  const next=command(this.project);if(next===this.project)return next;validateTimelineProject(next);
  this.past.push(this.current);if(this.past.length>100)this.past.shift();this.future=[];
  this.current={project:next,selection:validSelection(next,selection)};return next;
 }
 undo():TimelineProject {const previous=this.past.pop();if(previous){this.future.push(this.current);this.current={...previous,selection:validSelection(previous.project,previous.selection)};}return this.project;}
 redo():TimelineProject {const next=this.future.pop();if(next){this.past.push(this.current);this.current={...next,selection:validSelection(next.project,next.selection)};}return this.project;}
}
