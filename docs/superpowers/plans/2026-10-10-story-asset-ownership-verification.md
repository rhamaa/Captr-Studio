# Story ownership implementation and verification

2026-10-10, Experiment, implementation baseline 0a439ce; Task 8 began at d951fb5. Version confirmed as 1.4.0-beta.1 in package.json, package-lock.json and root package-lock metadata. Spec and execution plan were approved. Tasks 1–7 passed independent reviews; Task 8 and separate whole-branch review are pending.

## Acceptance evidence

All ten specification items are mapped below. Existing meaningful integration cases already cover items 1–9; no duplicate assertion-only acceptance suite was added. Task 8 corrected two fixtures discovered by the full suite: compare the installed normalized sibling snapshot, and give a new finite inline Shape UI fixture real head/tail handles while retaining visible duration. Neither change relaxes production validation.

| Item | Actual test file and named case evidence | Status |
| --- | --- | --- |
| 1. Local Text/Shape, isolation/history | src/components/editor/StoryEditor.test.tsx — “creates inline Text/Shapes, applies independent templates, and publishes private media through root history”; src/core/timeline/textOverlay.test.ts — “splits inline text with independent content and restores IDs and edits through history”; shapeCommands.test.ts — “creates only an inline shape and five-second placement”, “changes only the selected placement style and can clear the override”. | Automated |
| 2. Templates/unused designs | designTemplateCommands.test.ts — “applies independent instances without registering Assets or modifying their template”; normalizeStoryOwnership.test.ts — “migrates placed designs inline in every canonical owner and preserves unused designs as Templates”. | Automated |
| 3. Shared video/Record, independent edits | repurposeCommands.test.ts — “new and duplicate Artboards snapshot private media, Record edits and transition references independently”; electron/ipc/register/project/v3LifecycleVerification.test.ts — “QA 2: Tempatkan Record dua kali, split/trim/rate/edit independen, import media, dan verifikasi reopen parity”. | Automated; native pending |
| 4. Private resolution/publication/history | storyOwnership.test.ts — “enumerates canonical owners and exposes only the selected private library”, “rejects sibling media and missing owners atomically”; storyMediaCommands.test.ts — “publishes metadata unchanged and unwinds sibling placement before publication”. | Automated |
| 5. Captured voiceover/cleanup/source retention | useAudioRecordingAssets.test.ts — “keeps a held take in its captured Story and preserves IDs across placement undo”, “retains a committed private source when placement fails and the take is discarded”, “cleans a rejected probe when its Story has been deleted”, “cleans a staged file when finalization completes after the project changes”, “reports bounded cleanup failure for a canceled take whose save completes late”. | Automated; mic/navigation native pending |
| 6. Canonical root/legacy/empty/standalone/latest projections | normalizeStoryOwnership.test.ts — “materializes inherited tracks once, preserving empty owners and independent Record/private identities”, “hydrates a standalone Story with its original identity and metadata”, “keeps canonical tracks and explicit empty metadata ahead of stale projections”; storyUtils.test.ts — “projects current canonical owners including empty Artboards”; timelineBundle.test.ts — “round trips every canonical media library, sidecars and current Story projections”. | Automated |
| 7. Legacy override/metadata/idempotence | normalizeStoryOwnership.test.ts — “migrates placed designs inline in every canonical owner and preserves unused designs as Templates” (input immutability and second-normalization equality), “preserves untrimmed legacy Shape transitions by adding finite static source handles”, “keeps sufficient legacy Shape source handles and non-default ranges and rates exact”; storyUtils.test.ts — “round-trips private media, explicit empty metadata, caption and canvas settings”. | Automated |
| 8. Real bundle/source/sidecar/atomicity | electron/ipc/project/timelineBundle.test.ts — “round trips every canonical media library, sidecars and current Story projections”, “stages private sidecars beside a relative source resolved inside the workspace”, “saves legacy Story IDs of 123 and 1024 ASCII characters with bounded projection paths”; projectFileService.test.ts — “Rename and Save As retain private media and reject missing sources atomically”; manager/mediaReferences/projectMediaValidation/prune tests protect complete library ingress and cleanup. | Automated real filesystem/bundles |
| 9. Shared renderer/clocks/0.5×/2× | projectFrameRenderer.test.ts — “preview draws match encoder export draws for inline transitions and private video at rate %s”, “renders mapped Record and cursor clocks before Story effects at rate %s”; visualAnimation.test.ts — “maps Record transition samples through the composition source clock”; clipTransitions.test.ts — “uses finite inline shape and text handles at rate %s”; projectAudioRenderer.test.ts — “mixes private audio through the existing decoder and stretch contract at rate %s”. | Automated sampled parity; native/export viewing pending |
| 10. Native regressions | Exact pending list below; lifecycle QA 1/2/3 and projectFileService tests exercise services only. | Pending native |

