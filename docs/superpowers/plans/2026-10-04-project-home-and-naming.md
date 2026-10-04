# Project Home and File Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Preserved method: native execution in this session and Experiment checkout, with one fresh whole-change review at the end. Steps use checkbox syntax for tracking.

**Goal:** Launch into Home, open/create projects into Editor, and keep displayed names and save destinations consistent through Rename and Save As.

**Architecture:** A main-window shell owns navigation and one active project controller. Reuse WelcomeScreen and the file library; extract bootstrap from ProjectEditor. Shared naming contracts and a serialized Electron file service provide verified save outcomes and recoverable Rename transactions.

**Tech Stack:** React 18, TypeScript, Electron, Vitest; existing V3 bundler and browser verification tooling. No new dependencies.

**Spec:** `../specs/2026-10-04-project-home-and-naming-design.md` (user-approved).

## Global Constraints

- Home and Editor occupy the same main window. Home has no synthetic active project, capture identity, or silent save target.
- Normal startup shows Home. Explicit OS-file/capture-restoration intents retain their owning project and bypass Home only after validation.
- Saved display name is the exact path basename including `.captr`; internal title excludes the extension. Unsaved display is Untitled.
- Rename preserves identity and retires the old filename only on success. Save As creates a new identity, preserves the original bundle, and activates the copy only on success.
- Cancel/failure/stale results never change active naming/path/identity or clear unsaved revisions. Undo/redo does not undo committed filenames.
- Preserve V3 `project.json`, all Assets including unused recording sidecars, independent compositions, integer-microsecond clocks, and Assets-only recording completion.
- Active capture/finalization, export, and file transactions block switching until completed/canceled through their existing controls.
- No Slide runtime, separate recorder editing windows, removed sidebar panels, or direct Home Record action.
- No dependencies, merge, push, or deletion of untracked/user files. Native Windows QA must be exercised before claiming native fidelity.

## Review Focus

1. A different file appears at the Rename destination after staging: reject publication without overwriting it (Task 2).
2. Rename completes but recent-index persistence fails: report the committed new path accurately and reconcile the list rather than restoring a false old path (Task 3).
3. An undo snapshot contains the old title after Save As or Rename: identity/title stay aligned with the active file (Task 4).
4. A project-open intent arrives while Home is still bootstrapping or an old capture/import finishes after leaving: consume once and reject stale ownership (Task 5).
5. A dirty Save reports success but newer edits exist: Back to Home stays in Editor and keeps those edits (Tasks 4/5).

## File Structure and Contracts

- `src/core/project/projectNames.ts`: cross-platform basename/title/name validation; no React/Electron imports.
- `src/core/project/fileOperationTypes.ts`: renderer/preload/backend request and result contracts.
- `electron/ipc/project/projectFileQueue.ts`: one serialized queue for file and active-session transitions.
- `electron/ipc/project/projectRenameTransaction.ts`: exclusive destination publication, original retirement, rollback/recovery.
- `electron/ipc/project/projectFileService.ts`: staged V3 save/Save As/Rename, identity checks, successful session/index updates.
- `src/components/editor/projectNavigation.ts`: pure startup/exit coordination; no second project store.
- `src/components/editor/ProjectApplication.tsx`: main-window boot/Home/Editor shell and active controller lifetime.
- `src/components/editor/useHomeProjects.ts`: cancellable library refresh and loading/error state.
- `src/components/editor/ProjectNameDialog.tsx`: draft name and file-operation choices.

Shared definitions in `fileOperationTypes.ts`:

```ts
type ProjectFileIntent = "save" | "save-as" | "rename";
interface ProjectFileRequest {
  operationId: string;
  ownerProjectId: string;
  generation: number;
  revision: number;
  expectedPath: string | null;
  intent: ProjectFileIntent;
  project: TimelineProject;
  name?: string;
  thumbnailDataUrl?: string | null;
}
type ProjectFileResult =
  | { success: true; operationId: string; generation: number; revision: number;
      path: string; projectId: string; title: string; warning?: string }
  | { success: false; operationId: string; canceled?: boolean; error?: string };
type ProjectPersistencePort = (request: ProjectFileRequest) => Promise<ProjectFileResult>;
```

