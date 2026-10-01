import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
vi.mock("electron",()=>({app:{getPath:()=>os.tmpdir(),isPackaged:false}}));
vi.mock("../utils",()=>({normalizeVideoSourcePath:(p:string|null)=>p,parseJsonWithByteOrderMark:JSON.parse}));
import { persistRecordingSessionManifest, resolveRecordingSessionManifest } from "./session";
it("persists stable capture/project provenance even for screen-only recordings",async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"captr-manifest-"));
 try{const videoPath=path.join(root,"screen.mp4");await fs.writeFile(videoPath,"screen");const session={captureId:"capture",projectId:"project",videoPath,timeOffsetMs:0};await persistRecordingSessionManifest(session);expect(await resolveRecordingSessionManifest(videoPath)).toMatchObject(session);await persistRecordingSessionManifest(session);expect((await resolveRecordingSessionManifest(videoPath))?.captureId).toBe("capture");}
 finally{if(path.dirname(path.resolve(root))!==path.resolve(os.tmpdir()))throw new Error("Unsafe cleanup");await fs.rm(root,{recursive:true,force:true});}
});
