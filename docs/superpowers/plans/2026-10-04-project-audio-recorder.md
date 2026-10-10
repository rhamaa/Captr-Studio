# Project Audio Recorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record independent microphone voiceovers in Project Editor, keep every take in the V3 Asset Library, and place an editable audio clip at the playhead where recording started.

**Architecture:** A recorder session owns browser audio capture and emits a finalized Blob. Electron persists temporary voiceover media in an approved app-owned directory; a ProjectEditor adapter probes it, registers an ordinary V3 audio Asset, then creates a separate timeline placement. Existing `.captr` staging owns the file under `assets/<assetId>/`; project generation guards prevent late completion from crossing project boundaries.

**Tech Stack:** React 18, TypeScript, Electron IPC, Vitest, existing MediaRecorder, `probeMedia`, V3 project controller and bundle persistence. No new package dependency.

**Spec:** `../specs/2026-10-04-project-audio-recorder-design.md`

## Global Constraints

- Capture microphone audio only; do not start screen, webcam, Recorder HUD, or system-audio capture.
- Anchor placement to the integer-microsecond playhead value captured at record start, even while preview advances.
- Register the audio Asset as a distinct history change before placing the timeline clip; undo placement preserves the Asset.
- Keep project switching explicit while recording: finish and keep the take, discard it, or stay in the project.
- Temporary cleanup may delete only files under the app-owned `recordings/voiceovers` directory.
- Keep V3 `.captr` format and existing relative media ownership under `assets/<assetId>/`; stage Assets even when they have no timeline clip.
- Preserve V1/V2 conversion and the independent screen Record workflow.
- Before modifying save, autosave, or bundling implementation, read the Record regression checklist in `ISSUE.md` and update it if the media ownership contract changes.
- The current sandbox denies writes to `.git/index`; implementation changes remain uncommitted unless repository metadata write access becomes available.

## Review Focus

1. A take finishing after the active project changes must never register in the new project; clean up its temporary file. Test in Task 4.
2. Unsupported or mismatched MIME/extension and invalid cleanup paths must fail without touching unrelated files. Test in Task 2 and Task 3.
3. Occupied or locked audio tracks must not receive overlapping voiceover clips; create a new audio track. Test in Task 1.
4. Undoing placement must preserve the source Asset, and redo must restore the same clip ID. Test in Task 4.
5. An unplaced voiceover Asset must survive `.captr` save/reopen with playable media owned by its asset directory. Test in Task 5.

## File Responsibilities

- `src/core/timeline/voiceoverPlacement.ts`: pure placement command that chooses an available audio track or creates one.
- `src/recording/audioRecorder.ts`: microphone capture, metering, MIME selection, and stream lifecycle; no project mutations.
- `electron/ipc/project/recordedAudioFile.ts`: allowlisted file write and voiceovers-directory-only cleanup.
- `src/components/editor/useAudioRecordingAssets.ts`: guarded file finalization, probe, Asset registration, and separate placement history action.
- `src/components/editor/AudioRecorderDialog.tsx`: microphone picker, meter, timer, record/stop/discard, and navigation choice UI.
- `src/components/editor/ProjectEditor.tsx` and `AssetLibrary.tsx`: connect the dialog to preview, project actions, and the Record Audio button.

## Baseline

Before the first code change, run `npm test`, `npx tsc --noEmit`, and `npm run i18n:check`; record current failures so implementation results are compared against this checkout's actual baseline.

---

### Task 1: Place voiceovers on a valid audio track

**Files:**
- Create: `src/core/timeline/voiceoverPlacement.ts`
- Test: `src/core/timeline/voiceoverPlacement.test.ts`
- Uses: `src/core/timeline/{types,commands}.ts`

**Interfaces:**
- Consumes: `TimelineProject`, `MediaAsset`, `addTrack(p,id,kind)`, `placeAsset(project,assetId,trackId,startUs,ids)`, `clipDurationUs(clip)`.
- Produces: `placeVoiceover(project:TimelineProject, assetId:string, startUs:number, ids:{clipId:string;trackId:string}):TimelineProject`.

- [x] **Step 1: Write failing domain tests**

Test `placeVoiceover_usesFirstUnlockedAudioTrackWithFreeInterval`, `placeVoiceover_addsTrackWhenAudioTracksAreOccupiedOrLocked`, `placeVoiceover_addsTrackWhenNoAudioTrackExists`, `placeVoiceover_doesNotOverlapAnExistingClip`, and `placeVoiceover_rejectsMissingOrNonAudioAsset`. Assert the original project stays immutable and the returned project contains the clip at `startUs`.