`ownerProjectId` authorizes the original active session; Save As `project.projectId` is its new copy identity. Backend treats IPC as untrusted input and validates both identity and expected path. Generation/revision are echoed only for renderer ownership checks.

## Task 1: Naming and file-operation contracts

**Files:** Create `src/core/project/{projectNames,fileOperationTypes}.ts`, `projectNames.test.ts`; modify `src/core/timeline/history.ts:37-48` only if normalization needs a shared import; test existing `history.test.ts`.

**Interfaces:** Produce `projectFileName(path:string|null):string`, `projectTitleFromPath(path:string):string`, `validateProjectBaseName(input:string):string` (throws on invalid input), and Task-header types. Existing `ProjectHistory.setTitle(title)` already updates current/past/future; preserve this behavior.

- [x] Write `projectNames.test.ts`: `projectFileName(null) === "Untitled"`; both `C:\\Projects\\Tutorial.captr` and `/projects/Tutorial.captr` produce `Tutorial.captr`; stale internal titles are irrelevant; `validateProjectBaseName("Demo.captr") === "Demo"`; Unicode/spaces accepted; empty, separators, `.`, `..`, Windows-invalid characters, reserved device names including extensions, trailing spaces/dots rejected.
- [x] Include `it("rejects a Windows device name rather than silently changing it", () => expect(() => validateProjectBaseName("CON.captr")).toThrow())` and `it("preserves Unicode names", () => expect(validateProjectBaseName("Tutorial 日本語.captr")).toBe("Tutorial 日本語"))`.
- [x] Run focused naming tests; require missing-export failures before implementation.
- [x] Implement the pure helpers and request/result types. Strip one terminal extension case-insensitively; retain actual basename case for display; do not silently sanitize invalid names into another name.
- [x] Run naming/history tests and TypeScript; require no new failures.
- [x] Commit `feat(project): define file naming and operation contracts`.

Focused command: `npm test -- --configLoader runner --pool forks --maxWorkers 1 src/core/project/projectNames.test.ts src/core/timeline/history.test.ts`.

## Task 2: Recoverable Rename transaction

**Files:** Create `electron/ipc/project/{projectFileQueue,projectRenameTransaction}.ts` and tests; consume `projectBundle.ts:33-61,286-412` without changing its overwrite semantics for ordinary Save.

**Interfaces:** Produce `enqueueProjectFileOperation<T>(job:()=>Promise<T>):Promise<T>`; `renameProjectBundle(input:{operationId:string;originalPath:string;destinationPath:string;projectId:string;writeCandidate:(candidatePath:string)=>Promise<void>},options?:RenameTransactionOptions):Promise<{path:string}>`; `recoverProjectRenameTransactions():Promise<{warnings:string[];blockedPaths:string[]}>`. `RenameTransactionOptions={platform?:NodeJS.Platform;fault?:(point:"after-stage"|"before-publish"|"before-retire"|"after-retire")=>Promise<void>}` permits deterministic failure/race injection; real temporary files exercise filesystem operations. Recovery journals live in a fixed app user-data subdirectory, contain schema version, unique operation ID, same-directory paths, project ID, source/candidate hashes, and phase (`staged`, `published`, `retired`).

