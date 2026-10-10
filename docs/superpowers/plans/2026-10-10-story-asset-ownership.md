# Story Editor Asset Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement issue #12 so Story design elements and private media remain isolated while reusable media, Record placements, and all content survive one `.captr` project.

**Architecture:** Keep root/default and explicit Artboard sequences authoritative. Resolve clip content through one shared API, normalize legacy V3 on a clone, and regenerate Story projections only from canonical owners. Root history wraps scoped commands; persistence visits every canonical media library.

**Tech Stack:** TypeScript, React, Electron, Vitest, existing V3 timeline/evaluation/export and project transaction infrastructure. No new dependency.

**Spec:** [Approved ownership specification](../specs/2026-10-10-story-asset-ownership-design.md).

## Global Constraints

- Keep V3 and version `1.4.0-beta.1`; new optional fields must accept older V3 input.
- Keep one `.captr`; `project.json` is authoritative. Sources/sidecars remain under `assets/<assetId>/`; Record compositions remain separate; Story files are projections.
- Global `assets` contains reusable video/image/audio/recording; private libraries accept video/image/audio only. No fake media Asset for inline Text/Shape or Templates.
- Inline clips have exactly one of `assetId` or `content`. New inline source extent is `5_000_000` microseconds. Trim retains extent; explicit extension grows it undoably.
- Root/default and Artboard edits use captured Story scope. Do not redirect missing owners to root or merge local media into global `assets`.
- Screen Record completion stays global Assets-only. Preserve capture leases, project path, identity-checked Ctrl+S, atomic save/load, Rename/Save As, and navigation guards.
- Normalize on a clone, without rewriting the source bundle on load. V1/V2 Record conversion remains explicit to a new copy; unsupported legacy metadata and Video/Motion stay rejected.
- No subtitle burn-in, waveform/filmstrip generation, grading/masks, speed curves, tracking/proxies, new TTS engine, visual redesign, or unrelated native capture/terminal/Hyperframe changes.
- Existing DOM captions remain a known finishing gap; preserve Story caption metadata.
- Do not mark native QA complete unless actually exercised. Do not release intermediate task commits before all acceptance gates pass.

## Review Focus

1. A legacy Artboard omits `tracks`, while another has `tracks: []`: snapshot only the former, with independent Record compositions and private IDs (Task 2).
2. A global Text/Shape has no placement, or conflicting inline/media fields: preserve unused design as a Template; reject contradictory input atomically (Tasks 1–3).
3. A voiceover completes after owner deletion, project abandonment, or cancellation: reject it and clean only its temporary files; never redirect it (Task 6).
4. A private source is unplaced in an empty Story and has transcript/caption sidecars: bundle it, resolve paths, and keep cleanup from pruning it (Task 7).
5. A published private source is placed in another Story, then undone: unwind placement before publication; retain valid IDs and references (Task 5).

---

## File and interface map

New focused modules:

- `src/core/timeline/clipSource.ts`: resolve media/inline sources, dimensions, names, source extent, and visual/audio classification. Never writes project state.
- `src/core/timeline/storyOwnership.ts`: enumerate canonical owners, obtain strict views, wrap Story commands, and remap independent snapshots. No persistence/React imports.
- `src/core/timeline/normalizeStoryOwnership.ts`: legacy V3 hydration and design migration; clone input; no filesystem writes.
- `src/core/timeline/storyMediaCommands.ts`: register/remove/publish private media, with project-wide reference checks.
- `src/core/timeline/designTemplateCommands.ts`: preserve/apply Text/Shape templates and grow inline extent.
- `src/core/timeline/storyOwnership.fixtures.ts`: test-only deterministic root/A/B, media, legacy design, and Record fixtures; production never imports it.

Existing authorities remain in `types.ts`, `repurposeTypes.ts`, `storyTypes.ts`, `commands.ts`, `repurposeCommands.ts`, `storyUtils.ts`, `validation.ts`, `mediaPaths.ts`, the project controller, and main-process bundle services. Do not create another editable Story state store.

Shared exact contracts (export from the responsible modules):

