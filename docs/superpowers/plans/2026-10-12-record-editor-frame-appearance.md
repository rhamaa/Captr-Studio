# Record Editor Frame Appearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independently editable Window and Webcam frame designs to Record Video, persist them per composition, and let users reuse full-design JSON presets across projects.

**Status:** Implemented; focused automated QA passes, Windows native QA pending.

**Architecture:** Composition settings own the resolved Window and Webcam appearance. The shared `FrameRenderer` draws those styles for preview and export. A versioned app-user-data preset library stores independent full-design snapshots; applying a preset copies values into only the selected composition target.

**Tech Stack:** TypeScript, React, Electron IPC, Canvas 2D, Vitest, existing `.captr` composition persistence.

**Spec:** `docs/superpowers/specs/2026-10-12-record-editor-frame-appearance-design.md`

## Global Constraints

- Store Window and Webcam styles independently in the Record composition inside `.captr`.
- Use project-coordinate pixels for frame geometry and `0`–`1` values for opacity.
- Present opacity controls as `0`–`100%`; retain normalized `0`–`1` values in the composition and preset JSON. Shadow direction is set by horizontal and vertical offsets.
- `framePadding: 0`, transparent surface, zero border, and no added shadow preserve legacy geometry; legacy corner radius and webcam shadow remain visible.
- Preview and export use the shared `FrameRenderer` path.
- Store one versioned JSON file per user preset under `userData/record-frame-presets/<preset-id>.json`, outside project media Assets.
- Applying a preset copies its full appearance into only the selected target; library and project values remain independent.
- Limit UI and renderer changes to Record Video; add no appearance keyframes.

## Review Focus

- Legacy composition without frame data: renderer retains its old window radius, webcam radius, and shadow. Test in Task 1 and Task 2.
- Partial, non-finite, negative, or extreme frame values: reject or clamp before drawing; no unbounded canvas work. Test in Task 1 and Task 2.
- Backdrop blur: blur pixels behind the frame without blurring source media. Test in Task 2.
- Malformed or unsupported preset JSON: show failure and leave library/project unchanged. Test in Task 3 and Task 4.
- Preset ID/name collision or filesystem write failure: preserve existing presets and report failure. Test in Task 4.

---

### Task 1: Composition Appearance Schema and Legacy Resolution

**Files:**
- Modify: `src/recording/schema.ts`
- Modify: `src/recording/editor/compositionAdapter.ts`
- Modify: `electron/ipc/register/project/v3LifecycleVerification.test.ts`
- Create: `src/recording/schema.test.ts`

**Interfaces:**
- Produce `RecordingFrameAppearance`, `RecordingFrameAppearances`, and optional `RecordingEffectSettings.frameAppearances` using the exact fields in the spec.
- Produce `resolveRecordingFrameAppearances(settings: Partial<RecordingEffectSettings>): RecordingFrameAppearances`.
- `resolveRecordingSettings(package, composition)` returns complete Window and Webcam appearances while retaining other resolved recording settings.

- [x] **Step 1: Write failing schema tests**

Add tests for defaults, legacy fallback from `borderRadius` and webcam radius/shadow, distinct Window/Webcam values, optional old-project field, and invalid nested values. Extend the V3 lifecycle fixture with distinct Window/Webcam appearance values and assert they survive save/reopen without becoming Assets.

- [x] **Step 2: Run tests and verify failure**

Run: `pnpm exec vitest run src/recording/schema.test.ts electron/ipc/register/project/v3LifecycleVerification.test.ts`

Expected: schema tests FAIL because frame-appearance types and resolution do not exist; lifecycle test establishes whether generic composition serialization already preserves the new fields.

- [x] **Step 3: Implement schema and resolution**

Add the appearance interfaces and nested validator in `schema.ts`. Resolve missing Window radius from legacy `borderRadius`, and missing Webcam radius/shadow from legacy webcam settings. Give new padding, border, surface, blur, and shadow fields neutral values. Normalize resolved composition settings in `compositionAdapter.ts` without overwriting explicit styles on either target.

- [x] **Step 4: Run tests and verify pass**

Run: `pnpm exec vitest run src/recording/schema.test.ts electron/ipc/register/project/v3LifecycleVerification.test.ts`

Expected: PASS, including the old-composition fallback, independent-target round-trip, and no-new-Assets assertion.

- [x] **Step 5: Commit**

```bash
git add src/recording/schema.ts src/recording/editor/compositionAdapter.ts src/recording/schema.test.ts
git commit -m "feat: add recording frame appearance settings"
```

### Task 2: Shared Frame Renderer for Window and Webcam

**Files:**
- Modify: `src/lib/exporter/frameRenderer.ts`
- Modify: `src/lib/exporter/projectFrameRenderer.ts`
- Test: `src/lib/exporter/frameRenderer.test.ts`
- Test: `src/lib/exporter/projectFrameRenderer.test.ts`