- [x] **Step 2: Run tests and confirm the expected failures**

Run: `npm test -- src/core/timeline/voiceoverPlacement.test.ts`  
Expected: FAIL because `placeVoiceover` does not exist.

- [x] **Step 3: Implement `placeVoiceover`**

Choose the first unlocked audio track whose half-open interval does not intersect `[startUs, startUs + asset.durationUs)`. If no such track exists, call `addTrack` with `ids.trackId` and kind `audio`; then call `placeAsset` with `ids.clipId`. Reject invalid time and assets whose kind is not `audio`.

- [x] **Step 4: Run the domain tests**

Run: `npm test -- src/core/timeline/voiceoverPlacement.test.ts src/core/timeline/commands.test.ts`  
Expected: PASS; existing placement and track tests remain green.

- [ ] **Step 5: Commit**

```text
feat(timeline): place voiceovers on available audio tracks
```

### Task 2: Persist and safely discard temporary voiceover files

**Files:**
- Create: `electron/ipc/project/recordedAudioFile.ts`
- Test: `electron/ipc/project/recordedAudioFile.test.ts`
- Test: `electron/ipc/register/project/media.test.ts`
- Modify: `electron/ipc/register/project/media.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/electron-env.d.ts`

**Interfaces:**
- Consumes: current `save-recorded-audio` payload and `rememberApprovedLocalReadPath(filePath)`.
- Produces: `writeRecordedAudio(recordingsDir:string,payload:{audioBuffer:ArrayBuffer|Uint8Array|number[];extension?:string}):Promise<string>` and `discardRecordedAudioFile(recordingsDir:string,filePath:string):Promise<boolean>`; expose `window.electronAPI.discardRecordedAudio(filePath:string)`.

- [x] **Step 1: Write failing file-boundary tests**

Test `writeRecordedAudio_writesAllowlistedExtensionUnderVoiceovers`, `writeRecordedAudio_rejectsUnsupportedExtension`, `discardRecordedAudioFile_deletesOwnedTemporaryFile`, `discardRecordedAudioFile_rejectsOutsideVoiceovers`, and `discardRecordedAudioFile_rejectsTraversalAndSymlinkEscape`. In `media.test.ts`, assert a successful IPC save calls `rememberApprovedLocalReadPath` for its returned file. Use a temporary directory and assert files outside `voiceovers` remain byte-identical.

- [x] **Step 2: Run tests and confirm the expected failures**

Run: `npm test -- electron/ipc/project/recordedAudioFile.test.ts electron/ipc/register/project/media.test.ts`  
Expected: FAIL because the isolated persistence helpers do not exist.

- [x] **Step 3: Implement helpers and connect IPC**

Write only under `path.join(recordingsDir,"voiceovers")`; normalize extension against the existing allowlist; resolve paths before deletion and require the target to remain inside that directory. The save handler must still call `rememberApprovedLocalReadPath` after a successful write. Add a discard IPC that accepts only the temporary file path and derives the allowed root in Electron.

- [x] **Step 4: Verify API contract and tests**

Run: `npm test -- electron/ipc/project/recordedAudioFile.test.ts electron/ipc/register/project/media.test.ts electron/ipc/project/manager.test.ts`  
Expected: PASS; the preload declaration and handler result types agree.

- [ ] **Step 5: Commit**

```text
feat(audio): add scoped voiceover file persistence
```

### Task 3: Build microphone capture session and recorder dialog

**Files:**
- Create: `src/recording/audioRecorder.ts`
- Test: `src/recording/audioRecorder.test.ts`
- Create: `src/components/editor/AudioRecorderDialog.tsx`
- Test: `src/components/editor/AudioRecorderDialog.test.tsx`
- Modify: `src/components/editor/projectEditor.css`
- Modify: `src/i18n/locales/{en,es,fr,it,ko,nl,pt-BR,ru,zh-CN,zh-TW}/editor.json`

**Interfaces:**
- Produces `RecordedAudioTake = {blob:Blob; mimeType:string; extension:string; durationMs:number; startUs:number}`.
- Produces `createAudioRecorderSession(environment?:AudioRecorderEnvironment)` with `listInputs():Promise<AudioInputDevice[]>`, `start(options:{deviceId:string|null;startUs:number;onLevel:(level:number)=>void}):Promise<void>`, `stop():Promise<RecordedAudioTake>`, `discard():Promise<void>`, and `dispose():void`.
- Dialog receives the start anchor and callbacks for preview start/pause, finalized take, discard, and navigation resolution; it never edits the project itself.

