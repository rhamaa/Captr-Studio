export interface RecordingProjectContext { projectId?:string;captureId?:string }
let context:RecordingProjectContext={};
export function setRecordingProjectContext(next:RecordingProjectContext):void {context={projectId:next.projectId,captureId:next.captureId};}
export function getRecordingProjectContext():RecordingProjectContext {return {...context};}
