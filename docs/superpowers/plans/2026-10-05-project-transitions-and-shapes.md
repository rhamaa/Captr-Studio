# Project Transitions and Basic Shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable visual clip transitions, component enter/exit animations, and four basic shape components to the V3 Project Editor with identical preview/export evaluation.

**Architecture:** Keep clip-boundary transitions as project relations and component animations on their visual clip. Use source handles for centered transitions without changing project duration, preserve shape definitions as pathless V3 assets, and drive rendering from the shared project-time evaluator.

**Tech Stack:** React, TypeScript, Electron, Vitest, existing Canvas/frame renderer and V3 `.captr` persistence. No new dependencies.

**Spec:** `../specs/2026-10-05-project-transitions-and-shapes-design.md`

## Global Constraints

- Store time as safe integer microseconds; transition boundaries are derived from adjacent clip times.
- Keep the project duration and clip placements unchanged when applying clip transitions.
- Use a centered transition interval; sample the outgoing tail and incoming head through clip rate and Record-composition time mapping.
- Clip transitions default to 500 ms; if handles are shorter, a newly created transition uses the available maximum. Later duration requests above the maximum are rejected with that maximum.
- Component animations default to 300 ms, cap at 2 seconds and clip duration, use project time, and cannot overlap.
- Support rectangle, ellipse, line, and arrow shape assets with JSON geometry and solid fill/stroke; shapes have no media file path.
- Use the same pure evaluator and renderer for preview and export. Render a complete Record composition before applying a clip transition.
- Keep audio evaluation unchanged; no audio fades or crossfades in this phase.
- Preserve old V3 projects with absent optional fields; do not bump the project version.
- Read `ISSUE.md`'s Record-project regression checklist before changing save, autosave, or bundle code. Do not change Record finalization, path identity, or automatic placement.
- Do not install packages, merge, or push. The current sandbox reports `.git` metadata as read-only; leave implementation changes uncommitted if that persists.

## Review Focus

1. A transition with insufficient outgoing or incoming handles, including a rate-adjusted Record-composition handle, reports the correct maximum and leaves the project unchanged. Test in Task 2.
2. Moving, trimming, splitting, or deleting either clip cannot leave an orphaned/non-adjacent transition or consume a handle needed by an attached relation; undo restores the relation. Test in Task 2.
3. An old V3 project without new fields still opens, and a pathless shape asset does not enter media-file staging. Test in Task 3.
4. Random seeks at transition/animation boundaries yield deterministic results and preview/export frames match. Test in Tasks 4–5.
5. Duplicated shape placements retain independent style and animation edits after save/reopen. Test in Tasks 3 and 6.

## File Responsibilities

- `src/core/timeline/types.ts`: V3 clip-transition, component-animation, and shape asset types.
- `src/core/timeline/validation.ts`: compatibility defaults and strict validation for new optional data.
- `src/core/timeline/clipTransitions.ts`: handle calculation and immutable transition/component-animation commands.
- `src/core/timeline/shapeCommands.ts`: create a pathless shape asset and its first visual placement as one history operation.
- `src/core/timeline/commands.ts`: atomic transition cleanup when clip edits invalidate adjacency; keep undo snapshots coherent.
- `src/core/timeline/visualAnimation.ts`: deterministic project-time animation and transition progress sampling.
- `src/core/timeline/evaluation.ts`: expose evaluated transition samples to all render consumers.
- `src/lib/exporter/projectFrameRenderer.ts`: render shape primitives, component effects, and post-layer transition composites.
- `src/lib/exporter/timelineProjectExporter.ts`: consume the shared evaluation and verify exported frames.
- `src/components/editor/ProjectTimeline.tsx` and `TimelineClipItem.tsx`: boundary affordance, duration handles, and shape creation entry point.
- `src/components/editor/ProjectInspector.tsx`: transition and component-animation controls.
- `src/components/editor/ProjectEditor.tsx` and `projectEditor.css`: connect UI commands and presentation.
- `src/components/editor/useTimelinePersistence.ts`, `electron/ipc/project/timelineBundle.ts`, and their tests: confirm optional V3 data and pathless shape assets round-trip safely.
- `src/i18n/locales/*/editor.json`: localized labels, preset names, and handle-limit feedback.

## Baseline

Before code changes, run `npm test`, `npx tsc --noEmit`, `npm run i18n:check`, and `npm run build`. Record existing failures so later checks identify regressions from this work.

---

### Task 1: Define V3 visual-effect and shape data

