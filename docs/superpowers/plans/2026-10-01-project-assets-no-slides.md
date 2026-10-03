# Project Assets Without Slides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Native execution in the current session/Experiment checkout is the user's preserved execution method; one fresh whole-change review at the end.

**Execution status:** Tasks 1–7 implemented and committed; fresh whole-change review and one fix pass complete. Native QA checklist remains pending, as documented in `../2026-10-01-project-assets-qa.md`.

**Goal:** Deliver a project asset library and general timeline that consume editable recording packages, with no active Slide workflow or runtime.

**Architecture:** A version-3 project owns source assets, recording packages, independent compositions and timeline placements. Recorder completion registers an asset; timeline commands place it. Preview/export share project-time evaluation, while persistence stages all library media, including assets unused by the timeline.

**Tech Stack:** React 18, TypeScript, Electron, Vitest; retain current capture, decode/render/encode infrastructure. No dependency installation is presumed.

**Spec:** `../specs/2026-10-01-project-assets-no-slides-design.md`; its retained clock/effect requirements refer to `../specs/2026-10-01-timeline-record-compound-design.md`.

## Global Constraints

- Record completion populates Assets only; no automatic timeline placement or selected-clip replacement.
- Library is project-wide and works with an empty timeline and no selected clip.
- Preserve native/browser screen capture, webcam, mic/system audio, cursor, auto-zoom, spring and motion blur; do not flatten recordings to MP4.
- Persist integer microseconds, half-open intervals, finite positive rates, project/composition/source clocks and per-stream offsets.
- One `.captr` per project; `project.json` authoritative; new source ownership `assets/<assetId>/`, compositions separate. No new `slides/` or `slide.json` writes.
- Preserve verified project identity and path across Windows/native/browser capture; Ctrl+S, Save As and New Project remain distinct operations.
- Unsupported legacy metadata rejects whole conversion without modifying original files. Supported conversion explicitly creates a separate bundle/identity.
- Shared source media; independent composition per placement. Clip deletion never deletes its asset.
- Existing 11 test failures and 248 i18n diagnostics are known baseline, not success evidence. Native QA remains pending until exercised.
- Never remove untracked/user changes. Inventory and verify absolute workspace boundaries before deleting retired directories. No merge/push without authorization.

## Review Focus

1. A completed recording event delivered twice must register once; a late event from a prior project must not enter the new project.
2. An asset not placed on the timeline must survive `.captr` save/reopen, with all recording sidecars.
3. Two placements sharing one package must retain independent edits after split/duplicate and reload.
4. Windows pending `preserveProjectPath` must be consumed before reset; renderer/Electron path recovery must verify the same projectId.
5. Overlapping recordings, rate changes and random seek must use one canonical audio source per stream and match preview/export timing.

## Task 1: Project domain, recording packages and commands

**Files:** Create `src/core/timeline/{types,validation,commands,timeMapping}.ts` and matching `.test.ts`; create `src/recording/{types,packageAdapter}.ts` and `packageAdapter.test.ts`. Consume reusable effect settings from current Record schema through a temporary private adapter until Task 5 moves them.

**Produces:** `TimelineProject` version 3 with `assets`, `packages`, `compositions`, `tracks`; `MediaAsset`; `RecordingPackage`; `RecordComposition`; `TimelineClip`; `TimelineTrack`. All IDs stable strings and times safe integer microseconds. `createTimelineProject(projectId:string,title:string):TimelineProject` creates empty library plus one visual and one audio track. `validateTimelineProject(value:unknown):TimelineProject` rejects malformed references, duplicate IDs, invalid clocks/rates and unsafe paths. `registerRecording(project:TimelineProject,input:CompletedRecording,ids:{assetId:string;packageId:string}):TimelineProject` deduplicates by capture ID. `CompletedRecording` contains captureId, source references, source duration/dimensions, stream offsets, diagnostics and settings template.

`placeAsset(project,assetId,trackId,startUs,ids:{clipId:string;compositionId?:string}):TimelineProject`; `splitClip(project,clipId,atUs,ids:{rightClipId:string;rightCompositionId?:string}):TimelineProject`; `duplicateClip`, `moveClip`, `trimClip`, `setClipRate`, `removeClip`, `removeAsset`, `updateComposition` are immutable commands returning `TimelineProject`. Locked tracks reject changes; same-track overlaps reject; rates 0.5 and 2 supported; referenced asset removal rejects. Composition editing clamps affected range atomically and rejects an empty clip.