**Interfaces:**
- Consume resolved `RecordingFrameAppearances` from Task 1.
- `FrameRenderConfig` carries resolved frame appearances for the Record Video render.
- `FrameRenderer` applies Window style to the captured-window rectangle and Webcam style to the webcam rectangle.

- [x] **Step 1: Write failing renderer tests**

Test that Window and Webcam styles independently draw padding, clipped media, border opacity/color, surface, and shadow. Test that backdrop blur affects the pixels behind a layer, not its source frame. Test zero-added-style output and legacy radius/shadow fallback. Add a project-frame test proving composition styles reach the shared renderer.

- [x] **Step 2: Run tests and verify failure**

Run: `pnpm exec vitest run src/lib/exporter/frameRenderer.test.ts src/lib/exporter/projectFrameRenderer.test.ts`

Expected: FAIL because the renderer does not consume frame appearances.

- [x] **Step 3: Implement shared frame drawing**

Add one bounded frame-drawing path in `FrameRenderer` for surface, shadow, media inset, rounded clip, border, and backdrop blur. Reuse bounded offscreen drawing state for blur and clamp work to the outer frame. Feed resolved settings through `projectFrameRenderer.ts`; do not add a preview-only renderer.

- [x] **Step 4: Run tests and verify pass**

Run: `pnpm exec vitest run src/lib/exporter/frameRenderer.test.ts src/lib/exporter/projectFrameRenderer.test.ts`

Expected: PASS for both targets, legacy output, blur behavior, and composition-to-renderer flow.

- [x] **Step 5: Commit**

```bash
git add src/lib/exporter/frameRenderer.ts src/lib/exporter/projectFrameRenderer.ts src/lib/exporter/frameRenderer.test.ts src/lib/exporter/projectFrameRenderer.test.ts
git commit -m "feat: render recording frame appearances"
```

### Task 3: Preset JSON Contract and Validation

**Files:**
- Create: `src/recording/editor/recordingFramePresets.ts`
- Create: `src/recording/editor/recordingFramePresets.test.ts`

**Interfaces:**
- Produce `RecordingFramePreset` with `schemaVersion: 1`, `id`, `name`, `createdAt`, `updatedAt`, and full `appearance: RecordingFrameAppearance`.
- Produce `parseRecordingFramePreset(value: unknown): RecordingFramePreset`, rejecting unsupported versions and malformed values with a safe, user-readable error.
- Produce `serializeRecordingFramePreset(preset: RecordingFramePreset): string`.

- [x] **Step 1: Write failing JSON tests**

Test complete round-trip, whitespace-trimmed name, empty-name rejection, invalid nested design values, unsupported version, and unknown/partial payload rejection.

- [x] **Step 2: Run tests and verify failure**

Run: `pnpm exec vitest run src/recording/editor/recordingFramePresets.test.ts`

Expected: FAIL because the versioned preset contract is absent.

- [x] **Step 3: Implement the pure preset contract**

Implement version-1 validation and stable serialization using only the existing TypeScript runtime; keep filesystem and Electron concerns out of this module.

- [x] **Step 4: Run tests and verify pass**

Run: `pnpm exec vitest run src/recording/editor/recordingFramePresets.test.ts`

Expected: PASS for valid round-trip and every invalid-input case.

- [x] **Step 5: Commit**

```bash
git add src/recording/editor/recordingFramePresets.ts src/recording/editor/recordingFramePresets.test.ts
git commit -m "feat: define recording frame preset format"
```

### Task 4: App-Wide Preset Library and JSON File Operations

**Files:**
- Create: `electron/ipc/register/recordFramePresets.ts`
- Modify: `electron/ipc/handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/electron-env.d.ts`
- Create: `electron/ipc/register/recordFramePresets.test.ts`

**Interfaces:**
- Expose `window.electronAPI.recordFramePresets` methods: `list()`, `save(name, appearance)`, `rename(id, name)`, `delete(id)`, `import()`, and `export(id)`.
- Each method returns a typed success/error result; import/export return canceled results without mutating the library.
- Store and return `RecordingFramePreset` values validated by Task 3.

- [x] **Step 1: Write failing IPC/library tests**

Test app-user-data isolation, list/save/rename/delete, atomic writes, unique IDs, duplicate-name resolution, import with a new ID, export round-trip, path-safe IDs, dialog cancellation, and no mutation on malformed input or write failure.

- [x] **Step 2: Run tests and verify failure**

Run: `pnpm exec vitest run electron/ipc/register/recordFramePresets.test.ts`

Expected: FAIL because the preset library IPC is not registered.

- [x] **Step 3: Implement library storage and secure IPC**