**Files:**
- Modify: `src/core/timeline/types.ts`
- Modify: `src/core/timeline/validation.ts`
- Test: `src/core/timeline/validation.test.ts`

**Interfaces:**
- Add `TransitionEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out"`.
- Add discriminated `ClipTransitionPreset`: `cross-dissolve`, `fade-through` (`black` or `white`), `wipe` (`left|right|up|down`), and `push` (`left|right|up|down`).
- Add `ClipTransition = {id:string; trackId:string; fromClipId:string; toClipId:string; preset:ClipTransitionPreset; durationUs:number; easing:TransitionEasing}` and optional `TimelineProject.clipTransitions`.
- Add `ComponentAnimation = {preset:"fade"|"slide"|"scale-pop"|"wipe-reveal"; durationUs:number; easing:TransitionEasing; direction?:"left"|"right"|"up"|"down"}` and optional `TimelineClip.componentAnimation:{enter?:ComponentAnimation;exit?:ComponentAnimation}` plus `TimelineClip.shapeStyleOverride?:ShapeStyle`.
- Add `ShapeStyle = {fill:string|null;stroke:{color:string;width:number}|null}` with six-digit hex colors, and `ShapeDefinition` variants: rectangle/ellipse `{kind,width,height,style}`, line `{kind,from:{x,y},to:{x,y},style:{stroke}}`, arrow `{kind,from,to,headLength,style:{stroke}}`. Geometry uses finite positive local units; points use finite local coordinates inside the integer asset bounds. Add `MediaAsset.kind:"shape"` and pathless `MediaAsset.shapeDefinition`; set required asset width/height from geometry bounds and duration to 5,000,000 µs.

- [x] **Step 1: Write failing V3 compatibility and validation tests**

Test `validateTimelineProject_acceptsV3WithoutVisualEffectFields`, `validateTimelineProject_acceptsEveryClipTransitionPreset`, `validateTimelineProject_acceptsFourPathlessShapeDefinitions`, `validateTimelineProject_rejectsUnknownPresetOrEasing`, `validateTimelineProject_requiresDirectionForDirectionalPresets`, `validateTimelineProject_rejectsInvalidHexColorOrGeometry`, `validateTimelineProject_rejectsUnsafeDuration`, `validateTimelineProject_rejectsDuplicateTransitionId`, and `validateTimelineProject_rejectsInvalidClipReferences`. Assert old projects remain valid with absent optional fields; Task 4 covers empty-field evaluation.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `npm test -- src/core/timeline/validation.test.ts`  
Expected: FAIL because the types and validators do not accept or validate these fields.

- [x] **Step 3: Implement the V3 types and validation**

Keep `clipTransitions` optional on disk. Validate transition time as a positive safe integer, rectangle/ellipse dimensions and arrow head length as positive finite local units, line endpoints as distinct finite points, stroke width as positive finite local units, and colors as `#RRGGBB`. Do not add shape file paths or bump the project version.

- [x] **Step 4: Run domain tests and TypeScript**

Run: `npm test -- src/core/timeline/validation.test.ts src/core/timeline/commands.test.ts` and `npx tsc --noEmit`.  
Expected: PASS; existing V3 project fixtures continue to validate.

- [ ] **Step 5: Commit the schema boundary**

Commit message: `feat(timeline): add visual effect and shape types`

### Task 2: Add transition commands, handle limits, and atomic cleanup

**Files:**
- Create: `src/core/timeline/clipTransitions.ts`
- Test: `src/core/timeline/clipTransitions.test.ts`
- Create: `src/core/timeline/shapeCommands.ts`
- Test: `src/core/timeline/shapeCommands.test.ts`
- Modify: `src/core/timeline/commands.ts`
- Test: `src/core/timeline/commands.test.ts`

**Interfaces:**
- Produce `getMaxClipTransitionDurationUs(project:TimelineProject,fromClipId:string,toClipId:string):number`.
- Produce `addClipTransition(project:TimelineProject,input:Omit<ClipTransition,"id"|"durationUs"> & {durationUs?:number},transitionId:string):TimelineProject`; omitted duration uses `min(500_000, availableMaximum)` and zero available handle rejects.
- Produce `updateClipTransition(project:TimelineProject,transitionId:string,patch:Partial<Pick<ClipTransition,"preset"|"durationUs"|"easing">>):TimelineProject` and `removeClipTransition(project:TimelineProject,transitionId:string):TimelineProject`.
- Produce `setComponentAnimation(project:TimelineProject,clipId:string,edge:"enter"|"exit",animation:ComponentAnimation|null):TimelineProject`.
- Produce `createAndPlaceShape(project:TimelineProject,shape:ShapeDefinition,startUs:number,ids:{assetId:string;clipId:string;trackId:string}):TimelineProject`; one history operation creates a pathless shape Asset and its first placement on the first unlocked visual track, creating a track with `ids.trackId` if needed. Initial visible duration is 5,000,000 µs; style and local geometry use editor defaults.
- Produce `setShapeStyleOverride(project:TimelineProject,clipId:string,style:ShapeStyle|null):TimelineProject`; updates only that placement.