## Commands and baseline comparison

Commands used the repository default test configuration and parallelism; no serial full-suite override, omitted assertions, validator weakening, new dependencies, or version change.

| Check | Actual result |
| --- | --- |
| npm test, sandbox attempt | Exit 1; 216 failed files, no collected tests, Vitest cache rename EPERM. Infrastructure only; same command retried with approved local escalation. |
| npm test, initial unsandboxed | Exit 1; 208 passed / 8 failed files; 1488 passed / 12 failed tests, 1500 total; 142.61 seconds. Nine known baseline failures, two introduced fixtures, one transient Windows journal rename EPERM. |
| npx vitest run src/components/editor/StoryEditor.test.tsx src/components/editor/TimelineTransitionItem.test.tsx electron/ipc/project/projectRenameTransaction.test.ts | Exit 0; 3 files, 22 tests passed, 10.35 seconds after fixture corrections. Rename test passes without source changes. |
| npm test, final unsandboxed (fresh default parallel) | Exit 1; 211 passed / 5 failed files, 1491 passed / 9 failed tests, 1500 total; 113.38 seconds. All nine are exact original baseline cases; no introduced failures. |
| npx tsc --noEmit, final | Exit 0; empty diagnostics. |
| npx biome check --reporter=json over all 97 changed TS/TSX paths | Exit 1 for existing debt: 42 errors / 22 warnings. Same existing biome.json and baseline .gitignore, baseline 0a439ce over 83 existing paths: 106 errors / 22 warnings (exit 1). All 14 new files clean. Each surviving path/category/severity/description count is no greater than its baseline counterpart; no new diagnostic keys or counts. |
| npx biome check --write on nine affected test paths | Safe formatting/import fixes only; exit 0. Seven newly exposed diagnostics removed; TimelineTransitionItem/StoryEditor canonical fixtures also formatted. No production code changed in Task 8. |
| git diff --check | Exit 0; no whitespace errors. |
| graft grep 'assetId' | Exit 0; full 289-hit inventory saved and read, source-consumer rationale below. |
| graft build, after final code/test changes | Exit 0; 5188 nodes, 12978 edges, 735 cards; 2 files parsed, 741 cache-replayed, 743 total. Graph is repository-ignored. |
| recent-projects.json after all test writers completed | Already byte-identical to HEAD; verified using Buffer equality. Never staged. |

The original baseline's 26 failures included 14 late-loaded Task 1 RED assertions; those are not pre-existing failures. Compare exactly the original 12 cases, not 26. Three baseline failures (manager unused library and both V3 lifecycle cases) now pass. Nine remain in five files: legacy scene layer migration, audio container-call expectation, four canvas webcam mocks missing roundRect, two graphics webcam mocks missing roundRect, and the streaming decoder loopback port expectation. Initial Rename journal EPERM cleared in targeted and final parallel runs; it is an observed filesystem transient, not a concealed product assertion failure. The suite is not fully green.

