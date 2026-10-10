# Task 2 report — canonical Story authority and snapshots

Completed implementation in `D:/Projects/Captr Studio`, branch `Experiment`, based on `feadb81`.

Implementation commit: `862a157 feat: isolate canonical Stories and Artboard snapshots`.

## Result

- Root tracks and explicit Artboard tracks now generate current Story/manifest projections, including empty owners. Stale `project.stories` tracks and durations cannot replace canonical edits.
- `normalizeStoryOwnership` clones input, resolves explicit/prefix associations, rejects ambiguous mappings, hydrates standalone Stories without changing their Story IDs, and materializes omitted Artboard tracks once. Explicit empty tracks stay empty.
- Snapshots remap track, clip, transition, private-media and Record-composition identities, rewriting references. Global media/package/template identity stays shared; immutable source paths can be shared by independently owned private entries. Duplicate IDs inside a source sequence reject before remapping.
- Historical explicit snapshots sharing placement/composition IDs across owners are remapped deterministically. Repeated normalization is equal and does not alter the input.
- New Artboards snapshot root tracks immediately. Duplicates clone the selected owner. Strict view/update/place entry points reject absent or unmaterialized owners. The default board creates no Artboards, so there is no additional implicit creation path.
- Scoped commands receive an isolated view with only the owner's Record compositions; they merge owner metadata and intentional global imports back into the parent, retain sibling/root private state, and refresh projections before canonical validation. Record delete/split and owner deletion no longer encounter stale projection references.
- Story conversion preserves private libraries, subtitles, framing, complete canvas settings, stable association, timestamps, and current evaluated duration. Per parent ruling, stale scalar `Story.durationUs` is recomputed; legacy trailing blank length is not introduced as an export-length feature.
- Root project title and project identity remain canonical and are not replaced by Story metadata.

## Exported APIs and fields

`storyOwnership.ts` retains:

```ts
listStoryScopes(project: TimelineProject): StoryScope[];
getStoryProject(project: TimelineProject, scope: StoryScope): TimelineProject;
```

It now additionally exports:

```ts
applyStoryCommand(project: TimelineProject, scope: StoryScope,
  command: ProjectCommand): TimelineProject;
refreshStoryProjections(project: TimelineProject): TimelineProject;
createStorySnapshot(project: TimelineProject,
  source: Pick<TimelineProject, "tracks" | "clipTransitions" | "localAssets" | "subtitles">,
  newId?: (kind: string, oldId: string) => string): {
    tracks: TimelineTrack[];
    clipTransitions: ClipTransition[] | undefined;
    localAssets: PrivateMediaAsset[] | undefined;
    subtitles: StorySubtitleSettings | undefined;
    compositions: RecordComposition[];
  };
```

`normalizeStoryOwnership.ts` exports `normalizeStoryOwnership(input: TimelineProject): TimelineProject`.

`validation.ts` additionally exports `validateStoryPresentation(owner: { canvas?: unknown; storyMetadata?: unknown; subtitles?: unknown }): void`, shared with normalization to reject malformed optional metadata before applying fallbacks.

`types.ts` additionally exports:

```ts
type StoryOwnerMetadata = Partial<Pick<StoryComposition,
  "id" | "name" | "aspectRatio" | "framing" | "createdAt" | "updatedAt">>;
```

`TimelineProject.storyMetadata?: StoryOwnerMetadata` and `RepurposeArtboard.storyMetadata?: StoryOwnerMetadata` are optional. `TimelineProject.canvas` now uses existing `StoryCanvasSettings` (adds optional background); `RepurposeArtboard.canvas?: StoryCanvasSettings` preserves complete Artboard canvas settings. Existing Artboard width/height/name/aspectRatio/framing are authoritative over projection metadata. No duplicate editable canvas is stored in `storyMetadata`.

Existing Story utility and Artboard command names/signatures are retained.

## TDD and verification

- Read Task2 brief, shared interfaces, approved design and Superpowers TDD/writing-good-tests instructions. Used graft map/ask/callers before edits; no child agents/reviewers spawned.
- Initial sandbox Vitest attempt ran no tests because Vite temporary-file rename returned EPERM. Escalated focused executions succeeded; there was no auto-review rejection.
- Initial RED: stale root projection and metadata roundtrip assertions failed, scoped command API was missing, and normalizer module did not yet exist. Snapshot RED observed missing tracks on a newly created Artboard.
- Subsequent focused RED/GREEN covered metadata validation, isolated Record composition access, obsolete owner projections, strict placement scopes, current Record projection placement, duplicate source IDs, and inherited canvas independence. The transition fixture was corrected to the actual `{ kind: "cross-dissolve" }` contract; the duplicate-ID fixture was made non-overlapping to isolate the intended behavior.
- Final command:

```text
npx vitest run src/core/timeline/storyOwnership.test.ts src/core/timeline/normalizeStoryOwnership.test.ts src/core/timeline/repurposeCommands.test.ts src/core/story/storyUtils.test.ts src/core/timeline/validation.test.ts

Test Files  5 passed (5)
Tests       83 passed (83)
```

Counts: Story ownership 10, normalization 10, Artboard commands 14, Story utilities 7, validation 42.

- `npx tsc --noEmit --pretty false`: reports the previously identified Task1 XOR-consumer handoffs only: `SubtitleOverlay.tsx:67` TS2538, `TimelineClipItem.tsx:137` TS2345, `agentTools.ts:205` TS2322. No Task2 source/type errors were reported. Those consumers are outside Task2 ownership.
- Scoped Biome formatting completed. `git diff --check` passed.
- `graft build` refreshed 736 files / 5,141 nodes / 12,562 edges. Cache is ignored. Recorded visible graft savings total at least approximately 1,715,317 tokens; some long tool responses truncated additional per-call estimates.
- No baseline/full-suite repeat, per parent ruling. Native QA not performed or claimed.

## Changed files

- `src/core/timeline/storyOwnership.ts` and `.test.ts`
- `src/core/timeline/normalizeStoryOwnership.ts` and `.test.ts`
- `src/core/timeline/repurposeCommands.ts` and `.test.ts`
- `src/core/story/storyUtils.ts` and `.test.ts`
- `src/core/timeline/types.ts`
- `src/core/timeline/repurposeTypes.ts`
- `src/core/timeline/validation.ts`

## Handoffs

- Task3 must extend the normalizer with legacy Text/Shape migration. At this Task2 stage, the final validation call explicitly selects legacy mode only while historical design Assets remain; projects without them use canonical validation. Move the canonical gate after design migration when integrating Task3.
- Task7 must normalize all installation/load ingress before strict views are requested. `extractStoriesFromProject` now rejects unmaterialized owners; it intentionally does not install or hydrate legacy ownership during read-only projection.
- Later command/UI/AI tasks should use `applyStoryCommand` with captured scope. The Artboard placement helper now delegates to the existing `placeAsset`; private-media placement support remains with the command migration task.
- An inherited owner's pre-existing private library is retained alongside independent copies of root-private snapshot sources, so copied placements always resolve without sharing physical Asset IDs. Explicit `tracks: []` never copies the root sequence/library.
- Persistence/media traversal, UI, capture and native save paths are unchanged. No release/native-QA claim is made for intermediate Task2 state.