- [x] Write real-bundle tests: rename `Tutorial.captr` to `Demo.captr`, identity unchanged and updated title; original absent only after success; sidecar bytes survive; untouched collision and late collision; unchanged name no-op; case-only rename tested with Windows comparison and exercised natively later; write/publication/retirement failure retains original and removes only attributable temporaries; another process replaces/modifies a candidate -> preserve it and report ambiguous recovery.
- [x] Write recovery tests with journal phase fixtures for staged-only, destination-published, original-retired, and case-only intermediate states. Reject malformed journals, outside-directory paths, identity/hash mismatches, and transaction files not attributable to the journal. Repeated recovery is idempotent.
- [x] Run transaction/queue tests RED. Queue test asserts two jobs never overlap, order is preserved, and rejection does not poison the next job.
- [x] Implement same-directory candidate staging using `packProjectWorkspace` against a unique candidate path. Validate bundle/identity/title and hash before publication. Publish different-name destinations using an exclusive filesystem operation (`fs.link` from candidate -> destination); do not use overwrite-capable rename for collision publication. If the filesystem lacks this capability, reject Rename without touching the source; Save As remains available.
- [x] Implement journaled retirement/rollback. Revalidate original identity/hash before retirement. Case-only Rename uses a journaled unique backup/intermediate on the same volume; failed steps recover the old spelling/content. Recovery validates all journal paths against the recorded original directory and never recursively removes directories or deletes foreign bytes. Persist phase transitions before the corresponding destructive boundary; reconcile using actual hashes/files, not phase alone.
- [x] Run real-bundle/queue/recovery tests GREEN plus TypeScript. Commit `feat(project): add recoverable bundle rename transactions`.

Focused command: `npm test -- --configLoader runner --pool forks --maxWorkers 1 electron/ipc/project/projectRenameTransaction.test.ts electron/ipc/project/projectFileQueue.test.ts`.

## Task 3: Verified Electron file service and IPC

**Files:** Create `electron/ipc/project/projectFileService.ts` and tests; modify `electron/ipc/register/project/{save,load,session,index}.ts`, `electron/ipc/project/{manager,recordingContext}.ts`, `electron/preload.ts:749-804`, `electron/electron-env.d.ts:734-800`; extend owning save/load/session tests.

**Interfaces:** Produce `performProjectFileOperation(request:ProjectFileRequest):Promise<ProjectFileResult>`; preload `operateTimelineProjectFile(request)`; preload `deactivateTimelineProject(expectedProjectId:string):Promise<{success:boolean;error?:string}>`; preload `getTimelineProjectActivity(expectedProjectId:string):Promise<{recording:boolean;finalizing:boolean}>` derives activity from existing native/browser recording state, not from whether a completed session remains in memory. Add `replaceRecentProjectPath(oldPath:string,newPath:string):Promise<void>` to manager. New deactivate IPC verifies ownership and no capture/finalization, then clears active recording ID, path, video/session, and unsaved-close flag; no synthetic identity. Preserve specialized HUD/session APIs.

- [x] Write service/IPC tests: rename verifies active bundle ID/path before mutation; saved filename/title always agree; Save As identity differs and cannot target original through case/realpath/hardlink aliases; canceled dialog leaves original and context unchanged; whole unused-asset library staged; rename index replacement versus Save As retains both; index-write failure after commit returns success with committed path and warning; unauthorized renderer paths and stale owner fail.
- [x] Add tests that failed library directory reads produce explicit failures, missing recent files remain safely omitted, and native/dialog-selected paths remain valid existing read-authorized paths. Recovery executes before library listing or project opening; unresolved recovery blocks affected opens and surfaces warnings without deleting files.
- [x] Run owning Electron tests RED. Implement the service by extracting current validated V3 staging and dialog logic from save.ts; keep conversion-copy safeguards and legacy rejection. Run Save, Save As, Rename and session-changing load/activate/deactivate through the same Task 2 queue without recursively enqueueing a job that awaits itself.
- [x] Add IPC/preload/type wiring using the exact request/result contract. Validate request shape and source ownership server-side. Preserve old `saveProjectFile` as a compatibility wrapper, queued by the same service; explicit conversion copy also uses the shared queue. Existing low-level helpers must not mutate current path before service success.
- [x] Commit authoritative path/context immediately after a verified file commit; repair recent-index failures using a pending index update record on the next refresh. Do not roll back an already committed path because remembering recents failed. Return explicit title in successful results.
- [x] Run service and all owning project tests plus TypeScript. Commit `feat(project): expose verified save rename and session operations`.

Focused command: `npm test -- --configLoader runner --pool forks --maxWorkers 1 electron/ipc/project/projectFileService.test.ts electron/ipc/register/project electron/ipc/project/recordingContext.test.ts`.

## Task 4: Controller naming, persistence and history