```ts
// types.ts
type StoryScope = { kind: "root" } | { kind: "artboard"; artboardId: string };
type StoryClipContent =
  | { kind: "text"; text: TextOverlay; durationUs: number }
  | { kind: "shape"; shapeDefinition: ShapeDefinition; durationUs: number };
type StoryDesignTemplate = {
  id: string; name: string; kind: StoryClipContent["kind"];
  content: StoryClipContent; width: number; height: number;
  defaultDurationUs: number;
};
type PrivateMediaAsset = MediaAsset & { kind: "video" | "image" | "audio" };

// clipSource.ts
type ResolvedClipSource = {
  kind: MediaAsset["kind"]; name: string; width: number; height: number;
  durationUs: number; media?: MediaAsset; content?: StoryClipContent;
};
resolveClipSource(view: TimelineProject, clip: TimelineClip): ResolvedClipSource;
resolveMediaAsset(view: TimelineProject, assetId: string): MediaAsset;

// storyOwnership.ts
listStoryScopes(project: TimelineProject): StoryScope[];
getStoryProject(project: TimelineProject, scope: StoryScope): TimelineProject;
applyStoryCommand(project: TimelineProject, scope: StoryScope,
  command: ProjectCommand): TimelineProject;

// normalizeStoryOwnership.ts
normalizeStoryOwnership(input: TimelineProject): TimelineProject;

// storyMediaCommands.ts
registerStoryMedia(project: TimelineProject, scope: StoryScope,
  asset: PrivateMediaAsset): TimelineProject;
publishStoryMedia(project: TimelineProject, scope: StoryScope,
  assetId: string): TimelineProject;
removeStoryMedia(project: TimelineProject, scope: StoryScope,
  assetId: string): TimelineProject;

// designTemplateCommands.ts (view is already scoped)
applyDesignTemplate(view: TimelineProject, templateId: string, startUs: number,
  ids: { clipId: string; trackId: string }): TimelineProject;
extendInlineClip(view: TimelineProject, clipId: string,
  sourceOutUs: number): TimelineProject;
```

`TimelineProject`, `RepurposeArtboard`, and `StoryComposition` gain optional `localAssets`; canonical owners also preserve optional `subtitles`. `TimelineProject` gains optional `designTemplates`. `StoryComposition` gains optional `artboardId`; retain existing Story IDs. Clip common fields remain; source fields become the XOR union. Legacy `clip.text` and legacy design Assets remain accepted only at normalization boundaries.

## Task 1: Source model, strict resolution, and validation

**Files:** Modify `src/core/timeline/types.ts:88-103`, `repurposeTypes.ts:12-21`, `src/core/story/storyTypes.ts:24-36`, `src/core/timeline/validation.ts:248-653`. Create the resolver, ownership view module, fixtures, `clipSource.test.ts`, and `storyOwnership.test.ts`; extend `validation.test.ts`.

**Interfaces:** Produces shared source types, `resolveClipSource`, `resolveMediaAsset`, `listStoryScopes`, and `getStoryProject`. Resolver throws for missing/cross-scope sources. Views expose global `assets` plus only the owner's `localAssets`; no fallback for an absent Artboard. Reuse existing source/shape/text validation helpers without a resolver/validation import cycle.

- [x] **Step 1: Record the implementation baseline.** Run `npm test` and `npx tsc --noEmit`, saving failure names in `docs/superpowers/plans/2026-10-10-story-asset-ownership-baseline.md`. Enumerate all source lookups with `graft grep "assetId"` and trace changing symbols before edits. Record connected platform/bundle consumers, not just ranked matches.
- [x] **Step 2: Write failing tests.** Define `ownershipFixture()` with root, explicit A/B, global video `shared`, A-private audio `voice-A`, valid inline text/shape, and independent Record placements. Assert:

```ts
expect(resolveClipSource(viewA, inlineText).durationUs).toBe(5_000_000);
expect(resolveMediaAsset(viewA, "shared").id).toBe("shared");
expect(() => resolveMediaAsset(viewB, "voice-A")).toThrow();
expect(viewA.assets.some(a => a.id === "voice-A")).toBe(false);
expect(() => validateTimelineProject(clipWithBothSources)).toThrow();
expect(() => validateTimelineProject(duplicatePrivateId)).toThrow();
expect(() => validateTimelineProject(inlineOnAudioTrack)).toThrow();
```