`mapClipTime(clip:TimelineClip,projectUs:number):number|null` returns composition/media time for active half-open interval. `mapCompositionTime(composition:RecordComposition,outputUs:number):number` uses monotonic piecewise segments. `mapStreamTime(sourceUs:number,offsetUs:number,durationUs:number):number|null` handles absent/out-of-range streams explicitly.

- [x] Write tests: recording registration creates one asset and zero clips; repeated captureId returns unchanged project; 2x maps project delta 5,000,000 to source delta 10,000,000; split boundaries meet; invalid/reference/lock cases reject; two placements share sources but not edits; removeClip retains asset.
- [x] Run `npm test -- src/core/timeline src/recording/packageAdapter.test.ts`; watch expected missing-implementation failures.
- [x] Implement interfaces and commands; clone edited composition/settings deeply while retaining shared source references.
- [x] Run same focused tests and TypeScript; require no new failures. Commit `feat(timeline): add project assets and recording composition domain`.

## Task 2: Version-3 bundle persistence and conversion

**Files:** Create `src/core/timeline/legacyConversion.ts` and `.test.ts`; create `electron/ipc/project/timelineBundle.ts` and `.test.ts`; modify `electron/ipc/register/project/save.ts:29-634`, `electron/ipc/project/{manager,projectWorkspace,projectMediaValidation,mediaReferences}.ts` and owning tests; update `ISSUE.md`/`AGENTS.md` storage requirements in the same commit. Minimal V1/V2 parsing lives only in the conversion boundary.

**Consumes:** Task 1 domain validation and types.
**Produces:** `stageTimelineProject(project:TimelineProject,workspaceDir:string):Promise<TimelineProject>` stages the entire library and package files under assets owners, storing relative refs; `resolveTimelineProject(project:TimelineProject,workspaceDir:string):TimelineProject` resolves validated relative refs. `convertLegacyRecordProject(value:unknown,ids:ConversionIds):TimelineProject` reads canonical V2 slides when available, otherwise V1 clips; preserves settings/streams/order/global audio; refuses unsupported metadata/transitions/extensions. `ConversionIds` provides a new projectId and deterministic IDs for generated entities; never silently filters. Explicit UI conversion/save-as-copy supplies a new path/identity after success.

- [x] Write real-bundle tests: unused Record package survives save/reopen with screen/webcam/mic/system/cursor files; duplicate placements stage one source set; project index has version 3/no slides; references cannot escape workspace; failed save leaves old bytes/state intact; identity mismatch cannot recover overwrite target; conversion uses V2 once and leaves original bytes unchanged.
- [x] Run owning project tests; watch failures before new staging implementation.
- [x] Dispatch save/load by validated format before mutation. V3 media discovery traverses assets/packages/compositions, not selected clip. Reuse current atomic bundling and serialized save behavior; new project state installs only after complete load validation. Library-only projects are valid.
- [x] Run project tests and TypeScript. Commit `feat(project): persist timeline libraries and recording packages`.

## Task 3: Finalization enters project Assets

**Files:** Create `src/components/editor/useRecordingAssets.ts` and `useRecordingAssets.test.ts`; create `src/core/timeline/projectSession.ts` and `.test.ts`; modify completion integration currently in `src/components/video-editor/VideoEditor.tsx:~2600-2900`, preserving recorder HUD and both IPC session handlers; extend `electron/ipc/register/project/session.test.ts`.

**Consumes:** `registerRecording`, validated `CompletedRecording`, V3 state/persistence.
**Produces:** `RecordingAssetController` with `beginProject(projectId:string):number` generation, `acceptCompleted(generation:number,input:CompletedRecording):Promise<void>`, `dispose():void`; callbacks update the authoritative project and report failure. Hook subscribes once to recording-session events; captureId comes from persisted recording provenance, not event arrival time. Probe all finalized media/telemetry before accepting an asset. Missing required screen/finalization failure cannot reset project/timeline. Project-session controller invalidates pending capture/import work when project identity changes.

- [x] Tests: two completions produce two Assets and zero clips; repeated capture once; stale generation ignored; failure preserves assets/tracks/path; empty active source does not imply a new project; both session handlers preserve active destination and consume pending flag once.
- [x] Run focused controller/session tests RED; implement registration and remove automatic append/first-Slide creation from the event path.
- [x] Run tests and TypeScript GREEN; commit `feat(recording): register completed captures in project assets`.

