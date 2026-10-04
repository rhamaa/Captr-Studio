# Project Home and file naming verification — 2026-10-04

Implementation range starts at `f3ad8b0`, on Experiment. Seven task implementation, no dependency installation, no merge/push.

## Evidence

- Naming/history: 23 tests; Rename/recovery/queue: 14 tests; file service/save/load/session/context: 24 tests.
- Controller/persistence/history: 10 tests. Navigation/lifecycle/recording: 14 tests plus shell SSR. Home/dialog/navigation/shell: 9 tests.
- Final integration selection: 38 passed, including Rename → two recording registrations → Assets-only Save → bundle inspection → two independent compositions → Save As preserves original bytes and media sidecars.
- TypeScript passed. Vite production renderer/Electron/preload build passed. i18n check reports 248 pre-existing diagnostics; no additional missing keys.
- Full suite: 1007 passed / 9 failed (145 files), before two additional integration tests. Existing failures: audioEncoder embedded/companion contract (1), frameRenderer roundRect webcam mocks (4), modernFrameRenderer webcam mocks (2), streamingDecoder loopback port (1), mediaLayerTiming legacy scene migration (1). No new failure in changed components/services.

## Browser QA

Actual built Home, shell, editor and Radix name/dirty dialogs in headless Edge at 1440×1000 and 1280×800. Passed normal startup, external path search, card Open, stale-title filename normalization, Rename success, invalid reserved name, Escape/cancel, Save As cancellation/success, Home deactivation, New project, text-overlay dirty guard Cancel/Discard, first Save, collision error, long name draft, Tab focus containment. No page errors or horizontal overflow.

All Electron calls were deterministic mocks: library/Open/activation/deactivation/activity/file-operation results, native menus/window controls/settings/shortcuts/font APIs. Recording media playback and recording sub-editor native entry were not exercised by this browser fixture. Bundle tests used actual temporary filesystem files and ZIP bundles independently of the browser fixture.

Screenshots: `project-home-evidence/home-1440.png`, `home-1280.png`, `name-dialog-1280.png`.

## Native checks pending

Normal native launch and Explorer Open; Unicode/case-only rename on the actual Windows volume; occupied destination/file lock rejection; dirty Rename; native/browser repeated recording → Ctrl+S → reopen; native Save As dialog original protection; interrupted transaction relaunch; native recording sub-editor title and playback. No desktop fidelity claim.

## Execution rulings

The complete execution ledger and final review/fixes will be appended before handoff. Test-generated recent-project entries are restored only after verifying no non-test entry changed.
