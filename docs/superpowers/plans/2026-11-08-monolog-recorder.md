# Monolog Recorder Implementation Plan

> **For agentic workers:** Work task by task, test first (`/tdd`). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a narrator record a camera-only take ("Monolog") from inside the editor while reading a
temporary, auto-scrolling script (teleprompter). The take lands in the active project's Assets as a
Recording package, so Record editor framing, background, crop, and captions work on it.

**Architecture:** A new editor dialog (modelled on `AudioRecorderDialog`) captures camera + mic with
`getUserMedia` + `MediaRecorder` in the renderer. The file is stored through the existing
`storeRecordedVideo` IPC. A camera-specific builder turns it into a `CompletedRecording` whose
`screen` stream *is* the camera file and whose package carries `captureSource: "camera"`. It is
registered with the existing `registerRecording` command (Assets only). The teleprompter is pure
renderer state that lives only while the dialog is open.

**Tech Stack:** TypeScript, React 18, MediaRecorder, Electron IPC (existing channels only), Vitest,
Tailwind, Phosphor Icons, i18n (`useScopedT`).

## Decisions (settled in design review, 2026-11-08)

| # | Decision |
|---|---|
| Entry | "Monolog" button on the editor tool rail opens the dialog. A HUD mode is out of scope (v2). |
| Output | Recording package. Camera file is stored as `package.screen`; package has `captureSource: "camera"`. |
| Destination | Active project's Assets only — no automatic timeline placement. After save, a toast offers "Place at playhead". |
| Audio | Microphone only, with a level meter. No system audio. |
| Video | Default 1080p @ 30 fps. Falls back to the best mode the camera supports. Resolution dropdown. |
| Preview | Large preview inside the dialog, mirror toggle (preview only), 3-second countdown, elapsed timer, no duration limit. |
| Format | Whatever `MediaRecorder` produces (same path as today's webcam capture). No transcoding. |
| Retake | "Retake" discards the take. Only "Save" registers an asset. |
| Lock | While capturing: editing, save, export, and project navigation are blocked (AGENTS.md capture rules). |
| Naming | Assets named "Monolog N" (next free N); renamable like any asset. |
| Transcript | Not automatic. User triggers it via the existing transcript action. |
| Record editor | For `captureSource: "camera"`: hide Cursor and Zoom tabs, no auto-zoom suggestions. Frame, background, crop, captions stay. |
| Dialog size | Expand button toggles the dialog to full window. |
| Teleprompter | Panel at the top of the dialog (near the lens), preview below. User pastes text. |
| Script lifetime | Exists only while the dialog is open. Survives Retake and Save (scroll resets to top). Cleared on close, without a confirmation. Never written to `.captr`, settings, localStorage, or disk. No import button. Never part of the recorded video. |
| Scrolling | Starts when the countdown ends. Constant speed set by a words-per-minute slider. Space = pause/resume, ↑/↓ = faster/slower. Voice-follow is v2. |
| Text style | Font-size slider, centred reading-line marker, mirrored text toggle (off by default). |

## Global Constraints

- Follow every recording/save contract in `AGENTS.md` and the checklist in `ISSUE.md`
  ("Menambahkan Record slide meminta project baru"): Assets only, keep `currentProjectPath`, reject
  completions from an abandoned project (`importToken` / generation check).
- No new IPC channels unless unavoidable. Reuse `storeRecordedVideo`.
- Do not flatten or transcode the take. Do not create synthetic media.
- Older packages have no `captureSource` field; treat a missing value as `"screen"`. Existing V3
  projects must still load and validate unchanged.
- Preview and export keep sharing `evaluateProject`; a camera package is just a package whose
  `screen` is a camera file, so no renderer special case is needed.
- The script text must never reach the project, the controller, IPC, or any storage API.

## Review Focus

- Is storing camera video as `screen` safe in every place `pkg.screen.path` is read
  (`compositionAdapter.ts:7`, `RecordingCompositionEditor.tsx`, `AssetCard.tsx`, `AssetLibrary.tsx`,
  `ProjectEditor.tsx`, `StoryEditor.tsx`, `TimelineSourcePreview.tsx`, `SubtitleOverlay.tsx`,
  `mediaPaths.ts`, `visualAnimation.ts`)?
- Embedded mic audio: the camera file contains the mic track. It is registered as
  `microphone: { path: <same file> }`, following the existing precedent where `system` points at
  `session.videoPath` for embedded audio. Confirm the audio plan and export do not double-play it.
- Abandoned-project and navigation races during capture and finalization.
- Teleprompter state cannot leak into persistence.

---

### Task 1: `captureSource` on Recording packages

**Files:** Modify `src/recording/types.ts`, `src/core/timeline/validation.ts`,
`src/recording/packageAdapter.ts`. Test: `src/core/timeline/validation.test.ts`,
`src/recording/schema.test.ts` (or a new `captureSource.test.ts`).

- Add `captureSource?: "screen" | "camera"` to `RecordingPackage` (and so to `CompletedRecording`).
- Add `recordingCaptureSource(pkg): "screen" | "camera"` → `pkg.captureSource ?? "screen"`.
- Validation: if present, the value must be `"screen"` or `"camera"`. For `"camera"`, `cursorPath`
  must be absent.

- [ ] Failing tests: camera package validates; unknown value rejected; camera + `cursorPath` rejected;
      package without the field still validates (backward compat); helper defaults to `"screen"`.
- [ ] Implement. Run `npx vitest run src/core/timeline/validation.test.ts`.
- [ ] Bundle round-trip: a camera package survives save → reopen with `captureSource` intact
      (extend `electron/ipc/project/timelineBundle.test.ts`).

### Task 2: Camera recording builder

**Files:** Create `src/recording/completedCameraRecording.ts` + test.

`completedRecordingFromCamera({ videoPath, captureId, name }, deps = { probeMedia })` returns a
`CompletedRecording`:
- `screen = { path: videoPath, durationUs, offsetUs: 0 }`, `width`/`height` from the probe.
- `microphone = { path: videoPath, durationUs, offsetUs: 0 }` when the probe reports audio.
- No `webcam`, `system`, or `cursorPath`. `captureSource: "camera"`.
- Settings: `createDefaultRecordingSettings()` with `showCursor: false`, no `cursorTelemetry`, empty
  `zoomRegions`.

- [ ] Failing tests with an injected probe: shape above; no audio → no `microphone`; zero duration or
      zero size throws; result passes `validateTimelineProject` after `registerRecording`.
- [ ] Implement.

### Task 3: Asset naming

**Files:** `src/core/timeline/` (small pure helper, e.g. in `commands.ts` or a new
`monologNaming.ts`) + test.

- `nextMonologName(project)` → `"Monolog N"`, where N is 1 + the highest existing `Monolog <n>`
  asset name (localized prefix passed in by the caller).

- [ ] Failing tests: empty project → `Monolog 1`; gaps and renamed assets handled; non-matching names
      ignored.
- [ ] Implement.

### Task 4: Camera capture session

**Files:** Create `src/recording/cameraRecorder.ts` + test. Model it on
`src/recording/audioRecorder.ts` (injectable environment, `listInputs`, `start`, `stop`, `discard`,
`dispose`, level meter).

- `listInputs()` → `{ cameras, microphones }`.
- `openPreview({ cameraId, micId, resolution })` → the `MediaStream` for the preview + meter; asks for
  1920×1080 @ 30 ideal and reports the settings actually granted.
- `start()` records the open stream (video + audio tracks) with the first supported mime type
  (`video/webm;codecs=vp9,opus` → `vp8,opus` → `video/webm` → `video/mp4`).
- `stop()` → `{ blob, extension, durationUs }`; `discard()` drops chunks; `dispose()` stops all tracks.
- Changing a device or resolution while idle reopens the preview; while recording it is rejected.

- [ ] Failing tests with fake `MediaRecorder` / `mediaDevices`: device listing, fallback mime type,
      start/stop produce a blob, discard yields nothing, dispose stops tracks, device change during
      recording throws, permission error surfaces as a readable error.
- [ ] Implement.

### Task 5: Teleprompter scroll model

**Files:** Create `src/components/editor/monolog/teleprompterModel.ts` + test (pure, no DOM).

- State: `{ status: "idle" | "running" | "paused", offsetPx, wpm }`.
- `tick(state, dtMs, metrics)` advances `offsetPx` from `wpm`, average words per line, and line
  height; clamps at the end.
- Actions: `start`, `pause`, `resume`, `toggle`, `faster`, `slower` (step 10 wpm, clamp 60–300,
  default 140), `reset` (offset 0, status idle).

- [ ] Failing tests: speed math; clamp at end; pause stops movement; wpm clamps; reset.
- [ ] Implement.

### Task 6: Recording controller hook

**Files:** Create `src/components/editor/useMonologRecordingAssets.ts` + test. Model it on
`useAudioRecordingAssets.ts`.

- `begin()` captures `controller.importToken()` and pre-allocates `{ assetId, packageId, captureId }`.
- `finalize(token, take)`:
  1. Drop the take if the token is stale (project changed or abandoned).
  2. `storeRecordedVideo(buffer, "monolog-<ts>.<ext>")`.
  3. `completedRecordingFromCamera`, then name it with `nextMonologName`.
  4. `controller.execute(registerRecording(...))`; no timeline placement.
  5. Return `{ assetId }` so the dialog can show the "Place at playhead" toast (which uses the
     existing `placeAsset` command).
- `isActive()` feeds the editor's capture lock (same mechanism as the audio recorder:
  `pendingWork` / `fileOperation` freeze).