## Task 4: Timeline editing and history

**Files:** Create `src/core/timeline/history.ts` and `.test.ts`; create `src/components/editor/{ProjectTimeline,TimelineClipItem,TimelineToolbar}.tsx` and interaction tests; move only reusable low-level drag/scroll/shortcut helpers from existing timeline modules.

**Consumes:** Task 1 commands.
**Produces:** `ProjectHistory` supporting execute/undo/redo against immutable project snapshots; gesture preview does not commit history until drop. `ProjectTimeline({project,selection,playheadUs,onCommand,onSelect,onSeek,onOpenRecording}:ProjectTimelineProps)` renders visual/audio tracks and accepts asset drag data containing stable assetId, not filesystem paths. `selection` is separate UI state. Keyboard actions use the same commands as toolbar.

- [x] Tests: drag/drop places at requested time; trim/split/move/rate/delete update placement only; duplicate/split Record compositions independent; each gesture produces one undo item; locks prevent edit; snapping applies to playhead/edges within 8 screen pixels converted by timeline scale; undo/redo restores selection safely if entity no longer exists.
- [x] Run RED; implement tracks, clip gestures, zoom/scroll, playhead, split/delete, mute/visibility/lock, accessible Add to timeline action and history.
- [x] Run domain/interaction tests GREEN plus TypeScript; commit `feat(editor): add project timeline commands and interactions`.

## Task 5: Recording composition editor without Slide adapters

**Files:** Move retained source under `src/slides/record/` into `src/recording/` by responsibility; rename `RecordSlideMeta` to `RecordingSettings`, retained timeline/workspace helpers to recording composition names. Create `src/recording/editor/RecordingCompositionEditor.tsx` and adapter tests. Refactor `src/components/video-editor/VideoEditor.tsx` so recording effect editing is controlled by composition input/output rather than owning project/deck/library/save actions. Delete registry/module-only wrappers after all callers are updated. Trace every changed symbol and use compiler-driven caller fixes; do not rename serialized legacy fields inside read-only converter.

**Consumes:** Package, composition and Task 1 time mapping.
**Produces:** `RecordingCompositionEditor({package:RecordingPackage,composition:RecordComposition,onChange:(next:RecordComposition)=>void,onClose:()=>void})`. Record cursor/webcam/zoom/layout/annotations/trim/internal-speed settings initialize from that composition and emit updates via one composition command; internal Save/Close does not write the project itself. Asset sources remain immutable. Return action restores project playhead/selection.

- [x] Tests: edit cursor/zoom/layout/webcam/audio on placement A leaves placement B/package unchanged; closing and reopening preserves edits; internal duration change clamps range atomically; original motion/spring helper regression tests continue to run.
- [x] Run RED; migrate reusable implementation and connect controlled composition adapter. Preserve timestamp semantics via explicit millisecond ↔ microsecond adapters at existing effect boundaries.
- [x] Run Record/effect/domain tests GREEN and TypeScript; commit `refactor(recording): replace slide wrappers with composition editor`.

## Task 6: OpenCut-style project workspace and asset library

**Files:** Create `src/components/editor/{ProjectEditor,AssetLibrary,AssetCard,ProjectInspector,ProjectWelcome}.tsx`, `useProjectController.ts`, `useTimelinePersistence.ts` and tests; modify `src/App.tsx:13-88` to mount ProjectEditor; update locale keys for new visible controls. Replace selection-bound `AssetExplorer`, `MediaSection` project usage, Slide filmstrip/actions, and old startup/persistence ownership.

**Consumes:** Tasks 1–5; existing project browser/import dialog/recorder IPC.
**Produces:** Authoritative project controller owns V3 project, revision/save queue/history, selected entities and generation. `AssetLibrary({assets,onImport,onRecord,onPreview,onPlace,onRemove}:AssetLibraryProps)` is independent of selected clip. Import probes video/image/audio, stages only during saving, and registers immutable assets without placements. Previewing source does not change timeline or composition. Project toolbar routes New/Open/Convert/Save/Save As/Record/Export; internal recording editor has none of these global actions.