**Files:** Modify `src/components/editor/{useProjectController,useTimelinePersistence}.ts`, matching tests, `src/core/timeline/history.test.ts`; create/update a controller factory in `useProjectController.ts`. Consumers updated in Task 5.

**Interfaces:** `ProjectController(project:TimelineProject,persist:ProjectPersistencePort)`; `createProjectController(project:TimelineProject):ProjectController` wires the IPC port; `controller.save(saveAs?:boolean,name?:string):Promise<ProjectFileResult>`; `controller.rename(name:string):Promise<ProjectFileResult>`; `controller.exit():void` invalidates pending work/disposes after backend deactivation; `useProjectController(controller:ProjectController)` subscribes to the supplied controller. `TimelinePersistence.run(request:ProjectFileRequest):Promise<ProjectFileResult>` retains one immutable snapshot queue and session ownership checks. State adds `fileOperation:"save"|"save-as"|"rename"|null`; existing saving/revision/selection fields remain.

- [x] Write tests: open file with nondefault stale title normalizes without dirtying; Save/Save As/rename success always normalize filename/title across all history snapshots; undo/redo preserves committed name and identity; rename retains selection/playhead; returned owner/operation/revision mismatch cannot install path; failure/cancel retains state; revisions edited after ordinary Save remain dirty; exit invalidates delayed save/import results.
- [x] Run controller/persistence/history tests RED. Replace default-title-only fallbacks with Task 1 helpers; derive visible filename from path rather than internal title. Apply result title through `history.setTitle`, identity through `reidentify`, and path/revision only from verified successful ownership. An unchanged rename is a no-op without a history entry.
- [x] Implement queued controller methods; new identity created only for Save As snapshots. Block commands during Rename/Save As commit; suspend pending async project mutations until completion, then recheck generation before applying. Ordinary Save preserves existing newer-edit behavior. Saved naming cannot be rewritten by old queued snapshots; construct the commit snapshot from the current active naming while preserving the captured content/revision.
- [x] Run controller/persistence/history suites GREEN and TypeScript. Commit `feat(editor): synchronize file identity names and history`.

Focused command: `npm test -- --configLoader runner --pool forks --maxWorkers 1 src/components/editor/useProjectController.test.ts src/components/editor/useTimelinePersistence.test.ts src/core/timeline/history.test.ts`.

## Task 5: Main-window lifecycle and navigation

**Files:** Create `src/components/editor/{projectNavigation.ts,projectNavigation.test.ts,ProjectApplication.tsx,ProjectApplication.test.tsx}`; modify `src/App.tsx:13-88`, `src/components/editor/ProjectEditor.tsx`, `src/components/editor/projectLifecycle.ts`, `projectLifecycle.test.ts`, and `electron/main.ts:256-360,920-1004` only if screen mode/startup logic requires a change.

**Interfaces:** `resolveApplicationBootstrap(api:ApplicationLifecycleApi):Promise<ApplicationBootstrap>` with tagged results `{kind:"home"}`, `{kind:"project";result:ProjectOpenResult;recordingSession?:RecordingSessionData}`, `{kind:"recording";session:RecordingSessionData}`, `{kind:"error";error:string}`. Normal launch never reloads a previous path absent explicit open/capture intent. `requestProjectExit(controller:ProjectController,decision:"save"|"discard"|"cancel",api:ApplicationLifecycleApi):Promise<boolean>` returns true only after dirty guard and successful deactivation. `ProjectEditorProps={controller:ProjectController;recordingSession?:RecordingSessionData|null;onRequestHome:()=>void;onProjectChanged:()=>void}`; no duplicate bootstrap in ProjectEditor.

`ApplicationLifecycleApi` is the subset of `Window["electronAPI"]` containing `consumePendingProjectOpen`, `loadCurrentProjectFile`, `openProjectFileAtPath`, `getCurrentRecordingSession`, `getTimelineProjectActivity`, `activateTimelineProject`, and `deactivateTimelineProject`. Define it and `ApplicationBootstrap` in projectNavigation.ts. Export/renderer busy state is checked before invoking the pure exit coordinator; the coordinator also checks controller file-operation and backend activity. A restored capture with a saved path verifies matching project identity before attaching the session.

