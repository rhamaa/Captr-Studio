# Task 1 report — Story sources, scope views, and validation

Status: DONE_WITH_CONCERNS. Task scope implemented; integration migration and final whole-suite/native gates remain with later tasks.

## Requirements and skills

Read task-1-brief.md, interfaces-and-constraints.md, the approved specification, and AGENTS graft guidance. Used Superpowers executing-plans and test-driven-development, including writing-good-tests.md. No subagents spawned. Parent owns ledger/planning/spec documents; none included in this task commit.

## Changed files

- src/core/timeline/types.ts — StoryScope, StoryClipContent, StoryDesignTemplate, PrivateMediaAsset, TimelineClip XOR source union; optional project private library/templates/subtitles.
- src/core/timeline/repurposeTypes.ts — Artboard private library/subtitles.
- src/core/story/storyTypes.ts — Story private library/Artboard association.
- src/core/timeline/clipSource.ts — strict global-plus-current-private resolution, inline name/dimensions/source extent; no Asset registration or state mutation.
- src/core/timeline/storyOwnership.ts — enumerate root/Artboard scopes; strict scoped views; missing/unmaterialized Artboards reject; private libraries never merged into assets.
- src/core/timeline/validation.ts — source XOR, inline content/extent, templates, every canonical owner, global physical media uniqueness, scoped private references, track/clock/transform/keyframe/animation/transition checks, independent Record composition ownership, deep projection reference checks, serialization validation.
- src/core/timeline/storyOwnership.fixtures.ts — deterministic root/A/B, shared media, A-private audio, inline designs, independent Record compositions.
- src/core/timeline/clipSource.test.ts, storyOwnership.test.ts, validation.test.ts — contract cases.
- docs/superpowers/plans/2026-10-10-story-asset-ownership-baseline.md — baseline command results and exact 12 pre-existing failure names.

## Exact public compatibility contract

`validateTimelineProject(value: unknown, options: TimelineValidationOptions = { mode: "legacy" }): TimelineProject`

`TimelineValidationOptions = { mode: "legacy" | "canonical" }`.

Parent-approved bounded legacy default keeps genuine old global Text/Shape Assets and clip.text valid before normalization and preserves old command callers until migrated. Legacy mode still rejects contradictory inline/media sources, invalid content, and missing/cross-scope private references. Legacy Artboard snapshot IDs/composition references are validated per sequence, allowing normalization to remap shared old identities. Canonical mode rejects global Text/Shape Assets and legacy clip.text, requires explicit Artboard tracks, and shares placement/track/transition IDs and Record composition ownership across root plus explicit Artboards. Task 7 must wire raw legacy validation -> normalization -> canonical validation at installation/load boundaries; later command tasks should use canonical output.

Projection IDs are not registered twice. Projection tracks are deeply checked with their owner's private library. Canonical missing owners and forged private mirrors reject. Private metadata equivalence ignores serialized object property order. Valid but stale projection tracks need not exactly equal canonical tracks: canonical owners remain authoritative and Task 2 must regenerate projections. This avoids stale projections overriding newer canonical edits. Legacy standalone Story validation is deep before hydration.

`getStoryProject` returns a non-mutating view, not a deep-cloned editable store. Root view is the original project; Artboard views have global assets plus only localAssets for that owner and clear nested repurposeBoard/stories. The scoped command wrapper in Task 2 must clone/write back through the root transaction. No applyStoryCommand implemented here (Task 2 ownership).

## TDD and checks

All commands run from D:/Projects/Captr Studio. Vitest commands used approved unsandboxed execution after baseline sandbox EPERM.