Persist one versioned JSON file per preset under `app.getPath("userData")/record-frame-presets/`. Use validated IDs, atomic temp-file replacement, native JSON open/save dialogs, and the pure parser/serializer from Task 3. Add the narrow preload API and register the handlers in `handlers.ts`; never expose arbitrary filesystem paths to renderer code.

- [x] **Step 4: Run tests and verify pass**

Run: `pnpm exec vitest run electron/ipc/register/recordFramePresets.test.ts`

Expected: PASS for library lifecycle, JSON exchange, cancellation, and failure safety.

- [x] **Step 5: Commit**

```bash
git add electron/ipc/register/recordFramePresets.ts electron/ipc/handlers.ts electron/preload.ts electron/electron-env.d.ts electron/ipc/register/recordFramePresets.test.ts
git commit -m "feat: add shared recording frame preset library"
```

### Task 5: Record Video Appearance Panel

**Files:**
- Create: `src/recording/editor/RecordingFrameAppearancePanel.tsx`
- Create: `src/recording/editor/RecordingFrameAppearancePanel.test.tsx`
- Modify: `src/recording/editor/RecordingCompositionEditor.tsx`
- Modify: `src/recording/editor/RecordingCompositionEditor.test.tsx`
- Modify: `src/i18n/locales/en/editor.json`

**Interfaces:**
- Panel props include selected target (`"window" | "webcam"`), its resolved `RecordingFrameAppearance`, a target-scoped change callback, and the preset-library IPC API.
- `RecordingCompositionEditor` writes changes through the existing composition update path and keeps the unselected target unchanged.

- [x] **Step 1: Write failing panel/editor tests**

Test contextual target routing by tab/layout mode, raw-value editing, full snapshot save, apply-to-contextual-target only, rename/delete, import/export actions, cancellation, and visible failure messages. Test composition updates retain the other target's settings.

- [x] **Step 2: Run tests and verify failure**

Run: `pnpm exec vitest run src/recording/editor/RecordingFrameAppearancePanel.test.tsx src/recording/editor/RecordingCompositionEditor.test.tsx`

Expected: FAIL because the panel and its composition integration do not exist.

- [x] **Step 3: Implement panel and editor integration**

Embed raw fields for padding, border width/color/opacity, radius, surface color/opacity, blur, and shadow in Scene/Layout according to selected layout mode; do not add a dedicated Appearance tab or target switch. Add a library picker plus save, rename, delete, import, and export actions. Every preset apply copies all style fields to the contextual target only.

- [x] **Step 4: Run tests and verify pass**

Run: `pnpm exec vitest run src/recording/editor/RecordingFrameAppearancePanel.test.tsx src/recording/editor/RecordingCompositionEditor.test.tsx`

Expected: PASS for target isolation, raw editing, preset lifecycle, and composition updates.

- [x] **Step 5: Commit**

```bash
git add src/recording/editor/RecordingFrameAppearancePanel.tsx src/recording/editor/RecordingFrameAppearancePanel.test.tsx src/recording/editor/RecordingCompositionEditor.tsx src/recording/editor/RecordingCompositionEditor.test.tsx src/i18n/locales/en/editor.json
git commit -m "feat: add Record Video appearance controls"
```

### Task 6: Regression Verification and QA Notes

**Files:**
- Modify: `ISSUE.md`

**Interfaces:**
- Use the public composition/settings contract from Task 1 and existing V3 project save/reopen lifecycle.
- No project bundle schema or media Asset changes are introduced.

- [x] **Step 1: Verify the `.captr` round-trip regression**

Run: `pnpm exec vitest run electron/ipc/register/project/v3LifecycleVerification.test.ts`

Expected: PASS; distinct Window/Webcam styles survive save/reopen, no preset data appears in project Assets, and older composition fixtures still load.

- [x] **Step 2: Fix only lifecycle integration gaps**

Keep composition settings authoritative. Do not add global Assets, synthetic media, or sidecars for style/preset data. Preserve canonical V3 project serialization.

- [x] **Step 3: Run focused suite and type check**

Run: `pnpm exec vitest run src/recording/schema.test.ts src/recording/editor/recordingFramePresets.test.ts src/recording/editor/RecordingFrameAppearancePanel.test.tsx src/recording/editor/RecordingCompositionEditor.test.tsx src/lib/exporter/frameRenderer.test.ts src/lib/exporter/projectFrameRenderer.test.ts electron/ipc/register/recordFramePresets.test.ts electron/ipc/register/project/v3LifecycleVerification.test.ts`

Expected: PASS.

Run: `pnpm exec tsc --noEmit`

Expected: exit code `0`.

- [x] **Step 4: Record native QA status and update issue log**

Attempt native verification when a native session and representative project are available. Otherwise record Windows native QA as not run in `ISSUE.md`; include exact automated test scope and remaining limitation.

- [x] **Step 5: Commit**

```bash
git add ISSUE.md
git commit -m "test: verify Record Video appearance persistence"
```