| Original failure (exact baseline case) | Final result |
| --- | --- |
| electron/ipc/project/manager.test.ts > local media path policy > validates a V3 library before installing it and approves unused media | Pass / baseline resolved |
| src/components/video-editor/mediaLayerTiming.test.ts > multi-layer media contract > migrates legacy scene media layers into editable annotations | Unchanged failure |
| src/lib/exporter/audioEncoder.test.ts > AudioProcessor offline render preparation > keeps embedded source audio separate from external companion sidecars | Unchanged failure |
| src/lib/exporter/frameRenderer.test.ts > FrameRenderer webcam export path > uses the cached webcam frame when the live video is out of sync | Unchanged failure |
| src/lib/exporter/frameRenderer.test.ts > FrameRenderer webcam export path > keeps drawing the cached webcam frame when the live element temporarily has no current data | Unchanged failure |
| src/lib/exporter/frameRenderer.test.ts > FrameRenderer webcam export path > uses the live webcam frame and refreshes the cache when the video is synchronized | Unchanged failure |
| src/lib/exporter/frameRenderer.test.ts > FrameRenderer webcam export path > reuses the webcam bubble canvas across frames | Unchanged failure |
| src/lib/exporter/modernFrameRenderer.test.ts > ModernFrameRenderer webcam export fallback > keeps the webcam live when sync uses an offset timeline | Unchanged failure |
| src/lib/exporter/modernFrameRenderer.test.ts > ModernFrameRenderer webcam export fallback > keeps the webcam live when the media element time is current but lastSyncedWebcamTime is stale | Unchanged failure |
| src/lib/exporter/streamingDecoder.test.ts > StreamingVideoDecoder local media loading > loads loopback media-server URLs directly into WebDemuxer | Unchanged failure |
| electron/ipc/register/project/v3LifecycleVerification.test.ts > V3 Lifecycle & Regression Verification Suite > QA 2: Tempatkan Record dua kali, split/trim/rate/edit independen, import media, dan verifikasi reopen parity | Pass / baseline resolved |
| electron/ipc/register/project/v3LifecycleVerification.test.ts > V3 Lifecycle & Regression Verification Suite > persists clip transitions, component animation, and pathless shapes through save and reopen | Pass / baseline resolved |

Raw output is in the ignored workspace: task-8-full-test-initial.log, task-8-full-test.log, task-8-fixture-test.log, task-8-tsc.log, task-8-biome-current.json, task-8-biome-baseline.json, task-8-lint-comparison.json, task-8-assetId-audit.log and task-8-graft-build.log. Durable summaries, exact failures and decisions here survive workspace cleanup.

### Surviving diagnostic comparison