- [x] Write startup/navigation tests: normal startup -> Home with zero activation/load-current calls; cold/warm OS open -> validated Editor; explicit recording restoration keeps original identity/path and enters Assets once; failed/rejected opens stay Home; late events after exit rejected; Save/Discard/Cancel, failed/canceled save, and newer revisions during save; active capture/finalization/export/rename blocks switching.
- [x] Add a queued-open test: an OS open during bootstrap is consumed once and has precedence over showing Home; a later intent while editing goes through the existing dirty guard. Add close/menu tests so Home Ctrl+S does not create a hidden project and Editor close remains guarded.
- [x] Run navigation/lifecycle tests RED. Move startup/open intent coordination and controller lifetime into ProjectApplication; initialize no controller while Home. Keep project-open listeners at shell level; recording listeners attach once to the active controller and dispose/invalidate only after successful exit.
- [x] Implement deactivation after guard, pause/unmount source playback, dispose the exited controller, then refresh Home. Handle legacy convert-as-copy as an application-level dialog usable on Home and Editor; cancellation/failure preserves the prior screen/session/original file. Keep existing controller-bound close guard in Editor and clear it on Home.
- [x] Mount ProjectApplication only for normal/editor App routes; preserve every specialized window route. Route native menus and shortcuts to the visible screen. Run App/navigation/lifecycle/controller and recording asset suites plus TypeScript. Commit `feat(app): add home and editor project navigation`.

Focused command: `npm test -- --configLoader runner --pool forks --maxWorkers 1 src/components/editor/projectNavigation.test.ts src/components/editor/ProjectApplication.test.tsx src/components/editor/projectLifecycle.test.ts src/components/editor/useRecordingAssets.test.ts`.

## Task 6: Home surface and project-name dialog

**Files:** Create `src/components/editor/{useHomeProjects.ts,useHomeProjects.test.ts,ProjectNameDialog.tsx,ProjectNameDialog.test.tsx}`, `src/components/welcome/WelcomeScreen.test.tsx`; modify `src/components/welcome/{WelcomeScreen,ProjectCard}.tsx`, `src/components/editor/{ProjectApplication,ProjectEditor}.tsx`, `projectEditor.css`, `useProjectMessages.ts`, and locale JSON files for new visible copy.

**Interfaces:** `useHomeProjects(enabled:boolean):{entries:ProjectLibraryEntry[];loading:boolean;error:string|null;refresh:()=>Promise<void>}`; `ProjectNameDialog({fileName:string,draftName:string,saved:boolean,busy:boolean,error:string|null,onDraftChange:(name:string)=>void,onRename:()=>void,onSaveAs:()=>void,onSave:()=>void,onClose:()=>void})`. Existing WelcomeScreen props gain loading/error/refresh state and lose required recorder action from this surface; ProjectCard reveal/delete callbacks remain optional, with unsupported actions hidden. Settings reuses the existing dialog.

- [x] Write Home tests: empty/loading/error are distinct; current directory + recent external entries search/open correctly; removed-since-listed file errors without entering Editor; stale refresh does not replace newer data. Test New/Open, accessible cards, and no direct Home Record button.
- [x] Write dialog tests: saved file shows Rename Project/Save As/Cancel with fixed `.captr`; unsaved shows Save Project/Cancel; validation prevents invalid drafts; opening/canceling never dirties project; Escape/focus trap; no editor shortcuts while modal focused; rename collision explains choosing another name; Save As cancel stays in Editor with original name.
- [x] Run Home/dialog tests RED. Reuse existing WelcomeScreen/cards with coherent dark styling, responsive grid, path hints and neutral thumbnail fallback. Replace the direct-mutation project-title input with a filename button opening the draft dialog; wire Task 4 methods and display committed filenames in both main and recording sub-editor headers and OS document title.
- [x] Add Back to Home and its Save/Discard/Cancel dialog through Task 5. Disable competing navigation/file actions during operations; explicit refresh handles warnings and retry. Refresh library after success and on return; no phantom empty-project activation.
- [x] Run interaction/controller/navigation suites GREEN, locale check and TypeScript. Commit `feat(ui): add project home and rename save-as dialog`.

