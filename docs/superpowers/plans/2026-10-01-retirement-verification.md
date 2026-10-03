# Retirement verification — 1 October 2026

Scope: remove Video/Motion slide implementations and runtime consumers. Keep Record as the foundation for the separately planned OpenCut workspace and recording compound clips. No OpenCut UX parity claim in this change.

## Implemented

- Removed all 37 tracked files under `src/slides/video` and `src/slides/motion`; no replacement legacy runtime.
- Record-only registry, timeline adapter, editor actions, validation and migration.
- Reject unsupported V1/V2 envelopes as a whole before workspace copy, project/path mutation or normalization; implicit uploaded V1 clips count as Video.
- Compatibility failures also display when a file association opens the app from a cold start.
- Record capture, cursor/spring/motion blur helpers and generic media/audio layers retained.
- Updated `ISSUE.md` and `AGENTS.md` compatibility and save/reopen checklist.

## Evidence

- TypeScript `--noEmit`: pass after the review fix.
- Final renderer/Electron Vite build: pass (exit 0).
- Record/guard/persistence focused suite: 67/67 pass.
- Review fix + session/project/migration focused suite: 26/26 pass. Four tests exercise the real project state with both IPC session handlers, pending native preservation consumed once, and explicit browser preservation.
- Registry assertion fails on source snapshot `3725303` with Video/Motion present; passes after retirement.
- Startup error tests: simulated old behavior 2 fail/1 pass; fixed behavior 3/3 pass.
- Final full suite after startup fix: 895 pass, 11 fail, 116 files (906 tests), exit 1. Every failure independently reproduced on source snapshot `3725303` using the same dependencies/configuration; no additional failure introduced.
- i18n check: 248 diagnostics on both current and baseline, exact comparison has zero differences. No locale changes.
- Fresh reviewer: no Critical findings; one Important cold-start message finding fixed; no deferred minors.
- Graft rebuilt after retirement. No indexed imports of `slides/video` or `slides/motion` remain.

## Existing failures retained

Eleven failing tests across these seven files:

- `electron/ipc/export/globalStitcher.test.ts`: normalization filtergraph expectation.
- `src/core/export/multiSlideExporter.test.ts`: default transition expectation.
- `src/components/video-editor/mediaLayerTiming.test.ts`: legacy media-layer fixture/migration.
- `src/lib/exporter/audioEncoder.test.ts`: embedded/companion source separation expectation.
- `src/lib/exporter/frameRenderer.test.ts`: four canvas mock `roundRect` failures.
- `src/lib/exporter/modernFrameRenderer.test.ts`: two graphics mock `roundRect` failures.
- `src/lib/exporter/streamingDecoder.test.ts`: expected loopback port differs.

## Manual QA still pending

Native capture with webcam/microphone/system audio; adding a second Record with an empty active source reference; actual Ctrl+S destination; close/reopen `.captr`; cursor/zoom playback; Record export fidelity; Save As/New Project; compatibility dialog in an actual desktop launch. Native UI control is unavailable in this session. IPC tests cover path handling but do not prove device capture or full renderer interactions.

Ordinary video import/drag/trim/split acceptance belongs to the future general timeline implementation.

## Rulings

1. Execute in the existing Experiment checkout, following approved direct execution. Cost if wrong: changes share that checkout; commits provide rollback.
2. Retain independently reproduced baseline test/i18n failures rather than repair unrelated behavior in retirement. Cost if wrong: those issues remain; this branch is not declared merge-ready.
3. Native QA remains unverified; do not infer fidelity from unit tests/build. Cost if wrong: device or desktop interaction regressions could remain.
4. Retain inherited save-before-open behavior: saving current edits before a rejected open may legitimately clear dirty state. Cost if wrong: users wanting the previous dirty marker preserved will see it cleared after successful save; unsaved edits are protected.
5. General malformed-project/unknown-extension behavior and future OpenCut functionality remain separate from retirement. Cost if wrong: existing malformed-input behavior remains; the new timeline is not yet available.