- [ ] Failing tests: happy path registers one recording asset and no clip; stale token discards; store
      failure leaves the project unchanged and reports an error; double finalize is a no-op;
      `currentProjectPath` / project path is unchanged afterwards.
- [ ] Implement.

### Task 7: Monolog dialog UI

**Files:** Create `src/components/editor/monolog/MonologRecorderDialog.tsx` (+ controller file if it
grows, like `audioRecorderDialogController.ts`) and `TeleprompterPanel.tsx`; tests next to them.
Modify `ProjectToolRail.tsx` (button) and `ProjectEditor.tsx` (mount, lock wiring). Add i18n keys to
`src/i18n/locales/en/editor.json` first, then run `npm run i18n:check`.

Layout (top to bottom): teleprompter panel → camera preview (mirror toggle) → device + resolution
selects, mic meter → controls. Expand button toggles full window. Follow `DESIGN.md` tokens.

States: `setup` → `countdown` (3 s) → `recording` (timer, Stop) → `review` (Save / Retake) → back to
`setup`. Close is allowed in `setup` and `review` only.

- Teleprompter: paste-only textarea in `setup`; read-only scrolling view in `countdown` /
  `recording`; WPM slider, font-size slider, reading line, mirror-text toggle. Space and ↑/↓ act on
  the teleprompter only while recording, and must not trigger editor hotkeys.