- [x] **Step 1: Write failing transition and component-command tests**

Test `getMaxClipTransitionDurationUs_requiresAdjacentVisualClipsOnSameTrack`, `getMaxClipTransitionDurationUs_mapsRateAndRecordCompositionHandles`, `addClipTransition_defaultsTo500msOrAvailableMaximum`, `addClipTransition_rejectsRequestedDurationAboveMaximumWithoutMutation`, `updateClipTransition_rejectsInvalidBoundaryDuration`, `setComponentAnimation_rejectsInOutOverlapOrOverTwoSeconds`, `createAndPlaceShape_createsPathlessAssetAndFiveSecondPlacement`, `createAndPlaceShape_usesUnlockedVisualTrackOrAddsOne`, and `setShapeStyleOverride_changesOnlySelectedPlacement`.

- [x] **Step 2: Write failing invalidation and history tests**

Test `moveClip_removesTransitionWhenPairSeparates`, `trimClip_removesTransitionWhenPairSeparates`, `trimClip_rejectsWhenAttachedTransitionWouldLoseRequiredHandle`, `splitClip_removesTransitionWhenPairSeparates`, `removeClip_removesTransitionAtomically`, and `undo_restoresTransitionWithClipSnapshot`. Test component trim clamping, removal at zero remaining duration, and split behavior: entry stays left, exit stays right, new inner edges remain empty.

- [ ] **Step 3: Run focused tests and confirm they fail**

Run: `npm test -- src/core/timeline/clipTransitions.test.ts src/core/timeline/shapeCommands.test.ts src/core/timeline/commands.test.ts`  
Expected: FAIL because transition relations and animation commands do not exist.

- [x] **Step 4: Implement handle calculation and immutable commands**

Compute the outgoing tail and incoming head handles in project time after source clocks, playback rate, and Record composition mapping. Require exact adjacency and one unlocked visual track. Reject later requests beyond the calculated maximum. Have move/trim/split/delete commands remove invalid relations in the same returned project snapshot; if a source trim would leave an attached relation adjacent but with insufficient handles, reject that trim atomically. Preserve existing IDs and history semantics.

- [x] **Step 5: Run command, history, and recording mapping tests**

Run: `npm test -- src/core/timeline/clipTransitions.test.ts src/core/timeline/shapeCommands.test.ts src/core/timeline/commands.test.ts src/core/timeline/timeMapping.test.ts` and `npx tsc --noEmit`.  
Expected: PASS; unchanged command tests and recording mappings remain green.

- [ ] **Step 6: Commit transition-domain behavior**

Commit message: `feat(timeline): add handle-aware clip transitions`

### Task 3: Preserve effects and shape assets in V3 bundles

**Files:**
- Modify: `electron/ipc/project/timelineBundle.ts`
- Test: `electron/ipc/project/timelineBundle.test.ts`
- Test: `electron/ipc/register/project/v3LifecycleVerification.test.ts`
- Test: `src/components/editor/useTimelinePersistence.test.ts`

**Interfaces:**
- Consume `validateTimelineProject`, `ClipTransition`, `ComponentAnimation`, and pathless shape `MediaAsset` from Task 1.
- Preserve optional `clipTransitions`, clip animations/style overrides, and shape definitions in `project.json` save/load.

- [x] **Step 1: Read the Record regression checklist before persistence edits**

Read `ISSUE.md`, including “Menambahkan Record slide meminta project baru”; confirm this work does not change active project identity, Record finalization, automatic placement, or source ownership.

- [x] **Step 2: Write failing real-bundle round-trip tests**

Test `timelineBundle_roundTripsClipTransitionAndComponentAnimations`, `timelineBundle_roundTripsPathlessShapeAssetAndPlacementOverride`, `timelineBundle_loadsOldV3WithoutVisualEffectFields`, `timelineBundle_doesNotStageShapeAsExternalMedia`, and `timelineBundle_rejectsMalformedTransitionWithoutPartialLoad`. Assert imported and Record assets continue to stage with their existing paths.

