# Retire Video/Motion Slides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Recommended execution: native in this session; no delegation unless the user chooses it.

**Goal:** Remove src/slides/video and src/slides/motion with their runtime wiring while retaining working Record capture/edit/save/export as the foundation for the OpenCut UX transition.

**Architecture:** Retire the two slide modules atomically with their consumers. Reject unsupported legacy projects before loading or normalization can discard their contents. Keep Record render/capture paths and generic media/audio helpers; a later plan adds the general project timeline.

**Tech Stack:** React 18, TypeScript, Electron, Vitest; existing capture/export backends.

**Spec:** ../specs/2026-10-01-timeline-record-compound-design.md

## Global Constraints

- User explicitly requests deletion of src/slides/video and src/slides/motion; do not relocate their implementation to keep it active.
- Preserve Record native/browser capture, cursor effects, webcam, audio, auto-zoom and motion blur.
- One .captr per project; preserve currentProjectPath and verify projectId when recovering the active save target.
- Preserve slides/<ownerId>/ media organization and project.json as index.
- Legacy Video/Motion bundles are rejected without overwrite or partial conversion.
- OpenCut live/classic at https://opencut.app is the UX baseline, not the rewrite branch.

## Review Focus

1. Mixed Record/Video legacy deck must be rejected as a whole; no silent filtering.
2. Legacy clip with origin uploaded and no slideMode must not default into a Record package.
3. Rejected load must leave the active project/path/dirty state untouched.
4. Deleting Motion slide code must retain Record motion blur and spring/cursor helpers.
5. New recording added to a project containing only remaining Record clips must preserve Ctrl+S destination, including Windows native finalization.

## File boundaries

Delete all tracked files under src/slides/video/ and src/slides/motion/ after consumers are detached. Before deletion inventory tracked and untracked files; never discard unrelated/untracked work. Inspect the actual file list, verify both resolved directory targets are within the workspace, use native PowerShell LiteralPath file operations.

Modify:

- src/slides/index.ts: register/export Record only.
- src/core/slides/types.ts: remove active Video/Motion metadata types; keep supported extension contract if still needed by external callers.
- src/core/project/projectValidation.ts: supported schemas only.
- src/core/project/backwardCompat.ts: remove Video/Motion migration; fail unsupported envelopes explicitly.
- src/components/video-editor/types.ts and clipsUtils.ts: remove retired constructors/settings contracts; retain generic video layers in Record.
- src/components/video-editor/projectNormalization.ts: detach retired validators and avoid coercing legacy modes into Record.
- src/components/video-editor/timeline/TimelineEditor.tsx: delegate only to RecordSlideTimeline during this phase.
- src/components/video-editor/VideoEditor.tsx: remove retired hooks, previews, code editor, state, actions, timeline props and export branches.
- Actual load entry points discovered through graft callers of migration/normalization: call support validation before mutating editor/path state.
- src/core/export/slideChunkExporter.test.ts, multiSlideExporter.test.ts, src/core/project/backwardCompat.test.ts: replace feature-specific tests with Record and explicit unsupported-project cases.
- ISSUE.md, AGENTS.md: update regression requirements for retired Video/Motion modes; retain path/identity and Record requirements.

Create src/core/project/legacySupport.ts and legacySupport.test.ts. This module inspects raw serialized envelopes; it imports no retired implementation.

## Task 1: Guard legacy envelopes before state mutation

**Interfaces:**

`getRetiredSlideIssues(value: unknown): Array<{ id: string | null; kind: "video" | "motion" }>` in legacySupport.ts. Inspect V2 slides by type, V1 clips by slideMode, and origin uploaded when slideMode is absent. Malformed unrelated input remains the existing validator's responsibility.

`assertSupportedLegacyProject(value: unknown): void` throws a named UnsupportedLegacySlidesError carrying issues and user-facing instruction to open with the previous Captr version. This guard must run before normalization, project/path assignment, autosave scheduling, or migration.

- [x] Write legacySupport.test.ts: Record-only → []; explicit video/motion → issues with matching IDs; uploaded V1 clip without slideMode → video issue; mixed project throws; input remains deep-equal after checking.
- [x] Run npm test -- src/core/project/legacySupport.test.ts; expect failure because guard does not exist.
- [x] Implement the guard and error in legacySupport.ts.
- [x] Run graft callers migrateV1ProjectToV2 --depth all and graft callers normalizeClipEntries --depth all; read named load entry spans. Wire guard before load mutation; add integration test in the owning load test proving rejected load never calls state/path setters or schedules autosave.
- [x] Run focused guard/load tests; expect pass.
- [x] Commit only guard and integration changes: feat(project): reject retired slide projects before loading.

