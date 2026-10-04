# Project Home and file naming verification — 2026-10-04

Implementation range starts at `f3ad8b0`, on Experiment. Seven task implementation, no dependency installation, no merge/push.

## Evidence

- Naming/history: 23 tests; Rename/recovery/queue: 14 tests; file service/save/load/session/context: 24 tests.
- Controller/persistence/history: 10 tests. Navigation/lifecycle/recording: 14 tests plus shell SSR. Home/dialog/navigation/shell: 9 tests.
- Final focused selection: 101/101 passed, including Rename → two recording registrations → Assets-only Save → bundle inspection → two independent compositions → Save As preserves original bytes and media sidecars, plus all final review regression tests.
- TypeScript passed. Vite production renderer/Electron/preload build passed. i18n check reports 248 pre-existing diagnostics; no additional missing keys.
- Fresh final full suite: 1018 passed / 9 failed (1027 tests, 147 files: 142 passed / 5 failed). Existing failures: audioEncoder embedded/companion contract (1), frameRenderer roundRect webcam mocks (4), modernFrameRenderer webcam mocks (2), streamingDecoder loopback port (1), mediaLayerTiming legacy scene migration (1). No new failure in changed components/services. Overall suite remains red; this is not a claim of full regression clearance.

## Browser QA

Actual built Home, shell, editor and Radix name/dirty dialogs in headless Edge at 1440×1000 and 1280×800. Passed normal startup, external path search, card Open, stale-title filename normalization, Rename success, invalid reserved name, Escape/cancel, Save As cancellation/success, Home deactivation, New project, text-overlay dirty guard Cancel/Discard, first Save, collision error, long name draft, Tab focus containment. A delayed Open also verifies pointer and keyboard editing are frozen while awaiting the result and canceled Open restores the editor. No page errors or horizontal overflow.

All Electron calls were deterministic mocks: library/Open/activation/deactivation/activity/file-operation results, native menus/window controls/settings/shortcuts/font APIs. Recording media playback and recording sub-editor native entry were not exercised by this browser fixture. Bundle tests used actual temporary filesystem files and ZIP bundles independently of the browser fixture.

Screenshots: `project-home-evidence/home-1440.png`, `home-1280.png`, `name-dialog-1280.png`.

Full final RED/GREEN test outputs, full suite, build, browser QA, i18n and Graft refresh logs are preserved in `project-home-evidence/validation-logs.zip`.

## Native checks pending

Normal native launch and Explorer Open; Unicode/case-only rename on the actual Windows volume; occupied destination/file lock rejection; dirty Rename; native/browser repeated recording → Ctrl+S → reopen; native Save As dialog original protection; interrupted transaction relaunch; native recording sub-editor title and playback. No desktop fidelity claim.

## Final review and fixes

One fresh reviewer (`home_naming_final_review`) reviewed `f3ad8b0..ed829a4`. One Critical and six Important findings were retained after grading their user-visible effect. All entered one author fix pass; no second review was dispatched.

| Finding | Fix and RED → GREEN evidence |
| --- | --- |
| Critical: library recovery races with live Rename | Library listing/recovery shares file operation queue; gated production listing test waits behind Rename and preserves committed destination. |
| Unmatched bootstrap pending decrement | Only actual recording acceptance increments/decrements; hook test starts at zero, holds one during media probing, returns to zero. |
| Renderer finalization gap / stale completion resurrects owner | Main-process capture lease covers preparation and finalization; IPC tests reject departed owners and retain busy state through stop/repair. |
| Cleanup failure reports committed Rename as failure | Fingerprint-verified committed destination returns success with warning; persistent cleanup failure test retains recovery journal. |
| Awaited navigation permits edits | Controller navigation lock covers Open and deactivation; delayed controller tests and built-browser pointer/keyboard checks prevent mutation. |
| Missing active owner / capture while staging | Service requires exact active identity and rechecks after asynchronous staging; capture preparation/start gates consult file queue. |
| Save As drops pending imports | Controller pending work blocks Rename/Save As until media acceptance; import test preserves asset and subsequent Save As. |

Each regression test failed before its fix; final owning selection passed 101/101. One full-suite run initially caught a V3 fixture that called recording completion without activating its owner; the fixture now uses the real activation handler, and the final full run contains only the same nine baseline failures listed above.

Deferred minor: Home card omits `.captr` extension; editor topbar displays the complete filename. Reviewer declined native QA, translation completeness and unrelated exporter/legacy baseline failures; the ledger below records decisions and their costs.

Test-generated recent-project entries were restored only after verifying no non-test entry changed. Production recent-project state was not replaced. Branch remains Experiment without merge/push.