- [ ] **Step 3: Run persistence tests and confirm the missing behavior**

Run: `npm test -- electron/ipc/project/timelineBundle.test.ts electron/ipc/register/project/v3LifecycleVerification.test.ts src/components/editor/useTimelinePersistence.test.ts`  
Expected: FAIL on the new transition/shape round-trip assertions.

- [x] **Step 4: Implement only the necessary V3 persistence support**

Preserve optional fields in authoritative `project.json`. Keep pathless shape definitions out of media-file staging and keep all existing asset staging behavior. Reject malformed data through whole-project validation; do not silently drop fields or create slide files.

- [x] **Step 5: Run bundle lifecycle and persistence tests**

Run: `npm test -- electron/ipc/project/timelineBundle.test.ts electron/ipc/register/project/v3LifecycleVerification.test.ts src/components/editor/useTimelinePersistence.test.ts`  
Expected: PASS; old V3 fixtures load and new data survives save/reopen.

- [ ] **Step 6: Commit V3 round-trip support**

Commit message: `feat(project): persist visual transitions and shapes`

### Task 4: Sample transitions and component animation deterministically

**Files:**
- Create: `src/core/timeline/visualAnimation.ts`
- Test: `src/core/timeline/visualAnimation.test.ts`
- Modify: `src/core/timeline/evaluation.ts`
- Test: `src/core/timeline/evaluation.test.ts`

**Interfaces:**
- Produce `sampleComponentAnimation(animation:ComponentAnimation,edge:"enter"|"exit",clipStartUs:number,clipEndUs:number,timeUs:number):ComponentAnimationSample|null`.
- Produce `sampleClipTransition(project:TimelineProject,transition:ClipTransition,timeUs:number):EvaluatedClipTransition|null`, where the result includes interval endpoints, eased progress, and mapped outgoing/incoming sample times.
- Extend `evaluateProject(project:TimelineProject,timeUs:number):ProjectEvaluation` with stable-order evaluated visual transitions and component animation samples while retaining current audio contributions.

- [x] **Step 1: Write failing deterministic sampling tests**

