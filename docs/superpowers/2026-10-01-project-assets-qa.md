# Project Assets V3 verification

Implemented in `Experiment`, from plan base `793ad0f`. No merge or push.

The project editor opens an empty Assets library and timeline. Import and completed recording register sources only. Recording keeps screen, webcam, microphone, system audio, cursor telemetry and editable settings in one package. Timeline placements own independent compositions. The recording editor updates a composition without saving the project itself.

The V3 bundle owns every library asset under `assets/<assetId>/`, including unused recordings. `project.json` indexes packages, compositions and placements. Legacy V1/V2 are read only and convert explicitly into a separate identity/bundle. Unknown metadata and unsupported transitions/extensions reject conversion before changing the active project or original file.

## Verification evidence

- Focused domain, recording, editor and project suites: 114 tests passed before the final completion/cancellation regressions; those six regression tests also passed.
- Full suite with two workers: 889 passed; nine verified baseline failures in five files; no worker errors.
- TypeScript and production Vite renderer/Electron builds passed.
- Real bundle tests cover unused recording sidecars, deduplicated source staging, missing media, identity recovery and atomic replacement failure.
- Browser fixture URL: `http://127.0.0.1:5173/?windowType=editor`; title: `Captr Studio Editor`. Assets layout checked at 1600×1000 and 1100×800. No runtime error overlay or console errors.
- Actual screen/webcam MP4 and mic/system WAV fixtures verify duplicate completion, Assets-only save, explicit placement, library drag/drop into two independent compositions and recording editing.
- Random seek and 0.5×/2× produce identical effect pixels at equivalent source time. Microphone starts 500 ms after the screen; measured 880 Hz amplitude before its offset is below 0.000001 and after its offset is 0.125. System 440 Hz remains audible at 0.125.
- A test bridge sends the actual project frame renderer and mixed PCM through the repository's existing FFmpeg. Encoded MP4 differs from preview by mean 1.51/255 per channel at the sampled frame, within H.264 compression tolerance. This verifies the shared engine, not desktop capture or encoder IPC.
- Remaining baseline: nine failures in five retained test files (media-layer migration, audio preparation, webcam renderer mocks and loopback decoder URL). Two original failures disappeared with retired Slide exporters. Existing locale diagnostics: 248. These are not counted as successful checks.

## Native checks still pending

Run the V3 checklist in `ISSUE.md`: record twice into an already opened `.captr`; save the unused library; reopen that bundle; place, split, trim and edit shared Record sources independently; play/seek/export; Ctrl+S; Save As; New Project; unsupported legacy conversion. Windows/macOS capture, actual desktop encoder IPC, OS dialogs and project path preservation have automated coverage but have not been exercised end to end in the desktop app.

Browser plugin was unavailable; bundled Playwright and Chromium were used. No dependencies installed.
