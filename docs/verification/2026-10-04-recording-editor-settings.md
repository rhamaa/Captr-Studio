# Recording editor settings verification — 4 October 2026

The recording editor exposes Scene, Cursor and Layout. Camera controls appear
inside Layout for Camera Only (full/circle) and Bubble, and stay hidden for
Screen Only (full/center). Selecting or adding a layout region opens Layout.
Zoom depth/mode/focus remain available beside the recording timeline; cut,
speed and auto zoom remain available in its toolbar.

Audio Recording and audio region editing are disconnected from this sub-editor.
The recording package, microphone/system sources and stored audio settings are
preserved. Existing composition edits still survive reload independently of
other placements.

## Checks

### Webcam crop and switch follow-up

- Reproduced both regressions in a browser fixture before the fix: no crop
  video element; switch size 27 × 22.5 px, 5 px corners, thumb outside its track.
- RecordingCompositionEditor now resolves the package webcam through the local
  media URL API and supplies source time and playback state to SettingsPanel.
  Source changes clear the preview; cancelled URL requests cannot install stale media.
- Generic editor button and hover styles exclude `role="switch"`. Webcam
  switches use the shared component's native 36 × 20 px dimensions without scaling.
- Focused tests: 22 passed across the five editor/composition/clock/layout/webcam
  sync suites. The real SettingsPanel tests now cover crop media in Bubble and
  both Camera Only presets, and its absence in Screen Only presets.
- Headless Microsoft Edge, 1440 × 1000: decoded synthetic webcam frames at
  320 × 180; seek source 5 s with webcam offset 1 s gives media 4 s, with an
  internal 2× speed region; playback/pause follows the editor. All three
  switches passed checked/unchecked/hover geometry and thumb-bound checks.
  A package without webcam and late URL resolution did not show stale media.
- Browser fixture used the real editor/settings/crop components, a loopback
  range-enabled media endpoint and mocked Electron URL API. ProjectPreview and
  RecordingTimeline were isolated to exercise crop wiring and source-time seek.
  No page errors; external Google Fonts request was blocked by the environment.
- TypeScript and diff whitespace checks passed. Biome had no errors and the
  same existing playback-effect dependency warning. Graft rebuilt.
- Native Electron webcam recordings and project reopen were not exercised for
  this follow-up. The full-suite results below belong to the earlier settings run.

### Earlier settings checks

- Test-first UI run: three expected failures (seven tabs still rendered, camera
  controls absent in the full/circle Camera Only modes), followed by six passing
  UI tests after implementation.
- Focused suite: 17 tests passed across RecordingCompositionEditor,
  compositionAdapter, playbackClock and layoutScenes.
- TypeScript: passed with no diagnostics after the final code changes.
- Biome on all six changed source/test files: no errors. One existing
  `useExhaustiveDependencies` warning remains on the playback effect's
  `outputUs` reference; its clock behavior was not changed in this task.
- `git diff --check`: passed.
- Graft index rebuilt.
- Native Electron interaction/visual QA was not exercised in this session.

## Full suite

Command: `npm test -- --configLoader runner --pool forks --maxWorkers 1`.
Result: 947 passed, 12 failed; 129 files passed, 7 failed. The focused UI tests
passed in this run. The failing tests below concern modules outside this UI
change; this run does not verify when those failures first appeared.

1. `src/components/video-editor/mediaLayerTiming.test.ts` — `multi-layer media
   contract > migrates legacy scene media layers into editable annotations`.
2. `src/lib/exporter/audioEncoder.test.ts` — `AudioProcessor offline render
   preparation > keeps embedded source audio separate from external companion
   sidecars`.
3. `src/lib/exporter/frameRenderer.test.ts` — `FrameRenderer webcam export path
   > uses the cached webcam frame when the live video is out of sync`.
4. Same suite — `keeps drawing the cached webcam frame when the live element
   temporarily has no current data`.
5. Same suite — `uses the live webcam frame and refreshes the cache when the
   video is synchronized`.
6. Same suite — `reuses the webcam bubble canvas across frames`.
7. `src/lib/exporter/modernFrameRenderer.test.ts` — `ModernFrameRenderer webcam
   export fallback > keeps the webcam live when sync uses an offset timeline`.
8. Same suite — `keeps the webcam live when the media element time is current
   but lastSyncedWebcamTime is stale`.
9. `src/lib/exporter/streamingDecoder.test.ts` — `StreamingVideoDecoder local
   media loading > loads loopback media-server URLs directly into WebDemuxer`.
10. `electron/ipc/register/project/templateWallpaperSave.test.ts` — `Template
    Background Save and .captr Self-Containment > copies template wallpaper
    into assets/<assetId>/ and saves self-contained .captr bundle`.
11. `electron/ipc/register/project/v3LifecycleVerification.test.ts` — `QA 1:
    Record dua kali pada .captr aktif, Ctrl+S tanpa Save As, buka ulang Assets
    tanpa timeline dan semua sidecar utuh`.
12. Same suite — `QA 2: Tempatkan Record dua kali, split/trim/rate/edit
    independen, import media, dan verifikasi reopen parity`.

The full suite's temporary entries in recent-projects.json were removed after
checking that the diff contained only test-generated paths.