| Path | Category | Severity | Baseline → final count |
| --- | --- | --- | --- |
| src/components/editor/AIAssistantModal.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/CopilotSidebar.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectApplication.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectApplication.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectApplication.tsx | lint/correctness/useExhaustiveDependencies | warning | 2 → 2 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| src/components/editor/StoryEditor.tsx | lint/correctness/useExhaustiveDependencies | warning | 1 → 1 |
| electron/electron-env.d.ts | format | error | 1 → 1 |
| electron/ipc/agent/agentRunner.ts | lint/suspicious/noEmptyBlockStatements | error | 1 → 1 |
| electron/ipc/agent/mcpServer.ts | lint/suspicious/noExplicitAny | error | 5 → 5 |
| electron/ipc/agent/mcpServer.ts | lint/suspicious/noEmptyBlockStatements | error | 3 → 3 |
| electron/ipc/agent/mcpServer.ts | lint/correctness/noUnusedVariables | error | 2 → 2 |
| electron/ipc/project/manager.test.ts | format | error | 1 → 1 |
| electron/ipc/project/manager.ts | format | error | 1 → 1 |
| electron/ipc/project/projectBundle.test.ts | format | error | 1 → 1 |
| electron/ipc/project/projectFileService.ts | lint/correctness/noUnsafeFinally | error | 1 → 1 |
| electron/ipc/project/timelineBundle.test.ts | format | error | 1 → 1 |
| electron/ipc/register/project/save.ts | lint/correctness/noUnsafeFinally | error | 1 → 1 |
| electron/ipc/register/project/save.ts | format | error | 1 → 1 |
| electron/ipc/register/project/templateWallpaperSave.test.ts | format | error | 1 → 1 |
| electron/ipc/register/project/v3LifecycleVerification.test.ts | format | error | 1 → 1 |
| electron/preload.ts | format | error | 1 → 1 |
| src/components/editor/AIAssistantModal.tsx | lint/suspicious/noEmptyBlockStatements | error | 1 → 1 |
| src/components/editor/CopilotSidebar.tsx | lint/suspicious/noEmptyBlockStatements | error | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | lint/suspicious/noEmptyBlockStatements | error | 1 → 1 |
| src/components/editor/ProjectEditor.tsx | format | error | 1 → 1 |
| src/components/editor/ProjectInspector.tsx | assist/source/organizeImports | error | 1 → 1 |
| src/components/editor/ProjectInspector.tsx | format | error | 1 → 1 |
| src/components/editor/ProjectTimeline.tsx | assist/source/organizeImports | error | 1 → 1 |
| src/components/editor/ProjectTimeline.tsx | format | error | 1 → 1 |
| src/components/editor/SubtitleOverlay.tsx | lint/suspicious/noEmptyBlockStatements | error | 3 → 3 |
| src/components/editor/canvasGizmoMath.ts | format | error | 1 → 1 |
| src/core/story/storyTypes.ts | assist/source/organizeImports | error | 1 → 1 |
| src/core/timeline/agentTools.ts | lint/suspicious/noExplicitAny | error | 2 → 2 |
| src/core/timeline/clipTransitions.test.ts | format | error | 1 → 1 |
| src/core/timeline/clipTransitions.ts | format | error | 1 → 1 |
| src/core/timeline/visualAnimation.test.ts | format | error | 1 → 1 |
| src/lib/exporter/projectFrameRenderer.test.ts | format | error | 1 → 1 |
| src/lib/exporter/projectFrameRenderer.ts | format | error | 1 → 1 |

All 14 added modules/tests are clean under the existing configuration. Graft calls during Task 8 saved approximately 1,648,230 tokens (sum of reported estimates).

## Literal assetId audit

Ran graft map before source work, then exhaustive graft grep 'assetId', saved the full inventory and inspected all nonoverlapping output: 289 hits, 127 symbols, 90 files, 743 indexed files. This is an inventory, not a top-N answer. Source resolution uses resolveClipSource/resolveMediaAsset for media or inline descriptors. Scoped dispatch/normalization preserve canonical authority (storyOwnership.ts:119–199, normalizeStoryOwnership.ts:12–263); all truncated required source spans were opened.

Remaining IDs are intentional: registration/allocation and serialization/XOR types; source-reference deletion checks and snapshot remapping; transcript dictionaries/subtitle source indexing; drag/drop/UI preview identifiers; package inspector paths/transcription IPC; tests/fixtures. placeAssetIntoArtboard intentionally finds only global shared assets because the board's global-source drag operation is not a private-library lookup. Story private publication locates only the selected owner's localAssets. AI B-roll registration inspects its global registration list, not arbitrary sibling sources. Canvas bounds/TimelineClipItem may expose ephemeral inline descriptor IDs for display, without registering fake Assets. No source consumer found in this inventory requires a further ownership fix.

## Native QA and deferred work

Native computer APIs are disabled; shell Vitest and real bundle tests cannot exercise Recorder HUD, actual microphone capture, or desktop UI. Pending on this branch: repeated Record + Ctrl+S; video/image/audio imports; Assets-only save/reopen; two Record placements edited independently; voiceover Finish/Discard/Stay (Home/Open/New/window close); Rename/Save As/New identity; explicit V1/V2 Record conversion and native/browser/Windows capture finalization. Existing historical native checkboxes in ISSUE.md are not renewed branch evidence.