- [x] **Step 1: Write failing capture lifecycle tests**

Test `audioRecorder_listsAudioInputsOnly`, `audioRecorder_selectsSupportedMimeAndMatchingExtension`, `audioRecorder_stopReturnsBlobAndAnchoredTime`, `audioRecorder_discardReturnsNoTake`, and `audioRecorder_releasesStreamContextAndTimersOnEveryExit`. Mock `getUserMedia`, `MediaRecorder`, `AudioContext`, clock, and animation-frame APIs.

- [x] **Step 2: Run tests and confirm the expected failures**

Run: `npm test -- src/recording/audioRecorder.test.ts`  
Expected: FAIL because the capture session API does not exist.

- [x] **Step 3: Implement capture session**

Request `{audio: ...}` only, use the selected device when present, compute elapsed duration from a monotonic clock, meter through an analyser, and stop every stream track on stop/discard/error/dispose. Select only a MIME type supported by the runtime and accepted by Task 2's file extension allowlist.

- [x] **Step 4: Write dialog interaction tests and confirm they fail**

Test microphone selection, live meter/timer state, stop and discard actions, and permission error feedback. Run `npm test -- src/components/editor/AudioRecorderDialog.test.tsx`; expected: FAIL because the dialog is not implemented.

- [x] **Step 5: Implement accessible dialog and localization**

Create a compact dialog with microphone selector, level meter, elapsed time, Record/Stop/Discard controls, and explicit Finish and keep / Discard and continue / Stay choices when navigation is requested. Add English copy and corresponding keys to all supported editor locale files; style in `projectEditor.css`.

- [x] **Step 6: Run capture and dialog tests**

Run: `npm test -- src/recording/audioRecorder.test.ts src/components/editor/AudioRecorderDialog.test.tsx`  
Expected: PASS; permissions, MIME selection, cleanup, and controls behave as specified.

- [ ] **Step 7: Commit**

```text
feat(editor): add standalone audio recorder dialog
```

### Task 4: Register takes in Assets and place them at the start anchor

**Files:**
- Create: `src/components/editor/useAudioRecordingAssets.ts`
- Test: `src/components/editor/useAudioRecordingAssets.test.ts`
- Test: `src/components/editor/AssetLibrary.test.tsx`
- Test: `src/components/editor/ProjectEditor.test.tsx`
- Modify: `src/components/editor/AssetLibrary.tsx`
- Modify: `src/components/editor/ProjectEditor.tsx`
- Modify: `src/components/editor/projectLifecycle.ts`
- Test: `src/components/editor/projectLifecycle.test.ts`

**Interfaces:**
- Consumes: Task 1 `placeVoiceover`, Task 2 Electron audio APIs, Task 3 `RecordedAudioTake`, `ProjectController.importToken()`, `acceptImport(token,command)`, `execute(command,selection?)`, and `setPendingWork(key,count)`.
- Produces: `useAudioRecordingAssets(controller)` with `begin(startUs):AudioRecordingToken`, `finalize(token,take):Promise<{assetId:string;clipId:string}|null>`, and `discard(filePath?):Promise<void>`.
- `AssetLibrary` adds `onRecordAudio():void`; it remains usable without a selected clip.

- [x] **Step 1: Write failing project handoff and integration tests**

Test `finalize_registersAssetAndPlacesAtOriginalPlayhead`, `undoPlacementKeepsAssetAndRedoRestoresSameClipId`, `finalize_ignoresStaleProjectAndDeletesTemporaryFile`, `probeFailureLeavesProjectUnchangedAndTakeAvailableForRetry`, `occupiedTracksCreateVoiceoverLane`, `recordingDisablesSeekAndTimelineEdits`, `assetLibrary_recordAudioWorksWithoutSelection`, `projectEditor_recordingStartsPreviewAndPausesOnFinishOrDiscard`, and `projectEditor_navigationSupportsFinishDiscardAndStay`. Assert asset registration and placement are separate history changes.

- [x] **Step 2: Run tests and confirm the expected failures**