1. Baseline `npm test`: sandbox exit 1, 208 failed files/no tests due temporary-cache rename EPERM. Unsandboxed baseline exit 1: 8 failed/200 passed files; 26 failed/1322 passed tests. Delayed module loading picked up 14 newly appended validation RED tests even though launch preceded edits; baseline explicitly separates those from the 12 pre-existing failures across 7 files. No production source changed during baseline. Original pre-edit `npx tsc --noEmit`: exit 0, empty output. Raw logs: task-1-baseline-tests.log, task-1-baseline-tests-unsandboxed.log, task-1-baseline-tsc.log, task-1-baseline-tsc-unsandboxed.log. recent-projects.json test side effect restored byte-for-byte from HEAD.
2. RED `npx vitest run src/core/timeline/clipSource.test.ts src/core/timeline/storyOwnership.test.ts src/core/timeline/validation.test.ts`: exit 1, 3 files failed; 14 failed/16 passed validation cases plus missing resolver/view modules. Assertions included missing deep per-owner/XOR/template/handle validation. Log task-1-red.log.
3. Initial GREEN same command: exit 0, 3 files/34 tests passed. Log task-1-green.log.
4. Projection RED `npx vitest run src/core/timeline/validation.test.ts`: exit 1, 2 failed/31 passed (forged sibling-private projection, dangling legacy standalone Story). Log task-1-projection-red.log. Implemented deep projection scoped checks; GREEN included below.
5. Compatibility `npx vitest run src/core/timeline/clipSource.test.ts src/core/timeline/storyOwnership.test.ts src/core/timeline/validation.test.ts src/core/timeline/commands.test.ts src/core/timeline/repurposeCommands.test.ts src/core/timeline/textOverlay.test.ts src/core/timeline/shapeCommands.test.ts src/core/timeline/clipTransitions.test.ts`: initial 1 failed/84 passed due existing /asset/i error-message contract. Restored descriptive media asset wording; GREEN 8 files/85 tests. Logs task-1-compatibility.log and task-1-compatibility-green.log.
6. Mirror property-order RED `npx vitest run src/core/timeline/validation.test.ts`: exit 1, 1 failed/33 passed. Replaced order-sensitive JSON string comparison with semantic metadata comparison. Log task-1-mirror-order-red.log.
7. Final focused + compatibility command (same eight paths as step 5): exit 0, 8 files/86 tests passed. Log task-1-final-green.log. No full-suite repeat after baseline; final whole-suite comparison is Task 8 per parent ruling.
8. `node_modules/.bin/tsc.cmd --noEmit`: exit 1; exactly three downstream consumer diagnostics (below), none in owned implementation. Logs task-1-tsc-after.log and task-1-final-tsc.log.
9. Named files formatted with existing Biome. `git diff --check` clean. `graft build` successful after substantial changes (734 files indexed); log task-1-graft-build.log.

## Integration concerns and follow-up

- Optional assetId produces expected compile errors in SubtitleOverlay.tsx:67 (undefined index; Task 4), TimelineClipItem.tsx:137 (string argument; Task 4), agentTools.ts:205 (context schema demands assetId; Task 5). No unrelated UI/type assertions added to conceal these sites. Full diagnostics preserved in task-1-final-tsc.log.
- Existing old command/default callers intentionally use bounded legacy validation until subsequent task migration. Do not release this intermediate commit before all gates.
- Normalize inherited/duplicated sequences and independent Record composition IDs before canonical validation. getStoryProject deliberately throws for missing tracks, including legacy Artboards that need materialization.
- Source resolution returns media source extent; Record composition duration remains a placement concern, used by validation's existing composition clock checks.
- Existing baseline failures are listed by exact name in the committed baseline report. Native QA is pending; no capture/save/bundle implementation changed in Task 1.

## Graft inventory and connected consumers

Before source edits: graft map; ask TimelineClip/TimelineProject/validation/StoryComposition/RepurposeArtboard; graft grep "assetId" (250 hits in 117 symbols across 83 files, 729 indexed files); callers validateTimelineProject (32), callers getArtboardProjectView; skeleton types.ts/validation.ts/validation.test.ts; recording types and Story conversion queries. Typo getArtboardProject returned no symbol, corrected immediately to getArtboardProjectView. Full exhaustive inventory: task-1-assetId-inventory.txt; caller inventory: task-1-callers.txt (both in this SDD directory).

Connected sources include commands/shape commands/Artboard placement; evaluation/visualAnimation/audioPlan/clipTransitions; canvasGizmoMath/TimelineClipItem/ProjectInspector/ProjectTimeline/ProjectPreview/StoryEditor/SubtitleOverlay; agentPayload/agentTools/broll/voiceover; useRecordingAssets/useAudioRecordingAssets/controller/history; electron MCP/transcription; timelineBundle/mediaReferences/manager/projectFileService/register-project-save/projectBundle and preload. The 32 validator callers include both main-process raw bundle ingress and renderer/editor command/history/export consumers; later tasks must deliberately choose legacy ingress versus canonical output at each boundary, not globally flip default prematurely.

Graft estimated savings total: 1,657,929 tokens (sum of reported map/ask/grep/skeleton/callers estimates; graph rebuild has no savings line). Graph rebuilt after changes. Source spans inspected from graph; truncated needed validation ranges were opened exactly before edits.

## Final handoff coverage supplement

Parent completeness check identified explicit assertions worth adding for existing Task 1 checks: template default duration may equal or be shorter than its source extent but cannot exceed it; sibling-private physical IDs cannot duplicate; ambiguous legacy Story aliases reject instead of selecting an arbitrary owner. No production behavior changed. Focused three-file gate: 41/41 passed (validation 37, resolver 2, views 2), task-1-handoff-focused.log. Main implementation commit: c989fd8.
