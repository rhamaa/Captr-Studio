/** One generation owns all pending capture/import work for an opened project. */
export class ProjectSession {
 private generation=0;
 private projectId:string|null=null;
 beginProject(projectId:string):number { this.projectId=projectId;return ++this.generation; }
 isCurrent(generation:number,projectId?:string):boolean { return this.projectId!==null&&generation===this.generation&&(!projectId||projectId===this.projectId); }
 dispose():void { this.projectId=null;++this.generation; }
}
