import type {RecordingSessionData} from "../../../electron/ipc/types";
import type {ProjectController} from "./useProjectController";
import type {PendingProjectOpen,ProjectOpenResult} from "./projectLifecycle";
export interface ApplicationLifecycleApi {
 consumePendingProjectOpen?:()=>Promise<PendingProjectOpen|null>;
 loadCurrentProjectFile?:()=>Promise<ProjectOpenResult>;
 openProjectFileAtPath?:(path:string)=>Promise<ProjectOpenResult>;
 getCurrentRecordingSession?:()=>Promise<{success:boolean;session?:RecordingSessionData|null}>;
 getTimelineProjectActivity?:(id:string)=>Promise<{recording:boolean;finalizing:boolean}>;
 activateTimelineProject?:(id:string,reset?:boolean)=>Promise<{success:boolean;error?:string}>;
 deactivateTimelineProject?:(id:string)=>Promise<{success:boolean;error?:string}>;
}
export type ApplicationBootstrap={kind:"home"}|{kind:"project";result:ProjectOpenResult;recordingSession?:RecordingSessionData}|{kind:"recording";session:RecordingSessionData}|{kind:"error";error:string};
async function pendingResult(api:ApplicationLifecycleApi,pending:PendingProjectOpen):Promise<ApplicationBootstrap>{
 const result=pending.result??(pending.path?await api.openProjectFileAtPath?.(pending.path):undefined);
 return result?.success ? {kind:"project",result} : {kind:"error",error:result?.error??result?.message??"Could not open project."};
}
export async function resolveApplicationBootstrap(api:ApplicationLifecycleApi):Promise<ApplicationBootstrap>{
 try {
  const pending=await api.consumePendingProjectOpen?.(); if(pending) return pendingResult(api,pending);
  const completed=await api.getCurrentRecordingSession?.();
  // An OS intent arriving while capture restoration awaits takes precedence.
  const late=await api.consumePendingProjectOpen?.(); if(late) return pendingResult(api,late);
  const session=completed?.success?completed.session:null;
  if(!session?.captureId||!session.projectId) return {kind:"home"};
  const result=await api.loadCurrentProjectFile?.();
  if(result?.success){
   if((result.project as {projectId?:string})?.projectId!==session.projectId) return {kind:"error",error:"Recording belongs to a different project. Reopen its original project."};
   return {kind:"project",result,recordingSession:session};
  }
  if(result?.error) return {kind:"error",error:result.error};
  return {kind:"recording",session};
 }catch(error){return {kind:"error",error:String(error)};}
}
export async function projectCanSwitch(controller:ProjectController,api:ApplicationLifecycleApi):Promise<boolean>{
 if(controller.snapshot.fileOperation) return false;
 const activity=await api.getTimelineProjectActivity?.(controller.snapshot.project.projectId);
 return !activity?.recording&&!activity?.finalizing&&!controller.snapshot.fileOperation;
}
export async function requestProjectExit(controller:ProjectController,decision:"save"|"discard"|"cancel",api:ApplicationLifecycleApi):Promise<boolean>{
 if(decision==="cancel"||!await projectCanSwitch(controller,api)) return false;
 if(controller.snapshot.dirty&&decision==="save"){
  const saved=await controller.save(); if(!saved.success||controller.snapshot.dirty) return false;
 }
 if(!await projectCanSwitch(controller,api)) return false;
 const result=await api.deactivateTimelineProject?.(controller.snapshot.project.projectId);
 if(result&&!result.success) return false;
 controller.exit(); return true;
}