Run: `npm test -- src/components/editor/useAudioRecordingAssets.test.ts src/components/editor/AssetLibrary.test.tsx src/components/editor/ProjectEditor.test.tsx`  
Expected: FAIL because the handoff hook and integrations do not exist.

- [x] **Step 3: Implement guarded Asset registration and placement**

`begin` captures `controller.importToken()` and `startUs`, then marks `audioRecording` pending. `finalize` persists and probes the file, verifies the token still matches, registers an ordinary audio Asset through `acceptImport`, then calls `execute` with `placeVoiceover`. If the token is stale, clean the temporary file and return `null`. Keep the Blob retryable until persistence and probe both succeed.

- [x] **Step 4: Connect AssetLibrary and ProjectEditor**

Add **Record Audio** to the Asset Library. On start, capture the current playhead anchor and begin preview playback. On stop, pause preview and finalize; on discard, pause preview and delete temporary output. Keep asset registration available with an empty timeline and no selection.

- [x] **Step 5: Add navigation and close resolution**

Route Home, New, Open, and Electron close through the recorder's Finish and keep / Discard and continue / Stay decision. Do not navigate while a choice or finalization is pending. Update `projectLifecycle.ts` and its tests so a canceled choice vetoes close and a completed choice resumes the existing unsaved-project flow.

- [x] **Step 6: Verify project handoff and UI tests**

Run: `npm test -- src/components/editor/useAudioRecordingAssets.test.ts src/components/editor/projectLifecycle.test.ts src/components/editor/AssetLibrary.test.tsx src/components/editor/ProjectEditor.test.tsx`  
Expected: PASS, including Record Audio visibility, anchored preview start/pause, seek/edit lockout, and finish/discard/stay navigation behavior.

- [ ] **Step 7: Commit**

```text
feat(editor): add project voiceover asset workflow
```

### Task 5: Verify `.captr` durability and close the regression loop

**Files:**
- Modify: `electron/ipc/project/timelineBundle.test.ts`
- Modify: `electron/ipc/register/project/save.test.ts`
- Modify: `ISSUE.md`

**Interfaces:**
- Consumes: Task 4 V3 audio Asset and Task 2 approved temporary source path.
- Produces: tests proving bundle ownership and a regression checklist for Audio Recorder behavior.

- [x] **Step 1: Read the project-storage regression checklist**

Read the `ISSUE.md` section **“Menambahkan Record slide meminta project baru”** before changing any save/bundling implementation. If tests reveal a production gap, make that source change only after recording the current focused test baseline.

- [x] **Step 2: Write bundle durability tests**

Test `stageTimelineProject_stagesUnplacedVoiceoverUnderAssetOwner` and `saveAndReopenProject_preservesUnplacedAndPlacedVoiceover`. Inspect `.captr` entries and reopened V3 project data; assert the source is inside `assets/<assetId>/`, the Asset survives with no clip, and a placed clip references the same Asset.

- [x] **Step 3: Run focused project tests**

Run: `npm test -- electron/ipc/project/timelineBundle.test.ts electron/ipc/register/project/save.test.ts`  
Expected: PASS if existing V3 asset staging already covers the voiceover. If a test fails, fix the smallest source gap while preserving atomic save behavior and the ISSUE.md invariants.

- [x] **Step 4: Update ISSUE.md and run feature suites**

Add checklist cases for record/discard, original-playhead placement, occupied audio track, undo retaining Asset, stale project completion, and Assets-only `.captr` save/reopen. Run all new domain, IPC, recorder, lifecycle, and bundle tests.

- [x] **Step 5: Run repository checks**

Run `npx tsc --noEmit`, `npm run i18n:check`, `npm run lint`, and `npm run build`. Report pre-existing failures separately; do not count baseline failures as feature success.

- [ ] **Step 6: Desktop QA**

Record and discard; record over a playing clip; confirm placement uses the original playhead; record where the current audio track is occupied; save/reopen `.captr`; undo and redo placement; remove a placed clip while retaining its Asset; test finish/discard/stay during Home/Open/New and window close; confirm screen Record still behaves independently.

- [ ] **Step 7: Commit**

```text
test(audio): verify voiceover project persistence and lifecycle
```

## Execution Notes

- Use the already selected native in-session method; task interfaces are intentionally sequential.
- The `.git` directory is currently read-only to this sandbox. Keep each task's working-tree changes reviewable and do not claim a commit if Git metadata remains unwritable.
- No transition effects are included in this plan; they begin their own design/spec/plan cycle after Audio Recorder ships.