Deferred minors triaged without broad fixture architecture rewrites: Task 4 projectAudioRenderer scheduling mock does not assert connect/start scheduling; real decoder/stretch/WAV checks and renderer clock tests remain meaningful, but audible/scheduling QA is pending. Task 6 ProjectEditor.test.tsx uses UI-stack/eleventh-useState mocking and remains brittle; dedicated controller/async cases verify the ownership contract. Existing experimental localStorage warnings and expected missing-source stderr are recorded warnings, not failed ownership assertions. Task 6 ProjectEditor lint was compared against b8153d3 (2 errors/15 warnings unchanged there); final aggregate comparison below uses 0a439ce. Caption burn-in/final editing, real waveform/filmstrip, grouping, grading/masks, speed curves/tracking/proxies, new TTS, and authored trailing-blank duration control remain deferred.

## Per-task commits and independent review dispositions

| Task | Commits / disposition |
| --- | --- |
| 1 | c989fd8, c8dfebf, 050716d; 2 Important + 1 Minor addressed; re-review approved. |
| 2 | feadb81, 862a157, 16b5869, 0cb8a18; 3 Important addressed by recovery worker after quota interruption; re-review approved. |
| 3 | a88ef77, 0415d95; extent-preservation spec discrepancy addressed; re-review approved. |
| 4 | 15682ed; both review verdicts approved; scheduling-mock minor deferred below. |
| 5 | 4d2321a, b8153d3; terminal boundary and context-bound nullable plans fixed; re-review approved. |
| 6 | dc1e924; both verdicts approved; fixture/warning/lint minors deferred below. |
| 7 | 93d3a68, 05d133f, d951fb5; initial prefix/case collision and then hex basename overflow fixed; bounded ordinal manifest/staging re-review approved. |
| 8 | a1184db; both independent review verdicts approved; documentation precision minors remain for whole-branch triage. |
| Whole branch | Pending after approved Task 8 review, selected gpt-6.1-sol xhigh due Astra quota until October 14. No push/merge/release. |

## Chronological execution rulings

The following preserves every distinct chronological Ruling line from progress.md and rulings-collected.md, including reasons and the cost if wrong. Duplicate scratch copies were collapsed only when text matched exactly; the superseded hex filename rule remains for history.

Ruling: Work in the current non-main Experiment checkout, without creating or moving to another worktree — the user authorized implementation in this repository and the writable workspace is this checkout; avoid another approval gate or hidden checkout — if wrong, feature edits share the user's current branch, but remain reviewable commits and are not pushed/merged.

Ruling: Run the complete suite at baseline and final acceptance, with meaningful targeted tests per task — repeated whole-suite runs without new unresolved risk waste time; developer test instructions take precedence over the implementer template — if wrong, unrelated integration failures are found at final acceptance instead of at each task.

Ruling: Revise the temporary implicit legacy default approved during Task1; omitted options must validate canonical state, while still-legacy producer/ingress callers opt into legacy explicitly until migrated — independent review demonstrated omitted mode permits cross-Story duplicate placements/composition ownership — if wrong, staged compatibility callers require additional adaptations, but no weak default reaches the released state.

Ruling: Add minimal optional canonical Story identity metadata and Artboard canvas settings in Task2, preserving existing owner dimensions/ratio/framing and root canvas authority — legacy standalone Story IDs and canvas styling cannot survive conversion with current Artboard fields alone — if wrong, additive V3 metadata requires schema simplification, but avoids content loss and a second editable Story store.

Ruling: Story duration is recomputed from canonical clip clocks rather than preserving an independent stale serialized durationUs — current V3/export models derive duration from clips and Story files are projections; adding a separate export-length control is outside this foundation — if wrong, legacy standalone trailing blank length beyond all clips is not retained as authored output duration and would need a follow-up duration-control feature.