Add rejection assertions for neither source, invalid extent/shape/text, dangling private reference, private Recording Asset, bad template kind/content, sibling duplicate canonical IDs, transition handles, and Record composition ownership. Projection mirrors must not register IDs twice.
- [x] **Step 3: Verify failure.** Run `npx vitest run src/core/timeline/clipSource.test.ts src/core/timeline/storyOwnership.test.ts src/core/timeline/validation.test.ts`; new contract cases fail before implementation.
- [x] **Step 4: Implement model/resolution/validation.** Deep-check every canonical owner using strict media scope. Resolver derives dimensions/extent from inline or media metadata without creating an Asset. Make validation mode explicit for legacy ingress versus canonical state, preserving pre-normalization legacy validation; canonical output rejects legacy design Assets. Keep empty libraries valid.
- [x] **Step 5: Verify and commit.** Rerun those suites, expect all pass; commit only Task 1 files as `feat: define Story source ownership and resolution`.

## Task 2: Canonical Story authority and independent snapshots

**Files:** Modify `src/core/timeline/repurposeCommands.ts:72-124,418-592`, `src/core/story/storyUtils.ts:24-140`, ownership module, `repurposeCommands.test.ts`, `storyOwnership.test.ts`, `src/core/story/storyUtils.test.ts`. Create normalization module and `normalizeStoryOwnership.test.ts`.

**Interfaces:** Consumes Task 1 views/types. Produces `applyStoryCommand` and `normalizeStoryOwnership`; retains existing Artboard/Story utility entry points by delegating to these rules. Normalization remaps IDs deterministically so a second call is identical; commands use existing ID generation for new clones.

- [x] **Step 1: Write failing isolation/hydration tests.** Use an inherited legacy Artboard (no tracks), explicit empty B, standalone Story, and a stale `project.stories` projection. Assert:

```ts
expect(normalizeStoryOwnership(normalizeStoryOwnership(input))).toEqual(normalizeStoryOwnership(input));
expect(input).toEqual(originalInput);
expect(viewB.tracks).toEqual([]);
expect(recordClipA.compositionId).not.toBe(recordClipRoot.compositionId);
expect(privateMediaA.id).not.toBe(privateMediaRoot.id);
expect(extractStoriesFromProject(editedRoot)[0].tracks).toEqual(editedRoot.tracks);
expect(() => normalizeStoryOwnership(ambiguousStoryMapping)).toThrow();
```

Also assert root editing does not alter a materialized/new/duplicated Artboard, template/shared source IDs remain shared, clone transitions refer to new clips, and subtitle settings/framing/local library/explicit empty metadata round-trip through both conversion directions. Standalone identity stays stable.
- [x] **Step 2: Verify failure.** Run `npx vitest run src/core/timeline/storyOwnership.test.ts src/core/timeline/normalizeStoryOwnership.test.ts src/core/timeline/repurposeCommands.test.ts src/core/story/storyUtils.test.ts`; new isolation/projection tests fail.
- [x] **Step 3: Implement authority and snapshot rules.** Preserve canonical tracks over projection tracks, hydrate only unmatched/unambiguous legacy Stories, and materialize omitted tracks once. Clone tracks/clips/transitions/private IDs and Record compositions, updating references; preserve global package IDs. Scoped commands write owner metadata and intentional shared imports, never sibling/root-private fields. Projections include empty owners and derive current paths/metadata every time.
- [x] **Step 4: Verify and commit.** Same command passes; commit `feat: isolate canonical Stories and Artboard snapshots`.

## Task 3: Local Text/Shape, Templates, and legacy migration

**Files:** Modify `src/core/timeline/commands.ts:154-223,271-372`, `shapeCommands.ts:14-61`, normalization module; create template/media command modules with respective `.test.ts` files. Extend `textOverlay.test.ts`, `shapeCommands.test.ts`, `commands.test.ts`, and normalization tests.

**Interfaces:** Consumes resolver/views/normalizer. Produces private register/remove APIs, `applyDesignTemplate`, and `extendInlineClip`. Existing Text/Shape creator APIs retain their caller compatibility temporarily, but ignore the obsolete design `assetId` allocation and create inline content; remove obsolete caller allocation in Task 5. `removeAsset` checks all canonical scopes; `removeStoryMedia` checks its owner. Commands return new projects and perform no filesystem operations.

- [x] **Step 1: Write failing command/migration tests.** Assert:

```ts
expect(created.assets).toEqual(before.assets);
expect(created.localAssets).toEqual(before.localAssets);
expect(textClip.content?.kind).toBe("text");
expect(textClip.assetId).toBeUndefined();
expect(duplicate.content).not.toBe(textClip.content);
expect(extendedClip.content?.durationUs).toBe(8_000_000);
expect(trimmedClip.content?.durationUs).toBe(8_000_000);
expect(migrated.designTemplates?.some(t => t.id === "unused-shape")).toBe(true);
expect(migrated.assets.some(a => a.kind === "text" || a.kind === "shape")).toBe(false);
```

Test legacy placement text override precedence, shape override, non-default range/rate, unchanged IDs/keyframes/animations/transitions, invalid legacy definition rejecting the whole clone, independent template instances, private registration without placement, source deletion rejected while referenced, clip deletion retaining media, and undo/redo restoring content/IDs. Existing global voiceover media stays global.
- [x] **Step 2: Verify failure.** Run `npx vitest run src/core/timeline/textOverlay.test.ts src/core/timeline/shapeCommands.test.ts src/core/timeline/commands.test.ts src/core/timeline/designTemplateCommands.test.ts src/core/timeline/storyMediaCommands.test.ts src/core/timeline/normalizeStoryOwnership.test.ts`; new cases fail.
- [x] **Step 3: Implement inline creators and migration.** Deep-copy design data, preserve timing/style overrides, migrate every placed legacy design and preserve unused entries as Templates. Remove legacy Assets only after resolving all canonical references. `extendInlineClip` grows extent only for valid inline clips; split/duplicate deep-copy content and preserve existing Record independence. Registration is separate from placement history.
- [x] **Step 4: Verify and commit.** Same suites pass; commit `feat: keep Story designs inline and migrate legacy presets`.

## Task 4: Unified evaluation, preview, export, and clock handling

**Files:** Modify `src/core/timeline/evaluation.ts:21-71`, `audioPlan.ts:19-158`, `clipTransitions.ts:14-40`, `visualAnimation.ts:84-139`, `voiceoverPlacement.ts:4-40`, `src/lib/exporter/projectFrameRenderer.ts:18-435`, and connected asset lookup/bounds helpers identified in Task 1. Extend domain suites and `src/lib/exporter/projectFrameRenderer.test.ts`, `projectTextOverlay.test.ts`, `projectAudioRenderer.test.ts`, `timelineProjectExporter.test.ts`.

**Interfaces:** Consumes `ResolvedClipSource` and scoped views; preserves existing public evaluation/render/export interfaces. Evaluated inline visuals retain inline source descriptors without persisting synthetic Assets. Audio plan emits no layer for inline content; private media uses existing decoder/mixer contracts.

- [x] **Step 1: Write failing parity/clock tests.** Use sample times at the start, middle, end, and transition overlap with `rate: 0.5` and `rate: 2`. Assert:

```ts
expect(buildProjectAudioPlan(inlineOnly)).toHaveLength(0);
expect(privateAudioPlan).toHaveLength(1);
expect(previewDrawCalls).toEqual(exportDrawCalls);
expect(recordSourceTimeUs).toBe(expectedMappedSourceTimeUs);
expect(() => resolveClipSource(viewB, siblingPrivateClip)).toThrow();
```

`buildProjectAudioPlan` returns `ProjectAudioSegment[]`; assert zero/one emitted segments directly. Assert dimensions/bounds, text styling, shape override, keyframes, transition handles/adjacency cleanup, webcam/mic offsets and cursor timing remain correct through Story rate and Record time map.
- [x] **Step 2: Verify failure.** Run `npx vitest run src/core/timeline/evaluation.test.ts src/core/timeline/visualAnimation.test.ts src/core/timeline/clipTransitions.test.ts src/core/timeline/voiceoverPlacement.test.ts src/lib/exporter/projectFrameRenderer.test.ts src/lib/exporter/projectTextOverlay.test.ts src/lib/exporter/projectAudioRenderer.test.ts src/lib/exporter/timelineProjectExporter.test.ts`; new local-source cases fail.
- [x] **Step 3: Replace direct Asset assumptions with resolution.** Use the same scoped source in evaluation, transition handles, frame painting, audio scheduling, and geometry. Preserve Record package evaluation before Story effects and timing. Do not add caption burn-in or change native capture.
- [x] **Step 4: Verify and commit.** Same suites pass; commit `feat: render inline designs and private Story media consistently`.

