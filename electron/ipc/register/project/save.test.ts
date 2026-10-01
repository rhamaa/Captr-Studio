import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTimelineProject, registerMedia } from "../../../../src/core/timeline/commands";
import { packProjectWorkspace, inspectProjectBundle } from "../../project/projectBundle";

const mock = vi.hoisted(() => ({ handlers: new Map<string, (...args:any[])=>Promise<any>>(), root: "", saveDialog: vi.fn(), trusted: false }));
vi.mock("electron",()=>({ app:{getPath:()=>mock.root,isPackaged:false},ipcMain:{handle:(name:string,handler:any)=>mock.handlers.set(name,handler)},dialog:{showSaveDialog:mock.saveDialog} }));
vi.mock("../../project/manager",()=>({getProjectsDir:async()=>mock.root,getProjectThumbnailPath:(p:string)=>`${p}.preview.png`,isTrustedProjectPath:()=>mock.trusted,loadRecentProjectPaths:async()=>[],rememberRecentProject:vi.fn(),saveRecentProjectPaths:vi.fn()}));
import { registerProjectSaveHandlers } from "./save";
import * as state from "../../state";
beforeEach(async()=>{mock.root=await fs.mkdtemp(path.join(os.tmpdir(),"captr-save-test-"));mock.trusted=false;mock.handlers.clear();mock.saveDialog.mockReset();mock.saveDialog.mockResolvedValue({canceled:true});state.setCurrentProjectPath(null);registerProjectSaveHandlers();});
afterEach(async()=>{if(path.dirname(path.resolve(mock.root))!==path.resolve(os.tmpdir()))throw new Error("Unsafe test cleanup");await fs.rm(mock.root,{recursive:true,force:true});});

it("serializes an unused asset and failure preserves the previous bundle and active path",async()=>{
 const source=path.join(mock.root,"video.mp4");await fs.writeFile(source,"original source");
 const project=registerMedia(createTimelineProject("same","Test"),{id:"a",kind:"video",name:"Video",durationUs:1_000_000,width:1280,height:720,source:{path:source,durationUs:1_000_000,offsetUs:0}});
 const target=path.join(mock.root,"test.captr");mock.saveDialog.mockResolvedValueOnce({filePath:target,canceled:false});
 const handler=mock.handlers.get("save-project-file")!;
 expect((await handler(null,project,"Test")).success).toBe(true);
 const inspection=await inspectProjectBundle(target);expect(inspection.projectData).toMatchObject({version:3,projectId:"same"});expect(inspection.projectData).not.toHaveProperty("slides");
 const bytes=await fs.readFile(target);await fs.rm(source);expect((await handler(null,project,"Test",target)).success).toBe(false);expect(await fs.readFile(target)).toEqual(bytes);expect(state.currentProjectPath).toBe(target);
});

it("checks project identity even when renderer supplied a trusted overwrite path",async()=>{
 const target=path.join(mock.root,"existing.captr"),workspace=path.join(mock.root,"workspace");await fs.mkdir(workspace);await fs.writeFile(path.join(workspace,"project.json"),JSON.stringify(createTimelineProject("old","Old")));await packProjectWorkspace(workspace,target);
 const bytes=await fs.readFile(target);mock.trusted=true;state.setCurrentProjectPath(target);
 const result=await mock.handlers.get("save-project-file")!(null,createTimelineProject("new","New"),"New",target);
 expect(result.success).toBe(false);expect(mock.saveDialog).toHaveBeenCalledOnce();expect(await fs.readFile(target)).toEqual(bytes);expect(state.currentProjectPath).toBe(target);
});
