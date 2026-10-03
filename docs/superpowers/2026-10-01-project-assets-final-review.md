# Project Assets V3 — final review and execution record

Plan: `plans/2026-10-01-project-assets-no-slides.md`. Spec: `specs/2026-10-01-project-assets-no-slides-design.md`.

Implementation was executed natively in the user-approved `Experiment` checkout, beginning at `793ad0f`. Tasks 1–7 are committed through `e580b2b`. A fresh reviewer examined that entire immutable range against the design, plan, review focus and ledger. All six findings were independently graded Important and accepted; no Minor findings were reported. One fix pass followed; no second review was requested.

| Finding | Final change and evidence |
| --- | --- |
| Close could lose unsaved Assets/edits | Controller dirty state is published to Electron immediately. Save-before-close waits for the current saved revision; cancellation, failure and edits during saving block close. Controller RED→GREEN and browser integration passed. |
| Capture could finish before the editor subscribes | HUD/recorder has stable project/capture identity. Bootstrap snapshots current completion before reloading a bundle, and hook replays it with project/generation checks and deduplication. Cold and existing-project browser fixtures preserve Assets-only registration and save path. |
| Undo followed by alternate edit reused stale effects | Bounded effect cache uses immutable composition identity and canvas dimensions, so different branches with equal revision numbers cannot collide. Regression first failed with stale configuration, then passed. |
| OS-open and cold legacy-open lost renderer state/token | Full cold open result is queued once. Warm requests queue a path until the renderer protects dirty work. V3 installation refreshes renderer state; legacy cancel releases the candidate. Handoff/bootstrap RED→GREEN and browser cancel/discard/open checks passed. |
| Converted copy could overwrite its original | Dedicated save-copy IPC uses server-owned conversion provenance. It rejects equal canonical paths and file identities, and requires a new project ID before staging. Real bundle test verifies original bytes/path on rejection and successful separate copy. |
| Effect panels inherited a conflicting light theme | Project subtree uses the dark component contract; project-local color variables no longer collide with HSL component variables. Browser regression saw white panel before the fix and dark panel after, while saved theme preferences stayed unchanged. |

Final verification: 900 passed, nine verified baseline failures in five files, 909 tests / 126 files, zero worker errors. TypeScript, renderer/Electron production build and Graft refresh passed. Locale diagnostics remain exactly 248. Browser lifecycle/cold-capture/existing-capture and shared-engine MP4/audio fixtures passed with zero console errors; equivalent source-time pixels match across random seek and 0.5×/2×, and encoded sample mean channel difference is 1.51/255.

Commands: `npm test -- --maxWorkers=2`, `npx tsc --noEmit`, `npx vite build --config vite.config.ts`, `npm run i18n:check`, `graft build`. Baseline failure files: `src/components/video-editor/mediaLayerTiming.test.ts` (1), `src/lib/exporter/audioEncoder.test.ts` (1), `src/lib/exporter/frameRenderer.test.ts` (4), `src/lib/exporter/modernFrameRenderer.test.ts` (2), `src/lib/exporter/streamingDecoder.test.ts` (1). The first two concern legacy media/audio assumptions, six renderer failures use incomplete Graphics mocks, and the decoder test expects a different loopback port.

Native capture hardware, desktop encoder IPC, OS dialogs and end-to-end `.captr` save/reopen remain pending in `ISSUE.md`; browser test bridges are not evidence of native fidelity. The branch is preserved without merge or push.

## Rulings I made

The complete ordered ledger rulings are copied below before deleting only this plan's temporary workspace.

- Ruling: preserve approved native execution in Experiment checkout — user explicitly approved this plan; no new worktree/install. Cost if wrong: shares checkout; commits provide rollback.
- Ruling: infer version 1 only for historical bundles with clips/video source and no version field — actual earlier bundles use that shape and strict conversion still checks every supported field — cost if wrong: an unknown historical schema is presented for explicit conversion, which can still reject without modifying it.
- Ruling: retired Slide exporters and orphaned Slide helper tests are removed with their runtime — they cannot validate the new project exporter; retained decoder/encoder/effect tests still run — cost if wrong: historical Slide-only behavior has no regression coverage in this version.
- Ruling: preview/export use the retained pitch-preserving audio decoder/WSOLA and desktop encoder through one project evaluator — shared effects/time mapping replaces the two former preview/export owners — cost if wrong: native GPU/capture parity needs the pending desktop QA; renderer/FFmpeg fixture evidence covers the shared engine only.
- Ruling: full-suite gate means no new failures against the verified baseline, not erasing unrelated failures — nine retained failures and 248 existing locale diagnostics are reported separately — cost if wrong: those baseline defects remain in the branch.
- Final: Ruling: native capture hardware, desktop encoder IPC, OS dialogs and save/reopen fidelity remain unverified — reviewer declined static judgment and the approved plan permits explicit pending native QA; cost if wrong: platform integration defects may still surface during the ISSUE.md desktop checklist.
- Final: Ruling: deleted Slide-only exporters/tests stay retired — reviewer declined to judge intentional removals; required decoder/effect/encoder tests remain and new project export has engine fixtures; cost if wrong: a historical Slide behavior must be rebuilt in the composition model if later needed.
- Final: Ruling: baseline test and locale failures remain outside this feature fix pass — reviewer declined unrelated baseline work; results are reported rather than called success; cost if wrong: nine existing test defects and 248 locale diagnostics remain.

## Deferred minors

None. The fresh reviewer reported no Minor findings.
