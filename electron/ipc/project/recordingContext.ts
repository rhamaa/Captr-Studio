export interface RecordingProjectContext { projectId?:string;captureId?:string }
let context:RecordingProjectContext={};
let activeProjectId:string|undefined;
export function setActiveRecordingProjectId(id:string):void {activeProjectId=id;}
export function getActiveRecordingProjectId():string|undefined {return activeProjectId;}
export function setRecordingProjectContext(next:RecordingProjectContext):void {context={projectId:next.projectId,captureId:next.captureId};}
export function getRecordingProjectContext():RecordingProjectContext {return {...context};}