## Complete execution ledger
```text
# SDD ledger — plan: docs/superpowers/plans/2026-10-04-project-home-and-naming.md
Base: f3ad8b0
Pre-flight: T1->T2/T3/T4 shared names/types match; T2->T3 queue/recovery match; T3->T4 IPC matches; T4->T5 controller ownership matches; T5->T6 navigation matches; T1-T6->T7 acceptance matches.
Ruling: Keep native execution in the existing Experiment checkout, as approved in spec/plan; no dependency installation — changing checkout would hide the user-visible implementation.
Ruling: Preserve legacy save callback compatibility while introducing the verified file-operation port; existing regression fixtures must remain runnable during staged migration.
Task 1: in progress
Task 1: complete (f3ad8b0..HEAD; RED missing projectNames module; GREEN naming/history 23 tests; TypeScript passed).
Ruling: Skill Bash helpers cannot find dirname in this restricted Windows shell; use equivalent PowerShell task briefs and recorded test results in the same plan workspace.
Task 2: complete (17f4c29..HEAD; RED missing transaction/queue modules; GREEN 14 real-file recovery/queue tests; TypeScript passed).
Ruling: Recovery journal directory is configurable for actual temporary-file tests and uses app userData in production; recovery preserves ambiguous foreign bytes rather than deleting them.
Task 3: in progress
Task 3: complete (e67c0f8..HEAD; service/session/save/load/context 24 tests passed; TypeScript passed).
Ruling: Legacy save remains a queued compatibility endpoint; new UI uses verified service. Unsaved-close flag cleared by shell after successful deactivation. Cost if wrong: old external consumers retain old naming semantics.
Task 4: complete (be92246..HEAD; RED 4 failing tests, GREEN 10 controller/persistence/history tests).
Ruling: Verified persistence uses an explicit {persist} constructor option to disambiguate existing one-argument legacy callbacks; compatibility return type remains broad. Cost if wrong: callers must use factory instead of passing an unmarked port.
Task 5: complete (6c05481..HEAD; navigation/lifecycle/recording 14 tests and shell SSR test passed; TypeScript passed).
Ruling: Shell owns OS Open, Home, New, legacy conversion, and controller lifetime; editor retains Save and recording listeners. Additional callbacks route editor shortcuts to shell. Cost if wrong: consumers must supply navigation callbacks.
Task 6: complete (ba25f0d..HEAD; RED Home/dialog modules and old Home assertion, GREEN 9 interaction/navigation/shell tests; TypeScript passed; i18n 248 known diagnostics).
Ruling: Reworked existing WelcomeScreen and ProjectCard as full main-window Home while retaining reusable brand, media, settings and window controls. New locale keys currently use English fallback text across locales. Cost if wrong: translated copy requires follow-up localization.
Task 7: implementation verification complete (integration 38 passed; full 1007 passed/9 known failures; TS/build passed; browser QA passed; i18n 248 baseline; native QA pending; final review next).
Final review: fresh reviewer home_naming_final_review reviewed f3ad8b0..ed829a4. Re-graded one Critical and six Important by user-visible effect; all seven retained for one author fix pass. No second reviewer/pass.
Final: fixed Critical live Rename/library recovery race — library waits behind live rename before recovering journal, projectFileConcurrency test RED->GREEN; focused suite 101/101; full suite 1018 passed/9 known baseline failures.
Final: fixed unmatched recording bootstrap pending decrement — actual hook deferred completedRecordingFromSession test RED->GREEN; focused suite 101/101; full suite 1018 passed/9 known baseline failures.
Final: fixed browser/native finalization activity gap and stale completion resurrection — lease spans capture preparation and finalization; session stale-owner and finalization gap tests RED->GREEN; focused suite 101/101; full suite 1018 passed/9 known baseline failures.
Final: fixed committed Rename cleanup reported as failure — persistent candidate cleanup failure test RED->GREEN; destination success plus warning and recoverable journal; focused suite 101/101; full suite 1018 passed/9 known baseline failures.
Final: fixed navigation edit race across awaited Open/deactivation — controller lock and delayed deactivation tests RED->GREEN; real built browser slow Open freezes pointer/keyboard edits, cancellation restores editor; focused suite 101/101; full suite 1018 passed/9 known baseline failures.
Final: fixed absent active owner and capture start during file staging — service departed owner/asynchronous staging and capture preparation queue gate tests RED->GREEN; focused suite 101/101; full suite 1018 passed/9 known baseline failures.
Final: fixed pending import lost across Save As — pending-work Save As regression test RED->GREEN; asset accepted before next Save As; focused suite 101/101; full suite 1018 passed/9 known baseline failures.
Final: Ruling: Block Rename/Save As while import or recording probe is pending instead of postponing/rebinding the import — existing owner and async work remain intact; cost if wrong: user waits for media processing before changing filename/identity.
Final: Ruling: Native QA declined by reviewer remains explicitly unverified because this environment cannot operate native desktop capture/filesystem dialogs — no desktop fidelity claim; cost if wrong: real Windows rename/file-lock/capture/dialog/relaunch bugs may remain.
Final: Ruling: Reviewer set aside English locale fallback; retain Task 6 ruling and record 248 existing i18n diagnostics — new controls have keys and readable fallback; cost if wrong: localization requires follow-up translations.
Final: Ruling: Reviewer set aside nine existing exporter/legacy timing failures; fresh full run reproduces the same nine and no new failures — leave outside Home/naming scope and preserve Experiment without merge/push; cost if wrong: overall suite remains red and affected export paths remain uncertain.
Final: minor (deferred): Home project card displays basename without .captr extension; editor topbar displays full filename as requested.
Ruling clarification: Native Experiment/no installation retains approved visible checkout — cost if wrong: less isolation from existing working tree.
Ruling clarification: Legacy callback compatibility preserves existing regression callers — cost if wrong: compatibility consumers retain old save semantics.
Ruling clarification: PowerShell task bookkeeping replaces unavailable Bash dirname helpers — cost if wrong: manual audit has greater bookkeeping risk.
Ruling clarification: Configurable recovery directory and preservation of ambiguous foreign files avoid destructive guesses — cost if wrong: ambiguous recovery may require manual intervention.
Task 7: complete implementation and final fix pass (fresh focused 101/101; full 1018/1027 with nine known failures; TypeScript and Vite renderer/Electron/preload passed; browser 1440x1000 and 1280x800 passed including slow Open; i18n 248 baseline; diff check and graft build passed). Native Windows QA explicitly pending. Branch retained, no merge/push.

```