## Task 5: Library sections, publication, scoped UI and AI edits

**Files:** Modify `src/components/editor/StoryEditor.tsx:91-866`, `ProjectEditor.tsx:75-1215`, `AssetLibrary.tsx`, `AssetCard.tsx`, `TimelineClipItem.tsx:76-261`, `ProjectInspector.tsx:141-676`, `CanvasTransformGizmo.tsx`, `canvasGizmoMath.ts`, `useProjectController.ts:97-179`, `src/core/timeline/agentTools.ts:99-470`, `agentPayload.ts:42-132`, and connected design/B-roll tool callers. Implement publication in `storyMediaCommands.ts`; extend those component/domain tests, including `StoryEditor.test.tsx`, `ProjectEditor.test.tsx`, `AssetLibrary.test.tsx`, `AssetCard.test.tsx`, `ProjectInspector.test.tsx`, `CanvasTransformGizmo.test.tsx`, `agentTools.test.ts`, `agentPayload.test.ts`.

**MCP files:** Also modify `electron/ipc/agent/mcpServer.ts` and `electron/ipc/register/agent.ts:24-90`; extend `electron/preload.ts:1078` and `electron/electron-env.d.ts:1040` only if the synchronized context type requires it. Add `electron/ipc/agent/storyContext.test.ts` for stale/sibling context rejection. Keep all main-process proposal paths consistent with renderer context checks.

**Interfaces:** Consumes Tasks 1–4. Produces `publishStoryMedia`. Scoped UI dispatch is `controller.execute(root => applyStoryCommand(root, capturedScope, command))`. Define `StoryEditContext = { scope: StoryScope; projectId: string; generation: number }` in `src/core/timeline/storyOwnership.ts` and add it to AI/MCP context/proposals; compare with controller import token and captured scope before applying, then validate atomically. Do not use the currently selected Story to reinterpret an older proposal.

- [x] **Step 1: Write failing user-flow tests.** Assert Text/Shapes actions create inline clips, Assets shows only global entries, Story Media shows only the current library and an actual empty state, Templates applies independent designs, and inspector/gizmo edit content without a global backing Asset. Assert publication/history:

```ts
expect(published.assets.find(a => a.id === "voice-A")?.source).toEqual(originalSource);
expect(getStoryProject(published, scopeA).localAssets).not.toContainEqual(privateAsset);
expect(placementB.assetId).toBe("voice-A");
controller.undo(); // sibling placement
controller.undo(); // publication
expect(getStoryProject(controller.snapshot.project, scopeA).localAssets).toContainEqual(privateAsset);
expect(controller.snapshot.project.assets.some(a => a.id === "voice-A")).toBe(false);
```

Test redo IDs, clip/source deletion distinction, undoable Story deletion with no physical cleanup, stale AI generation/wrong Story rejection leaving history/state unchanged, scoped transcript context, and AI Text/Shape output being inline. Ensure gizmo updates do not restore the known render-loop bug.
- [x] **Step 2: Verify failure.** Run targeted component suites listed above plus `npx vitest run src/core/timeline/storyMediaCommands.test.ts src/core/timeline/agentTools.test.ts src/core/timeline/agentPayload.test.ts electron/ipc/agent/storyContext.test.ts`; new ownership flows fail.
- [x] **Step 3: Wire UI and tools.** Retain existing styles and add labels `Assets`, `Story Media`, `Text / Shapes`, `Templates`, `Publish to Assets`. Publication moves metadata only, preserving ID/source/sidecars. Route timeline/inspector/gizmo through resolver, eliminate obsolete design Asset IDs, keep media import global by default. Add scoped errors and explicit source removal reference checks.
- [x] **Step 4: Verify and commit.** Targeted tests and `npx tsc --noEmit` pass (or only documented unchanged baseline failures); commit `feat: expose scoped Story libraries and reusable design templates`.

## Task 6: Capture voiceovers into their originating Story

**Files:** Modify `src/components/editor/useAudioRecordingAssets.ts:63-216`, `ProjectEditor.tsx:384-397`, existing navigation guards and `src/core/timeline/voiceoverPlacement.ts`; extend `useAudioRecordingAssets.test.ts`, `ProjectEditor.test.tsx`, `projectNavigation.test.ts`, `AudioRecorderDialog.test.tsx`, and `voiceoverPlacement.test.ts`.

