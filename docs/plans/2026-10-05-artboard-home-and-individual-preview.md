# Artboard Home & Individual Video Preview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Multi-Artboard Hub into the authoritative main page of `.captr` projects with empty default state, docked Asset Library, inline renaming for multiple videos, and independent individual preview playback per video card without global playhead.

**Architecture:** Remove centralized transport controls and bottom slicing timeline from the Artboard Hub canvas. Dock `<AssetLibrary />` on the left sidebar to provide instant access to project media assets. Enable per-card local state for playhead and playback with dedicated offscreen frame evaluation, inline title editing, and preset quick-pick empty state.

**Tech Stack:** React 18, TypeScript, Phosphor Icons, Vitest.

---

### Task 1: Empty Default Artboards & Rename Command

**Files:**
- Modify: `src/core/timeline/repurposeCommands.ts`
- Modify: `src/core/timeline/repurposeCommands.test.ts`

**Step 1: Write failing test in `repurposeCommands.test.ts`**
- Test `createDefaultRepurposeBoard` returns `artboards: []`.
- Test `renameRepurposeArtboard(project, artboardId, newName)` updates artboard name.

**Step 2: Run test to verify failure**
- `npx vitest run src/core/timeline/repurposeCommands.test.ts`

**Step 3: Implement minimal code**
- In `repurposeCommands.ts`:
  - Set `artboards: []` in `createDefaultRepurposeBoard`.
  - Update `ensureRepurposeBoard` to only initialize if `!project.repurposeBoard` (not checking `artboards.length > 0`).
  - Add `renameRepurposeArtboard(project, artboardId, name)`.

**Step 4: Verify test passes**
- `npx vitest run src/core/timeline/repurposeCommands.test.ts`

**Step 5: Commit**
- Git commit changes.

---

### Task 2: Individual Card Playback, Scrubber, & Inline Rename in `RepurposeArtboardCard.tsx`

**Files:**
- Modify: `src/components/repurpose/RepurposeArtboardCard.tsx`

**Step 1: Write tests for card playback and rename**
- Verify card has individual play/pause button.
- Verify card allows renaming via inline input.

**Step 2: Implement individual playback & rename**
- Add `localPlaying` and `localPlayheadUs` state to `RepurposeArtboardCard`.
- Add local tick loop with `requestAnimationFrame` when `localPlaying` is true.
- Add local `<ProjectPreview />` offscreen renderer for each card at `localPlayheadUs`.
- Add Play/Pause button and clickable mini-scrubber bar to card footer.
- Add inline editing state `isEditingName` and `<input>` for renaming.

**Step 3: Verify tests pass**
- `npx vitest run src/components/repurpose/`

**Step 4: Commit**
- Git commit changes.

---

### Task 3: Artboard Hub Redesign with Docked Assets & Empty State in `RepurposeBoardEditor.tsx`

**Files:**
- Modify: `src/components/repurpose/RepurposeBoardEditor.tsx`
- Modify: `src/components/editor/projectEditor.css`

**Step 1: Update `RepurposeBoardEditorProps`**
- Add asset management props (`assets`, `packages`, `selectedAssetId`, `onImport`, `onRecord`, `onRecordAudio`, `onPreviewAsset`, `onRemoveAsset`).
- Remove global `playheadUs` and `onSeek` requirements from header.

**Step 2: Refactor UI layout**
- Remove global transport controls (`⏮ ▶ ⏭ 00:00.00 / 00:16.95`) from header.
- Remove bottom timeline bar (`repurpose-timeline-bar`).
- Add docked Asset Library sidebar on the left with collapse/expand toggle.
- Add empty state on canvas when `board.artboards.length === 0` with quick preset selection cards (`9:16`, `1:1`, `16:9`, `4:5`, etc.).
- Allow multiple artboards of the same ratio.

**Step 3: Verify tests pass**
- `npx vitest run src/components/repurpose/`

**Step 4: Commit**
- Git commit changes.

---

### Task 4: Parent Integration in `ProjectEditor.tsx`

**Files:**
- Modify: `src/components/editor/ProjectEditor.tsx`

**Step 1: Pass Asset Library handlers into `RepurposeBoardEditor`**
- Connect `assets`, `packages`, `onImport`, `onRecord`, `onRecordAudio`, `onPreview`, `onRemove`.
- Handle `renameRepurposeArtboard` in `onChange`.

**Step 2: Verify all editor tests pass**
- `npx vitest run src/components/editor/ProjectEditor.test.tsx`

**Step 3: Commit**
- Git commit changes.

---

### Task 5: Type Check, Graft Build, & Documentation

**Files:**
- Modify: `ISSUE.md`

**Step 1: Type check**
- `npx tsc --noEmit`

**Step 2: Refresh graft context graph**
- `npx graft build`

**Step 3: Record changes in `ISSUE.md`**
- Add entry for Artboard Home, Docked Assets, Empty Default, and Individual Preview.

**Step 4: Commit**
- Git commit changes.