## Task 2: Remove both modules and every active consumer atomically

**Interfaces:** Existing RecordSlideTimelineProps/Handle and RecordSlideMeta remain canonical during this phase. TimelineEditor accepts Record props only; no motionProps/videoProps. All migration callers consume Task 1 guard.

- [x] Run graft grep "slides/video" and graft grep "slides/motion", inspect imports and consumers; also inspect src/slides/index.ts relative registrations. Run graft callers createMotionClip --depth all and callers for actual constructors/hooks being changed. Graph type edges can be absent, so literal hits remain mandatory.
- [x] Add/update tests: registry exposes Record and excludes Video/Motion; unsupported migration throws instead of producing a partial deck; Record metadata round-trip retains cursor/webcam/mic/system audio paths. Run those tests and record expected pre-change failures.
- [x] Remove types, validators, migrations, constructors and normalized retired metadata. Preserve raw-envelope detection from Task 1. Remove UI add/import Motion/Video-slide actions and all retired editor state/hook/preview/export branches. Generic video import is introduced by the later timeline plan; do not expose a broken import button during this intermediate phase.
- [x] Simplify TimelineEditor to Record delegation and detach retired registry exports. Inspect all non-module callers found by compiler; fix them in this task.
- [x] Inventory and delete tracked contents of both named directories after workspace boundary validation. No move-to-legacy workaround. Preserve Record motionSmoothing, pixi motion-blur imports, generic media sources, native capture and encoder helpers.
- [x] Update outside tests that import removed schemas; keep meaningful Record export coverage and unsupported cases instead of deleting entire test suites.
- [x] Run local TypeScript compiler with --noEmit and focused project/export/Record tests; expect pass and no missing-module errors. Search indexed imports again, then fallback filesystem Select-String for unindexed source/config/test files; expect zero runtime imports or registrations of removed modules.
- [x] Commit atomic retirement: refactor(editor): remove video and motion slide modules.

## Task 3: Verify Record foundation and document the new compatibility boundary

**Interfaces:** Existing Record capture/save/export APIs; no new recorder protocol.

- [ ] Add integration regression where Task 2 changed active mode dispatch: recording appended despite empty videoSourcePath when Record clips exist; active path survives Windows/browser/native finalization; mismatched projectId cannot overwrite another bundle.
- [ ] Run tests to expose any missing protection; fix only retirement-related regressions.
- [ ] Update ISSUE.md/AGENTS.md: replace retired Video/Motion-add checks with safe legacy rejection; schedule ordinary video import acceptance for the forthcoming timeline phase. Keep pending manual checks pending until performed.
- [ ] Run npm test -- --reporter=dot, TypeScript --noEmit, and npm run i18n:check. Investigate failures; do not mark success for an interrupted or hanging suite.
- [ ] QA app: Record capture with webcam/mic/system audio; append second recording; Ctrl+S same .captr; close/reopen; cursor/zoom preview and Record export; Save As and New Project; reject old Video/Motion/mixed project without changing active project. On unavailable platform mark that QA explicitly unverified.
- [ ] Run graft build after the multi-file change; verify graph reflects deleted modules. Commit docs/tests/fixes: test(record): verify editor after retiring slide modules.

## Handoff and subsequent plans

This plan intentionally covers retirement only. Subsequent independently reviewed plans cover (1) RecordingPackage/RecordComposition and clock mapping, (2) OpenCut workspace/media library/general timeline operations, (3) V3 .captr persistence, (4) shared preview/export evaluator.

OpenCut UX acceptance requires project-library/navigation, media import, drag to timeline, selection→inspector, trim/split/snapping, playback/seek, save/reopen, and export. Record-specific difference: Capture creates an asset package, double-click opens its internal editor. No claim of exact feature parity until these flows are compared using the same media and gestures.

Self-review: all retirement consumers identified by graph are in Task 2; raw-envelope guard prevents silent metadata loss; Review Focus cases have assigned tests/QA; no product implementation occurs as part of writing this plan.

Execution: automated retirement and review fix committed; final evidence in [retirement verification](2026-10-01-retirement-verification.md). Desktop QA and renderer append interaction remain pending; full-suite and i18n baseline failures remain documented. No merge readiness claim.