**Interfaces:** Consumes private registration and scoped command APIs. Begin take accepts captured context `StoryVoiceoverContext = { scope: StoryScope; token: { generation: number; projectId: string }; startUs: number; ids: { assetId: string; clipId: string; trackId: string } }`. Finalizer uses that immutable context with `acceptImport`, checks owner existence, registers private source, then makes separately undoable placement. Keep bounded existing temporary-file cleanup IPC and capture lease contracts.

- [x] **Step 1: Write failing async lifecycle tests.** Hold save/probe promises; move playhead after begin and test blocked Story switching, deleted owner, canceled token, new project, save/probe failure, and each Finish/Discard/Stay choice. Assert:

```ts
expect(keptVoiceover.startUs).toBe(capturedStartUs);
expect(viewA.localAssets?.find(a => a.id === capturedAssetId)).toBeDefined();
expect(viewB.localAssets?.find(a => a.id === capturedAssetId)).toBeUndefined();
expect(root.assets.some(a => a.id === capturedAssetId)).toBe(false);
expect(cleanupTemporaryFile).toHaveBeenCalledWith(rejectedTakePath);
expect(controller.snapshot.project).toEqual(beforeRejectedCompletion);
```

Undo placement retains private media; redo restores clip ID. Discard deletes only temporary output. Imported audio and existing global voiceovers remain global; screen Record completion still registers global media without auto placement.
- [x] **Step 2: Verify failure.** Run `npx vitest run src/components/editor/useAudioRecordingAssets.test.ts src/components/editor/ProjectEditor.test.tsx src/components/editor/projectNavigation.test.ts src/components/editor/AudioRecorderDialog.test.tsx src/core/timeline/voiceoverPlacement.test.ts`; new captured-scope cases fail.
- [x] **Step 3: Implement capture-context handoff.** Capture scope/IDs/time/token at begin; resolve none of these from UI selection at completion. Reuse navigation and pending-work guards, reject stale completions before editing, and leave screen capture paths unchanged.
- [x] **Step 4: Verify and commit.** Same suites pass; commit `feat: keep recorded voiceovers private to their originating Story`.

## Task 7: Complete `.captr` traversal, normalization ingress, and atomic round trips

**Files:** Modify `src/core/timeline/mediaPaths.ts:65-103`, `electron/ipc/project/timelineBundle.ts:16-132`, `mediaReferences.ts:28-200` (existing validation owner; no new parallel module), `manager.ts:499-681`, `projectFileService.ts:87-233`, `src/components/editor/useProjectController.ts:37-72,143-179`, and connected V3 load/save ingress. Add tests to `timelineBundle.test.ts`, `projectBundle.test.ts`, `mediaReferences.test.ts`, `projectMediaValidation.test.ts`, `projectFileService.test.ts`, `manager.test.ts`, `src/components/editor/useProjectController.test.ts`, `electron/ipc/recording/prune.test.ts`, `electron/ipc/register/project/v3LifecycleVerification.test.ts`.

**Interfaces:** Consumes `normalizeStoryOwnership` and canonical owner enumeration. Preserve `visitTimelineMediaPaths`, staging/resolution, and transactional file APIs so native/platform callers stay compatible. Normalize legacy input before canonical installation/staging; deeply validate canonical output. Projection generation occurs after canonical media paths are staged/resolved. Loading a mirror never overrides canonical state.

- [x] **Step 1: Write failing actual filesystem/bundle tests.** Build an empty Story with unplaced private video/audio, transcript JSON and caption VTT, root media, inline designs, Templates, Record composition, and subtitle metadata. Save/reopen through current bundle services. Assert:

```ts
expect(bundleEntries).toContain("assets/voice-A/asset.json");
expect(bundleEntries).toContain("assets/voice-A/transcript.json");
expect(bundleEntries).toContain("assets/voice-A/captions.vtt");
expect(bundleEntries.some(p => p.startsWith("slides/"))).toBe(false);
expect(bundleEntries.some(p => p === "assets/inline-title/asset.json")).toBe(false);
expect(reopenedArtboard.localAssets?.length).toBe(2);
expect(savedStory.tracks).toEqual(savedCanonicalOwner.tracks);
expect(originalBundleBytesAfterRejectedLoad).toEqual(originalBundleBytes);
```