- Script state is local `useState` in the dialog; unmounting clears it.

- [ ] Failing tests: state transitions; Retake discards and resets scroll but keeps the script; Save
      calls `finalize` and keeps the script; closing clears the script; Close is disabled while
      recording; Space toggles scroll; the script string never appears in any `controller.execute`,
      `electronAPI`, or storage call (spy on all three).
- [ ] Implement. Tool rail button disabled when no project is open or another capture is active.

### Task 8: Record editor for camera packages

**Files:** Modify `src/recording/editor/RecordingCompositionEditor.tsx` (tab list) and any auto-zoom
entry point found with `graft callers buildInteractionZoomSuggestions`.

- [ ] Failing test: a `captureSource: "camera"` package hides the Cursor and Zoom tabs; a screen package
      still shows them.
- [ ] Implement using `recordingCaptureSource(pkg)`.

### Task 9: Verification and docs

- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run i18n:check`.
- [ ] Manual QA (Windows; macOS if available): record → Save → appears in Assets only → place at
      playhead → Record editor framing → export MP4 with audio in sync; Retake; close mid-review;
      Ctrl+S then reopen; two Monolog takes placed and edited independently; camera unplugged mid-take.
- [ ] Update `ISSUE.md` (contract + QA status) and the `AGENTS.md` recording section with the
      `captureSource: "camera"` rule. Run `graft build`.

---

## Revisions after EGM review (2026-11-08, implemented)

- **C1:** `storeRecordedVideo` resets `currentProjectPath`. Takes now use the new
  `save-recorded-monolog` / `discard-recorded-monolog` IPC (`electron/ipc/project/recordedAudioFile.ts`,
  `recordings/monologs/`), which has no session or path side effects.
- **C2:** `useMonologRecordingAssets.begin()` takes the `set-project-recording-finalizing` lease before
  the countdown and releases it on every exit path.
- **M1:** registration goes through `controller.acceptImport` with token checks after store and after
  probe; stale takes delete their file.
- **M2:** `hasAudio` comes from the recorder's stream, not from `probeMedia`.
- **M3:** uses `selectWebcamRecordingMimeType` / `getVideoExtensionForMimeType` and `fixWebmDuration`.
- **M4:** the lock covers save/autosave (`pendingWork`), Story navigation, Home/New/Open (`navigate`
  guard) and window close (`beforeClose` guard). The dialog is modal and uses `role="dialog"`.
- **M5:** `separateMicrophone()` stops Hyperframe from injecting a duplicate mic `<audio>`.
- **M6:** there is no "Zoom tab". The Cursor tab and the Auto zoom button are hidden, and
  `applyAutoZoomToClicks` rejects camera packages. Manual zoom (Z) stays available for punch-ins.
- **M7 (deferred):** the recorder uses a 1 s timeslice, but chunks are still kept in renderer
  memory until Save. Streaming chunks to disk is follow-up work.
- **M8:** Close in review discards the take. A track `ended` event aborts the take with an error.
  Naming is "1 + highest" (Monolog 1, 3 → Monolog 4). Permission errors map to readable messages.