Focused command: `npm test -- --configLoader runner --pool forks --maxWorkers 1 src/components/editor/useHomeProjects.test.ts src/components/editor/ProjectNameDialog.test.tsx src/components/welcome/WelcomeScreen.test.tsx src/components/editor/projectNavigation.test.ts`. Use existing SSR/controller-test conventions where the repository has no DOM test environment; Task 7 runs actual browser event/focus interactions without installing packages.

## Task 7: Regression, browser/native QA and final review

**Files:** Extend `electron/ipc/register/project/{session,v3LifecycleVerification}.test.ts`, source controller/navigation integration tests, create `docs/verification/2026-10-04-project-home-and-naming.md`; update `ISSUE.md` and `AGENTS.md` naming/lifecycle contract in the implementation commit.

- [x] Add real-bundle integration tests: Rename -> Record twice -> Assets only -> Ctrl+S -> reopen at new path, complete sidecars; two independent placements survive Rename/Save As; Save As original bytes unchanged; unsupported conversion unchanged; index/recovery failures produce correct active filename and no deletion of unrelated files.
- [x] Run integration and affected export/recording suites; resolve new failures without disabling tests. Run fresh full suite, TypeScript, renderer/Electron Vite production build, locale check, diff whitespace, and `graft build`. Report known failures separately using fresh names/counts, not old totals.
- [x] Browser QA uses real Home/shell/dialog components at 1440x1000 and 1280x800 with deterministic IPC/bundle fixtures: startup, search, New/Open, stale-title filename, Home dirty guard, Rename/Save As cancel/success/error, long filenames, modal keyboard focus, and editing freeze during delayed Open. State exactly which native calls were mocked. Recording sub-editor entry/name/playback remains part of pending native QA, not a browser pass claim.
- [ ] Native Windows QA: normal startup/Explorer open; Unicode and case-only rename; existing-name/file-lock rejection; dirty Rename; repeated recording then Ctrl+S/save/reopen; Save As dialog original protection; Back to Home guard; close/relaunch with interrupted transaction. If native access is unavailable, list precise unverified items and do not mark them passed.
- [x] Update ISSUE.md/AGENTS.md to make filename authority, Home's inactive context, Rename identity, Save As separate identity, and preserved recording storage explicit. Commit `test(project): verify home naming and recording lifecycle`.
- [x] Request one fresh whole-change review against approved spec, plan, Review Focus and commit range. Fix Important/Critical findings with focused RED -> GREEN evidence. Preserve branch without merge/push.

## Verification Commands

Use existing repository scripts and current package configuration; no dependency installation. On this checkout Vitest currently needs the ESM config-loader workaround:

```powershell
$env:NODE_OPTIONS='--import=data:text/javascript,globalThis.__dirname=process.cwd()'
npm test -- --configLoader runner --pool forks --maxWorkers 1
.\node_modules\.bin\tsc.cmd --noEmit --pretty false
.\node_modules\.bin\vite.cmd build --config vite.config.ts
git diff --check
graft build
```

Each task's Focused command lists its owning tests. Missing-implementation failures prove RED; test completion with zero failures in that focused suite proves GREEN. Recheck the package's locale script before execution and compare baseline diagnostics rather than silently accepting new missing keys. The command above runs the complete suite without focused paths.

## Self-review and execution handoff

Coverage: Home and library T5/T6; startup/file-open/capture restoration T5; filename authority/history T1/T4/T6; file dialogs/identity T3/T6; Rename collision/recovery T2/T3; races/dirty guards T3/T4/T5; storage/native QA T7. All five Review Focus cases have named tests in their owning tasks. Shared request/result/naming interfaces are consistent across renderer, preload and Electron.

User approved and requested all tasks. Implementation executed in this session; native Windows QA remains explicitly pending. Final evidence and review are recorded in docs/verification/2026-10-04-project-home-and-naming.md.