Assert projection paths resolve to staged private media, Story filenames/manifest paths match exactly without prefix duplication, enumeration does not double-count projections, unplaced private paths protect recordings from pruning, missing media/unsafe paths reject before active state/path changes, and repeated save after editing does not restore stale Story tracks. Rename/Save As includes private media while preserving identity/copy rules.
- [x] **Step 2: Verify failure.** Run targeted suites named above; private manifest/sidecar/cleanup and round-trip assertions fail initially.
- [x] **Step 3: Implement traversal and ingress.** Enumerate global/root-private/all Artboard-private media once, stage manifests/sidecars under unique IDs, regenerate current Story projections after staging, and resolve canonical paths before deriving in-memory projections. Wire clone normalization at V3 load/controller initialization/open and staging as needed, with explicit legacy/raw and canonical validation order. Preserve file queue/transaction/recovery contracts; no recovery while Rename is active. Avoid filesystem deletions in editor commands.
- [x] **Step 4: Verify and commit.** All targeted bundle/controller/prune/lifecycle tests pass; commit `feat: persist every Story media scope in V3 projects`.

## Task 8: Acceptance gates, contracts, and honest QA status

**Files:** Update `ISSUE.md` issue #12 and existing Record checklist, `ROADMAP.md`, `CHANGELOG.md`, `AGENTS.md`; update this plan checkboxes and baseline report with actual results. Regenerate `graft/` only after final code changes. Extend existing acceptance suites only where a spec acceptance case lacks coverage.

**Interfaces:** Consumes completed Tasks 1–7 and unchanged screen capture/project lifecycle APIs. Produces reviewed ownership contract, exact automated results, and explicit native QA status.

- [x] **Step 1: Run acceptance scenarios.** Add integration assertions for root/A/B private and global content, shared Record source with independently editable composition, create/edit/split/trim/rate/history, template instances, publication, and latest projections after reopen. Check all ten spec acceptance items against test cases; native-only cases receive a pending label until run.
- [x] **Step 2: Verify the complete change.** Run `npm test`, `npx tsc --noEmit`, changed-file Biome checks using the existing configuration, and `git diff --check`. Compare any failures with baseline; fix newly introduced failures. Run `graft grep "assetId"` to audit remaining direct lookups and explain intentional ID-only comparisons, then `graft build`.
- [x] **Step 3: Exercise available native QA.** Repeated Record + Ctrl+S, imports, Assets-only save/reopen, two Record placements with independent edits, voiceover Finish/Discard/Stay, Rename/Save As/New, explicit legacy conversion. If the app/native recorder cannot be exercised in this environment, record those exact cases as pending without claiming success; automated coverage does not substitute for native QA.
- [x] **Step 4: Update documentation.** Replace the old global Shape contract in `AGENTS.md` with inline placement ownership plus legacy migration. Issue #12 records actual completed scope, checks/results, and native gaps. Roadmap/changelog distinguish implemented ownership from deferred finishing features and caption burn-in. Version remains `1.4.0-beta.1`.
- [ ] **Step 5: Independent review gate.** Task 8 documentation/acceptance commit is ready for coordinator review; the separate whole-branch review follows. Use Superpowers verification-before-completion and requesting-code-review, fix actionable findings, rerun only checks affected by fixes, and commit `docs: record Story ownership implementation and verification`. Do not include unrelated user changes.

## Self-review and execution handoff

Coverage: canonical model/validation (1), authority/isolation (2), migration/design/templates (3), clocks/rendering (4), UI/publication/AI/deletion (5), asynchronous voiceover (6), media/bundle/atomic ingress (7), documentation/native/regression reporting (8). All five Review Focus cases have named assertions in their owning tasks. Source lookup and caller inventories precede implementation; the cleanup caller is included through `prune.test.ts`.

Plan approved by the user on 2026-10-10 with “ok implementasikan rencana”. Executing **Subagent-driven**: ownership changes span eight dependent tasks and both rendering and file persistence; each task benefits from an independent review before the next begins. Tasks 1–7 have approved independent reviews; Task 8 and the separate whole-branch review remain pending. Native QA is explicitly pending. See [durable evidence and chronological rulings](2026-10-10-story-asset-ownership-verification.md).