Ruling: Replace the failed Task2 fix implementer with a fresh standard-model worker, preserving its uncommitted fix work — the original worker stopped on an account usage-limit error and cannot complete the resumed round; the fix report and exact findings are the recovery context — if wrong, fresh context costs a verification pass, but no reviewed work is discarded.

Ruling: Permit minimal connected evaluation source-lookup adaptation during Task3 if needed to keep existing Text creator/render tests passing with canonical inline output — Task3 removes backing Assets before Task4 migrates the full pipeline, and retaining old producers or skipping meaningful tests would weaken the contract — if wrong, a small Task4-owned lookup moves earlier and is included in Task3 review; full clock/audio/export/transition work remains Task4.

Ruling: Normalize formerly valid legacy static Shape transitions by padding missing head source handles (equal in/out offset) and growing logical extent for required tail handles; retain source ranges when already sufficient — legacy Shape handles were infinite, while canonical inline handles are finite, so rejecting valid old transitions or changing visible timeline duration would break compatibility — if wrong, migrated legacy static-shape source coordinates change despite unchanged visible timing and may require a narrower compatibility model; Task4 checks local animation clocks and Task8 aligns spec wording.

Ruling: Add current revision to the transient StoryEditContext/proposal checks in Task5, alongside projectId/import generation/scope — graft shows useProjectController execute/undo/redo increments revision while generation stays unchanged during ordinary edits, so generation alone lets older full-project proposals overwrite newer edits — if wrong, older MCP context producers must resync/send the additional field, but serialized V3 projects are unchanged. Coordinator graft20621 (1 call).

Ruling: Implement Task7 private-media validation in existing mediaReferences.ts, rather than creating the nonexistent planned projectMediaValidation.ts — worker discovery and graft skeleton confirm findProjectMediaIssues/assertProjectMediaInsideBundle already own this functionality; projectMediaValidation.test.ts verifies it — if wrong, a separate validation-module boundary is deferred, but avoids duplicate validation authorities and unnecessary extraction. Coordinator graft1339 (1call). Task7 implementation93d3a68; 16suites186 green defaultparallel plus final3suites18 afteroldV3fixturechange; tsc0. Worker graft1679460. Eighteen-fileBiome baseline19errors4warnings/current10errors4warnings. Awaiting independent Task7 review.

Ruling: Use one collision-free portable Story projection filename mapping shared by staging and manifest, with a fixed prefix and lowercase hexadecimal encoding of validated ID bytes, preserving serialized Story IDs — prefix-stripping maps valid foo/story-foo to one path and raw case-only names collide on Windows; spec requires Story/*.json and exact manifest matching without mandating a basename — if wrong, internal projection filenames become less human-readable and older tooling depending on basename conventions needs to follow the manifest; V3 owner IDs/authoritative content remain unchanged.

Ruling: Supersede the hex-ID basename rule with bounded unique sequence filenames assigned by the current canonical Story manifest; staging consumes those exact entries rather than independently deriving a filename from ID — hex doubles a previously valid basename into an unsavable Windows component, while the spec makes ID/owner fields and manifest authoritative and does not mandate an ID-derived filename — if wrong, projection filenames may change when the canonical owner roster is reordered and external tooling must follow the manifest; serialized identities/content remain intact and no new shorter-ID limit rejects valid legacy projects.

Ruling: Use gpt-6.1-sol xhigh for the final whole-branch review as the most capable available model in this session — gpt-6-astra stopped on an account quota until October14 while today is October10, and standard-model task reviews have provided independent concrete findings — if wrong, frontier-model judgment is unavailable for this pass, mitigated by complete diff/spec review and actual automated evidence rather than skipping review.

Ruling: Preserve the exhaustive chronological ruling list with every stated cost in a durable linked verification document, and deliver a terse final report pointing to it — the user explicitly asks for caveman one-sentence reporting, overriding the skill default of printing the entire ruling list inline — if wrong, the user must open the linked notes to inspect the full decisions; none are deleted or hidden with scratch cleanup.