- [x] Tests: New opens empty Assets/timeline; import without selected clip works and leaves timeline empty; Record action uses current project context; asset preview preserves placements; unused assets mark dirty and save; selected clip drives inspector; referenced asset removal explains block; late imports rejected by generation; save completion clears only saved revision.
- [x] Run RED; implement reference layout (left nav and Assets with Import/grid/list/sort, center preview, right inspector, timeline bottom) and real drag/drop/import. Controls unavailable in this scope remain hidden. Double-click Record clip opens Task 5 editor.
- [x] Run interaction/persistence tests GREEN plus build; commit `feat(editor): replace slide workspace with project assets`.

## Task 7: Shared evaluation/export, final removal and QA

**Files:** Create `src/core/timeline/{evaluation,audioPlan}.ts` and tests; create `src/recording/evaluation.ts`; create `src/lib/exporter/{projectFrameRenderer,timelineProjectExporter}.ts` and tests; create `src/components/editor/ProjectPreview.tsx`. Reuse low-level source decoders, FrameRenderer effects and encoders/muxers; extract any necessary interfaces from single-source `videoExporter.ts` without disabling existing encoder tests. Remove `src/core/slides/`, remaining `src/slides/`, deck-only `src/components/deck/`, `SlideList`, `SlideTimelineHost`, `SlideWorkspaceHost`, Slide exports/registrations and deck export/dialog consumers. Detach `stitchProjectSlides` preload/type/IPC entry point after checking all callers; retain generic FFmpeg helpers only if used elsewhere.

**Consumes:** V3 project and three-clock mapping, independent recording settings.
**Produces:** `evaluateProject(project:TimelineProject,timeUs:number):ProjectEvaluation` returns ordered active visuals and canonical audio contributions with mapped stream times, transforms/gains and missing-required-source issues. `ProjectFrameRenderer.render(evaluation:ProjectEvaluation):Promise<HTMLCanvasElement>` owns bounded sources/cache and deterministic seek; recording frames use retained effect renderer with source-time sampling/pre-roll checkpoints. `TimelineProjectExporter.export(project,options:{outputPath:string;fps:number;signal?:AbortSignal;onProgress?:(percent:number)=>void}):Promise<ExportResult>` samples the same evaluation, composites stacked tracks, mixes audio once and encodes project frames. Empty timeline rejects even with library assets. Cancel/failure cleans temporary outputs without changing media/project.

- [x] Tests RED: overlap visual stacking; mic/system offsets, sidecar preferred over embedded; rate 0.5x/2x and random seek match source markers within one project frame; identical preview/export evaluation; missing required media/empty timeline blocks export; cancel retains source bytes. Use deterministic screen/cursor/webcam markers and audio tones.
- [x] Implement evaluation, Record rendering adapter, project preview/export and encoder integration. Wait for native/WebCodecs frame/audio availability; no blank success placeholders or raw-source export that omits edits.
- [x] Inventory tracked/untracked contents, validate resolved deletion targets remain within workspace, remove obsolete Slide modules only after migrated callers compile. Exhaustive Graft imports/symbol search plus TypeScript confirms only explicit read-only legacy conversion mentions remain; rename active IPC/renderer contracts, not merely UI text.
- [x] Run focused suites, complete full suite, TypeScript, Vite renderer/Electron build, i18n check and `graft build`; distinguish baseline failures from new regressions. Commit atomic final removal/export `feat(editor): export project timelines without slide runtime`.
- [ ] Native QA: Record twice into existing `.captr`, Assets-only save/reopen, place recording twice, split/trim/rate/edit independently, insert imported video/image/music, seek/play, Ctrl+S/reopen, export parity, Save As/New Project, unsupported conversion safety. If unavailable record precise unverified checks; do not claim desktop fidelity.
- [x] Fresh final reviewer examines whole commit range using spec, this plan, Review Focus and ledger rulings. Fix Important/Critical findings with RED→GREEN; no per-task delegation. Preserve branch without merge/push unless user requests it.

## Plan self-review and execution handoff

All spec sections map to tasks: ownership/clocks/commands T1; persistence/conversion T2; completion/races T3; editing/history T4; advanced effects T5; screenshot workflow T6; parity/export/removal/QA T7. Review Focus has tests in T3, T2, T1/T5, T2/T3 and T7 respectively. Shared interfaces use the same V3 project/package/composition/clip contracts. Private transitional adapters are permitted between commits; final delivery has no active Slide runtime.

User approved written design and requested execution. Preserved method is native in this session. Per writing-plans workflow, review of this newly written plan precedes product implementation; no product code is changed by this document.