Test `sampleClipTransition_returnsNullOutsideHalfOpenInterval`, `sampleClipTransition_isCorrectAtStartMiddleAndEnd`, `sampleClipTransition_mapsBothHandleSamplesThroughRate`, `sampleComponentAnimation_returnsStableProgressAtRandomSeek`, `sampleComponentAnimation_usesProjectClockAtRateChanges`, and `evaluateProject_keepsAudioPlanUnchanged`.

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm test -- src/core/timeline/visualAnimation.test.ts src/core/timeline/evaluation.test.ts`  
Expected: FAIL because transition and component animation samples are not part of the evaluator.

- [x] **Step 3: Implement pure sampling and extend the evaluator**

Use half-open transition intervals centered on the derived boundary. Sample incoming head and outgoing tail handles through the existing project/composition/source mapping. Sample clip enter/exit from visible project-time edges and compose their effect progress over the current keyframed transform. Apply easing as: linear `t`; ease-in `t²`; ease-out `1-(1-t)²`; ease-in-out `2t²` for `t<0.5`, otherwise `1-(-2t+2)²/2`.

- [x] **Step 4: Verify endpoint, random-seek, and existing evaluation tests**

Run: `npm test -- src/core/timeline/visualAnimation.test.ts src/core/timeline/evaluation.test.ts src/core/timeline/timeMapping.test.ts`  
Expected: PASS; repeated evaluation at the same project timestamp returns identical samples.

- [ ] **Step 5: Commit the shared visual sampler**

Commit message: `feat(timeline): evaluate visual transition timing`

### Task 5: Render shapes and composite transitions through the shared pipeline

**Files:**
- Modify: `src/lib/exporter/projectFrameRenderer.ts`
- Test: `src/lib/exporter/projectFrameRenderer.test.ts`
- Modify: `src/lib/exporter/timelineProjectExporter.ts`
- Test: `src/lib/exporter/timelineProjectExporter.test.ts`

**Interfaces:**
- Consume the `ProjectEvaluation` and `EvaluatedClipTransition` from Task 4.
- Render shape assets as visual layers and composite outgoing/incoming rendered frames according to preset, direction/color, and eased progress. Cross Dissolve blends alpha; Fade Through reaches solid black/white at midpoint; Wipe reveals the incoming layer from the selected edge; Push moves the incoming layer from the selected edge while pushing the outgoing layer in the same direction. Direction names identify the incoming layer's starting edge.
- Apply component animation after the clip's base transform/keyframes and before final canvas composition.

- [x] **Step 1: Write failing renderer tests**

Test `projectFrameRenderer_rendersRectangleEllipseLineAndArrow`, `projectFrameRenderer_appliesShapePlacementOverrideIndependently`, `projectFrameRenderer_compositesEachClipTransitionPreset`, `projectFrameRenderer_appliesComponentEnterAndExitAfterBaseTransform`, and `projectFrameRenderer_compositesFullyRenderedRecordOutput`.

- [x] **Step 2: Write failing preview/export parity tests**

Test `timelineProjectExporter_matchesPreviewAtTransitionStartMiddleAndEnd`, `timelineProjectExporter_matchesPreviewForComponentAnimationRandomSeek`, and `timelineProjectExporter_cancellationLeavesProjectAndSourcesUnchanged` using deterministic colored frame markers.

- [ ] **Step 3: Run renderer and exporter tests and confirm they fail**

Run: `npm test -- src/lib/exporter/projectFrameRenderer.test.ts src/lib/exporter/timelineProjectExporter.test.ts`  
Expected: FAIL because shape layers and visual transition composites are not rendered.

- [x] **Step 4: Implement shape rendering and shared visual compositing**

Draw only the four typed shape primitives using the existing frame canvas. Render both fully evaluated clip layers before applying the selected transition. Route preview and export through the same evaluated sample and rendering path; leave audio mixing unchanged. For component animation, Fade changes opacity, Slide moves from/toward the selected edge, Scale/Pop interpolates between 85% and 100% scale, and Wipe Reveal expands a clip mask from the selected edge. An unset direction defaults to `left` in UI creation and validation adapters.

- [x] **Step 5: Run renderer, exporter, and existing Record effect tests**

Run: `npm test -- src/lib/exporter/projectFrameRenderer.test.ts src/lib/exporter/timelineProjectExporter.test.ts src/recording`  
Expected: PASS; existing screen, cursor, webcam, layout, and motion rendering tests remain green.

- [ ] **Step 6: Commit shared rendering support**

Commit message: `feat(export): render shapes and visual transitions`

### Task 6: Add timeline, Inspector, and shape controls

**Files:**
- Create: `src/components/editor/TimelineTransitionItem.tsx`
- Test: `src/components/editor/TimelineTransitionItem.test.tsx`
- Modify: `src/components/editor/ProjectTimeline.tsx`
- Modify: `src/components/editor/TimelineClipItem.tsx`
- Test: `src/components/editor/ProjectTimeline.test.tsx`
- Modify: `src/components/editor/ProjectInspector.tsx`
- Test: `src/components/editor/ProjectInspector.test.tsx`
- Modify: `src/components/editor/ProjectEditor.tsx`
- Modify: `src/components/editor/projectEditor.css`
- Modify: `src/i18n/locales/*/editor.json`

**Interfaces:**
- Transition item receives a validated transition, boundary position, timeline scale, selection state, and existing project command callbacks.
- Inspector receives either selected clip or selected clip-transition relation; clip selection exposes Masuk/Keluar; relation selection exposes preset, direction/color, duration, easing, and remove.
- Editor selection distinguishes a transition relation from a clip so the Inspector can select a transition independently.
- ProjectEditor adds rectangle, ellipse, line, and arrow using stable asset/clip IDs and the existing history command path. Each shape starts at the playhead with a 5-second visible duration.

- [x] **Step 1: Write failing timeline interaction tests**

Test `projectTimeline_showsTransitionOnlyAtEligibleBoundary`, `projectTimeline_resizesTransitionWithinAvailableHandles`, `projectTimeline_rejectsDurationBeyondAvailableHandles`, `projectTimeline_addShapePlacesAtPlayhead`, and `projectTimeline_undoRestoresShapeAndTransitionEdits`.

- [x] **Step 2: Write failing Inspector tests**

Test `projectInspector_editsTransitionPresetDurationAndDirection`, `projectInspector_defaultsDirectionalPresetToLeft`, `projectInspector_displaysHandleMaximum`, `projectInspector_editsComponentEnterAndExit`, `projectInspector_newAnimationDefaultsTo300msAndCapsAt2s`, `projectInspector_disablesOverlappingAnimationDurations`, and `projectInspector_editsShapeStylePerPlacement`.

- [ ] **Step 3: Run interaction tests and confirm they fail**

Run: `npm test -- src/components/editor/TimelineTransitionItem.test.tsx src/components/editor/ProjectTimeline.test.tsx src/components/editor/ProjectInspector.test.tsx`  
Expected: FAIL because no Project Editor transition or shape controls exist.

- [x] **Step 4: Implement the boundary affordance and duration handles**

Render one compact block centered on each valid cut. Convert drag distance through existing timeline scale and snapping; submit one immutable history command on drop. Keep selection independent from either clip and honor track locks.

- [x] **Step 5: Implement Inspector and Add Shape controls**

Add all agreed presets and four shapes. Show transition maximum duration, preserve the 500 ms default, keep component defaults at 300 ms, localize labels/errors, and use the existing add-track behavior if no unlocked visual track exists.

- [x] **Step 6: Run timeline, Inspector, and editor tests**

Run: `npm test -- src/components/editor/TimelineTransitionItem.test.tsx src/components/editor/ProjectTimeline.test.tsx src/components/editor/ProjectInspector.test.tsx src/components/editor/ProjectEditor.test.tsx` and `npm run i18n:check`.  
The focused timeline, Inspector, and editor tests pass. The i18n command was run and reports 248 repository-baseline missing/extra keys; none mention `addTransition`.

- [ ] **Step 7: Commit Project Editor controls**

Commit message: `feat(editor): add visual transitions and basic shapes`

### Task 7: Run full regression and desktop QA

**Files:**
- Modify tests only where a reproduced regression requires coverage.
- Update `ISSUE.md` only if the project storage contract changed.

- [x] **Step 1: Run focused integration suites**

Focused transition, shape, renderer, inspector, timeline, and V3 lifecycle suites pass (59 tests); `npx tsc --noEmit` passes. `npm run i18n:check` still reports the repository baseline of 248 missing/extra keys, with no `addTransition` finding.

- [x] **Step 2: Run full repository checks**

Full test run: 1,143 passed and 13 failed. Twelve are the recorded unrelated baseline failures; the V3 QA 1 lifecycle case was intermittent in the combined run and passed when the full V3 lifecycle file was rerun alone. Renderer, Electron main, and preload production bundles build successfully with Vite; the earlier full `npm run build` reached packaging but Windows packaging could not replace a locked `release/win-unpacked/resources/app.asar`. `graft build` passes.

- [ ] **Step 3: Perform native desktop QA**

Create/style/duplicate/save/reopen all four shapes; apply each clip transition between imported clips and between imported media and a Record composition; test limited handles, playback and random seek around boundaries, trim/move/split/delete with undo/redo, Ctrl+S/reopen, unchanged project duration, and preview/export frame parity. Verify an old V3 project still opens. Record any unexercised checks as pending; do not claim native parity without running them.

- [x] **Step 4: Review the complete change set**

Fresh whole-change review found no Critical or Important defects. The final audit confirms the retired Slide runtime directories and named hosts/IPC symbol are absent; the unused slide-based project archive dialog was removed after Graft found no callers. Record packages remain editable and no automatic recording placement or audio path changed. Leave the branch unmerged and unpushed.

## Plan self-review

- Spec coverage: model and validation are Task 1; handle-aware relations, component durations, atomic cleanup, shape creation, and undo are Task 2; backward-compatible save/reopen is Task 3; deterministic sampling is Task 4; shape rendering and shared preview/export are Task 5; all user controls are Task 6; repository and desktop verification are Task 7.
- Review-focus tests map to Tasks 2, 2, 3, 4–5, and 3/6 respectively.
- Types passed between tasks use one `ClipTransition`, one `ComponentAnimation`, one pathless `shapeDefinition`, and one `ProjectEvaluation` extension. Easing options are fixed here to `linear`, `ease-in`, `ease-out`, and `ease-in-out`. Shape creation and first placement are one history operation with a 5-second visible duration; later placements can use normal duplicate/place commands.
- Audio effects, transitions over gaps/different tracks, project-duration extension, arbitrary vector paths, and dependency installation remain out of scope.

## Execution record

Tasks 1–6 implementation and test files are present in the current Experiment checkout; their focused coverage is included in Task 7 verification. The test-first red-run steps are left unchecked because their separate failing-run results were not retained in the execution log. Per-task commit steps remain unchecked because no commits were created. Native desktop QA in Task 7 Step 3 is still pending.
