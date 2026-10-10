# Story asset ownership pre-implementation baseline

Recorded 2026-10-10 on Experiment, base 0a439ce. No production source changes existed during these runs.

- `npm test` under the workspace sandbox: exit 1, 208 failed files, no tests collected; Vitest temporary-cache rename EPERM. This is an infrastructure failure, not a product baseline.
- Approved unsandboxed `npm test`: exit 1, 8 failed / 200 passed files; 26 failed / 1322 passed tests (1348 total), 211.43 seconds. Although started before test edits, delayed module loading picked up 14 new Task 1 RED assertions appended to validation.test.ts. Those 14 are explicitly excluded from the pre-existing failure list below; the other 12 failures span 7 files. Two new test files were not part of initial discovery.
- Original `npx tsc --noEmit`: exit 0, empty diagnostics, launched before any test or production changes. A second unsandboxed run also exited 0 before production edits. Test files are excluded by tsconfig; the fixture existed by the second run and used a bounded cast. The original run is the baseline.
- Full-suite test-generated recent-projects.json restored byte-for-byte from HEAD after completion.

## Pre-existing failing tests (12)

-  electron/ipc/project/manager.test.ts > local media path policy > validates a V3 library before installing it and approves unused media
-  src/components/video-editor/mediaLayerTiming.test.ts > multi-layer media contract > migrates legacy scene media layers into editable annotations
-  src/lib/exporter/audioEncoder.test.ts > AudioProcessor offline render preparation > keeps embedded source audio separate from external companion sidecars
-  src/lib/exporter/frameRenderer.test.ts > FrameRenderer webcam export path > uses the cached webcam frame when the live video is out of sync
-  src/lib/exporter/frameRenderer.test.ts > FrameRenderer webcam export path > keeps drawing the cached webcam frame when the live element temporarily has no current data
-  src/lib/exporter/frameRenderer.test.ts > FrameRenderer webcam export path > uses the live webcam frame and refreshes the cache when the video is synchronized
-  src/lib/exporter/frameRenderer.test.ts > FrameRenderer webcam export path > reuses the webcam bubble canvas across frames
-  src/lib/exporter/modernFrameRenderer.test.ts > ModernFrameRenderer webcam export fallback > keeps the webcam live when sync uses an offset timeline
-  src/lib/exporter/modernFrameRenderer.test.ts > ModernFrameRenderer webcam export fallback > keeps the webcam live when the media element time is current but lastSyncedWebcamTime is stale
-  src/lib/exporter/streamingDecoder.test.ts > StreamingVideoDecoder local media loading > loads loopback media-server URLs directly into WebDemuxer
-  electron/ipc/register/project/v3LifecycleVerification.test.ts > V3 Lifecycle & Regression Verification Suite > QA 2: Tempatkan Record dua kali, split/trim/rate/edit independen, import media, dan verifikasi reopen parity
-  electron/ipc/register/project/v3LifecycleVerification.test.ts > V3 Lifecycle & Regression Verification Suite > persists clip transitions, component animation, and pathless shapes through save and reopen

Raw logs remain in `.superpowers/sdd/2026-10-10-story-asset-ownership/task-1-baseline-*.log`. The manager/lifecycle failures include recent-projects.json access errors (`UNKNOWN: unknown error, open`). Do not treat native QA as completed. Final comparison is recorded below and in the durable verification notes.

## Task 8 final comparison (2026-10-10)

Final default-parallel npm test: exit 1, 211 passed / 5 failed files; 1491 passed / 9 failed tests (1500 total), 113.38 seconds. Exact original twelve failures reconcile to nine unchanged and three resolved (manager unused-media case and both lifecycle cases); zero introduced failures remain. The two introduced ownership fixture mismatches were corrected without weakening validation; a transient Windows Rename journal EPERM passed targeted and final runs. Original 14 Task 1 RED assertions are excluded from pre-existing failures.

Final tsc exits 0. Existing-config changed-path Biome: baseline 106 errors/22 warnings in 83 existing files at 0a439ce; final 42 errors/22 warnings across 97 files, with all 14 added files clean and no new path/category/severity/description keys or increased counts. Safe test formatting/import fixes removed new diagnostics. Diff check and final graft build exit 0; recent-projects.json is byte-identical HEAD after all writers. Native QA remains pending.

See [durable acceptance, exact twelve-case comparison, diagnostic inventory, review dispositions and chronological rulings](2026-10-10-story-asset-ownership-verification.md).
