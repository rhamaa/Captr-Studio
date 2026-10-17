# Story Editor Finishing Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Execute natively per the user's standing preference; commit only when each task is complete.

**Goal:** Deliver the five approved Story Editor finishing stages.

**Architecture:** Extend the current immutable TimelineProject commands and the shared Canvas renderer. Story/Artboard ownership and independent Record compositions remain authoritative. Reuse existing audio peaks, media transport and UI controls.

**Tech Stack:** TypeScript, React, Canvas 2D, Vitest, Electron IPC already installed.

**Spec:** `docs/superpowers/specs/2026-10-17-story-finishing-design.md`

## Global constraints

- Fixed Artboard dimensions, V3 backward compatibility, inline Text/Shape, source/package integrity and canonical ownership follow `AGENTS.md`.
- No new dependencies. Native execution. One commit per completed task.
- Record the baseline before changes. Every nontrivial new behavior gets a RED→GREEN test; every completed task gets targeted suites and TypeScript. Run the whole suite at the end and report every remaining failure.

## Task 1: Stabilization

**Files:** failing test/production files identified by the recorded baseline; `ISSUE.md`.

- [ ] Run full Vitest JSON report and classify all failures by cause.
- [ ] Reproduce product failures with existing/focused tests (RED), fix root causes, rerun (GREEN).
- [ ] Record environment/native limitations explicitly and commit completed stabilization.

## Task 2: Final captions

**Files:** `src/core/story/storyTypes.ts`, new `src/core/timeline/storyCaptions.ts`, `src/core/timeline/storyPresentation.ts`, `src/components/editor/StoryEditor.tsx`, new caption panel, `src/lib/exporter/projectFrameRenderer.ts`, relevant renderer/bundle tests.

**Interfaces:** StorySubtitleSettings gains optional timeline `segments` and style/position fields. `generateStoryCaptions(project, transcripts)` maps sources; `updateStoryCaptions(project, settings)` returns a validated clone; shared `drawStoryCaptions(ctx, project, timeUs)` paints frames.

- [ ] RED: trimmed/rated and nested Record mapping, invalid times/style, owner isolation/undo and canvas caption drawing.
- [ ] Implement optional schema, commands, panel and renderer burn-in; remove duplicate final caption DOM overlay.
- [ ] GREEN: caption, ownership, presentation, renderer and bundle suites; TypeScript; commit.

## Task 3: Real waveform and filmstrip

**Files:** `src/components/editor/TimelineClipItem.tsx`, new timeline source preview component/helper, existing audio waveform generator/hook, `projectEditor.css`.

**Interfaces:** real peaks feed an SVG path with sourceIn/rate; filmstrip source sampling maps clip time to source/Record time.

- [ ] RED: silence/real peaks, trimmed/rated source selection, bounded thumbnail sampling.
- [ ] Replace synthetic waveform; add bounded cached thumbnail loading and resource cleanup.
- [ ] GREEN: timeline and helper tests, TypeScript; commit.

## Task 4: Editing workflow

**Files:** new `src/core/timeline/editingCommands.ts` and tests, timeline types/validation/commands, `StoryEditor.tsx`, `ProjectTimeline.tsx`, `TimelineClipItem.tsx`, `timelineInteractions.ts`, audio planning/playback/export.

**Interfaces:** copy/paste snapshots (new IDs/compositions), attribute copying, group/link IDs on clips, atomic group movement, unlink/relink audio, optional fade durations on clips with a shared gain envelope.

- [ ] RED: owner-safe paste, independent compositions, locked-member atomicity, grouped movement, linked AV timing/no doubled audio, fade endpoints.
- [ ] Implement commands and visible controls/shortcuts, integrate gestures and shared audio envelope.
- [ ] GREEN: editing, commands, history, interactions, audio and bundle suites; TypeScript; commit.

## Task 5: Visual finishing

**Files:** timeline types/validation, new visual controls/helper tests, `ProjectInspector.tsx`, shared renderer, keyframe curve UI.

**Interfaces:** optional placement visual settings (crop/mask/color) and existing cubic-bezier PropertyKeyframe values.

- [ ] RED: invalid crop/mask/color/curve, immutable edits, renderer operations and persistence.
- [ ] Add inspector controls and shared renderer evaluation; reuse existing keyframe controls with an editable SVG curve.
- [ ] GREEN: visual, renderer, validation, keyframe and lifecycle suites; TypeScript; commit.

## Review focus

- Caption trim/rate/Record clock mapping and half-open boundaries.
- Locked/hidden tracks and atomic edits across group/link relations.
- Stale async thumbnail/audio loads after Story switches and bounded resource use.
- New optional metadata through normalization, duplicates, save/reopen and Story projection.
- Preview/export parity for fades, captions, masks/color and transitions.

## Final verification

- [ ] Full suite + TypeScript + diff check; review all stage diffs.
- [ ] Refresh graft. Update docs, issue QA status and changelog with actual results.
- [ ] Report remaining native/environment limitations explicitly.
