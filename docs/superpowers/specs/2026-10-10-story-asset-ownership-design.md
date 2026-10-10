# Story Editor Asset Ownership Design

Date: 2026-10-10 (Asia/Jakarta)

Status: Written specification approved by the user on 2026-10-10 with “ok bro, eksekusi spec nya”. Product intent and ownership categories are recorded in [issue #12](../../../ISSUE.md#12-pemisahan-assets-global-elemen-story-dan-komposisi-record-10-oktober-2026). Execution plan approved on 2026-10-10 with “ok implementasikan rencana”. Tasks 1–8 and the separate whole-branch review are approved after the focused migration fixes. Native QA remains pending; see [durable verification](../plans/2026-10-10-story-asset-ownership-verification.md).

## Purpose and scope

Record Editor prepares a recording composition. Story Editor assembles the final video for its owning Artboard, combining recording placements, imported media, text, shapes, music, and captions. The parent `.captr` project supplies reusable source media.

Implement issue #12 as the ownership foundation: inline Story design elements, Story-private media, scoped editing, legacy V3 normalization, and preservation through preview/export and save/reopen. CapCut Desktop is a workflow reference. The implementation follows Captr's existing non-destructive model.

Success: adding Text/Shape creates only a local timeline element; reusing global media shares the source while keeping edits independent; private voiceovers remain with their originating Story; all content survives one `.captr` save/reopen without leaking into another Artboard.

Subtitle burn-in, real waveform peaks, filmstrip thumbnails, new grouping tools, grading, masks, speed curves, tracking, and proxy generation are later roadmap work. This foundation must preserve existing caption metadata and APIs, but does not claim to implement those finishing features. Do not introduce a new TTS engine; any future Story-generated audio uses the private-media API defined here.

## Pre-implementation code and observed risks

- `src/core/timeline/commands.ts:154-200`: `addTextOverlay` creates a global `MediaAsset` and a placement.
- `src/core/timeline/shapeCommands.ts:14-43`: shape creation uses `registerMedia` and `placeAsset`.
- `src/core/timeline/repurposeCommands.ts:418-483`: Artboard views have local tracks but share root assets; update copies view assets/packages/compositions to the root.
- `src/core/story/storyUtils.ts:65-127`: Story/Artboard conversions omit local media and caption metadata; `extractStoriesFromProject` returns existing `project.stories` before examining current root/Artboard tracks.
- `electron/ipc/project/timelineBundle.ts:16-132`: staging serializes shared assets, Record compositions, Story JSON projections, and authoritative `project.json`. Media traversal currently precedes Story projection generation.
- `src/core/timeline/validation.ts:248-653`: clips require global asset lookup. Artboard and Story tracks receive only shallow structural checks compared with root tracks.
- `src/components/editor/useAudioRecordingAssets.ts:116-175`: voiceover registration and placement use the root controller. A Story scope must travel with the asynchronous take, not be recovered from whichever Artboard is selected at completion.

The implementation must address these consumers together. Merely hiding Text/Shape cards would leave ownership and persistence incorrect.

## Approaches considered

1. **Inline design content and scoped file media — selected.** Text/Shape data belongs directly to each clip. Private file media belongs to its Story. Global media remains in `project.assets`. This makes ownership explicit and avoids backing Assets for source-free design elements.
2. **Keep all items in root Assets with owner/filter flags.** Smaller initial UI change, but root Assets still mixes reusable sources and local composition data. Every lookup/filter would have to remember scope. Rejected for the agreed ownership model.
3. **Separate full project/bundle per Story.** Strong isolation but duplicates media and complicates recording packages, save identity, and capture lifecycle. Rejected: one `.captr` remains the project boundary.

## Canonical data model

### Clip content

Keep existing clip ID, track placement, source clock fields, rate, transform, gain, enabled state, keyframes, component animations, and shape style overrides. Add an inline `content` union:

```ts
type StoryClipContent =
  | { kind: "text"; text: TextOverlay; durationUs: number }
  | { kind: "shape"; shapeDefinition: ShapeDefinition; durationUs: number };
```

A canonical clip has exactly one of `assetId` or `content`. `assetId` refers to file media or a global Recording Asset. `content` supplies a source-free local element. Inline `durationUs` defines its logical source extent, preserving current sourceIn/sourceOut/rate and transition-handle calculations. New elements start with the current 5,000,000 microsecond extent; extending the element grows that extent through an undoable command, while trim preserves the existing extent.

Text content lives only at `clip.content.text` after normalization. Legacy `clip.text` is an input compatibility field, not a second editable value. Shape definitions live at `clip.content.shapeDefinition`; existing `shapeStyleOverride` retains its per-placement precedence and validation.

Adding/duplicating/splitting an inline element deep-copies content and assigns the appropriate new clip IDs. No root Asset, media file, or `asset.json` is created for that element. Design elements cannot be placed on audio tracks or have Record composition references.

### Global and private media

- `project.assets`: reusable video/image/audio sources and Recording Assets only in canonical state.
- `project.localAssets?`: media private to the existing root/default Story. This does not make Home an active project or create a hidden target.
- `RepurposeArtboard.localAssets?`: file media private to that Artboard's Story.
- `StoryComposition.localAssets?`: serialized projection of the same Story-private library, not a second editable owner.
- Private libraries accept file-based video/image/audio media with the existing source metadata. Screen Recording Assets/packages stay global.
- All physical media Asset IDs are unique across the parent project and private libraries. Paths remain immutable source references until staging remaps them into the bundle. Private sources may be unplaced and must still be saved.

Use an explicit runtime scope: root/default Story or a specific Artboard ID. A scoped view keeps `assets` global and exposes only that Story's `localAssets`; it must not merge private media into `assets`. Lookup resolves global media plus the active private library and rejects sibling-private references. Root file traversal and validation enumerate every canonical scope.

Provide one clip-resolution API used by commands, validation, evaluation, bounds/hit-testing, timeline, inspector, audio, transition handles, and AI/MCP. It returns either referenced media or inline content with the dimensions/name/extent needed by the consumer. Any derived display descriptor is ephemeral and never registered as an Asset.

### Templates

Add a separate optional project design-template collection for text/shape presets, containing ID, name, kind, content, dimensions, and default duration. It contains no source media. Applying a template deep-copies its content into a new local element; subsequent edits do not change the template or other instances.

This initial collection also preserves legacy Text/Shape entries that have no placement. Migrated templates retain the old ID/name and validated content, dimensions, and duration. This avoids dropping old unused content or adding unwanted timeline clips. Full animation preset libraries remain later work.

## Story/Artboard authority and isolation

Root tracks are authoritative for the default Story; an Artboard's explicit tracks and local metadata are authoritative for its own Story. Legacy Artboards with absent tracks are materialized once from the root sequence during normalization, with independent placement/Record composition/private-media identities. An explicit empty array remains empty. Newly created Artboards take an independent snapshot of the current root sequence, preserving the existing initial-content behavior without a continuing live link. Subsequent root or sibling edits cannot alter that snapshot.

`project.stories`, `storyManifest`, and `Story/*.json` are projections generated from the current canonical owners. They must not override newer root/Artboard edits on save. Both conversion directions preserve local media, caption settings, canvas settings, transitions, framing, and stable Story–Artboard association. Story duration is regenerated from canonical clip clocks, not an independent serialized trailing-blank duration. A separate authored trailing-blank/export-length control is deferred. Add an explicit optional Artboard association to Story metadata so new files do not depend only on the `story-` prefix convention.

On loading older files, hydrate explicit standalone Stories with no canonical owner into an Artboard, or into the existing default root Story when their identity denotes that root. Keep the original Story identity. Resolve old prefix mappings only when unambiguous; conflicting mappings reject load before active project state changes. For a matching canonical owner, its tracks win over the previously generated Story projection; metadata that the old conversion omitted is carried forward when the canonical field is absent. Explicit values, including empty collections, win over fallback metadata.

Materializing a legacy inherited Artboard or duplicating a Story remaps placement/track/transition IDs and private media IDs, then updates references. Its Record placements get independent Record composition IDs/settings. Global source Asset/package IDs remain shared. Root-private sources copied into a materialized Story receive new media IDs and private ownership; the immutable source file can be shared until staging creates each Asset's bundle path. Normalize before installing the editable state so a read-only view never mutates ownership implicitly.

Physical Record compositions can remain in the parent composition table. Their owner is the placement, including its Story scope. Editing one placement must not affect another. Validation evaluates ownership across canonical root and explicit Artboard sequences, not duplicate serialized projections.

## Commands and editor UI

All commands operate on a captured Story scope and root project transaction. An Artboard update writes only its tracks/local media/canvas/caption metadata; an intentional global media import may also update `project.assets`. Private local media must never be copied to the root global library.

UI sections use the agreed labels:

- **Assets**: reusable global sources.
- **Story Media**: private media of the active Story; show an empty state with no fabricated items.
- **Text / Shapes**: create local elements directly at the playhead using existing compatible-track placement rules.
- **Templates**: apply reusable design presets as independent local elements.

Keep existing editor styling and controls. A private media card offers **Publish to Assets**. Publishing transfers the media entry from the private library into global Assets, retaining its unique Asset ID and source/sidecars; placement references remain valid. The command is undoable through the existing project-wide history. Later placements in other Stories are undone before undoing publication, so restoration to private ownership leaves no dangling sibling references. Do not perform file deletion during publication or undo.

Deleting a clip removes only that placement. Removing source media is a separate explicit action with reference checks across all canonical Story scopes. Private source media stays in its library even when unplaced. Deleting a Story removes its owner metadata through normal undoable project editing; actual orphan-file cleanup must not run during the editing command or erase media needed by undo.

Transient StoryEditContext requires scope, projectId, import generation, and current revision. All MCP edit tools require captured context; stored/broadcast plans carry that context, are nullable, and invalidate when stale. Terminal configuration is project-level. AI/MCP context identifies global sources, active Story-private sources, and local design clips separately. Structured text/shape tools produce inline elements. Cross-Story private lookup and stale scoped edit proposals reject atomically instead of falling back to root tracks.

## Voiceover lifecycle

Existing Story voiceover recording defaults to its originating private library. Capture a project import token, Story scope, playhead anchor, and intended placement IDs when the take begins. Preserve current Finish/Discard/Stay navigation behavior and native capture leases.

After saving/probing audio, finalize only if the token/project and Story owner still match the capture context. Story switching cannot redirect a take to another scope; block switching while the take is active using the existing navigation guards. A deleted owner, abandoned project, or canceled token causes rejection/cleanup through the existing bounded temporary-file IPC.

Ordinary Story edits do not invalidate the immutable originating take context. Registration commits separately before placement; a placement failure retains the private source. Registration of a kept take and its subsequent placement preserve current undo semantics: undoing placement retains the private source, and redo restores the same clip ID. A private source is bundled even with no placement. Imported audio remains global by default; existing global voiceovers are not silently moved into a Story. Screen Record completion stays global Assets-only.

## Rendering and clocks

Evaluation resolves inline designs and scoped media through the shared API. Inline elements use their current clip clock and transform/keyframe/animation logic. They contribute no audio. Private video/audio use the existing source decoding/mixing path. Existing transition adjacency/duration/handle rules remain, with inline content providing a defined logical extent.

Record packages are evaluated first through their source-time map. Story trim/rate/transform/effects wrap the resulting Record composition. Preserve mic offsets, webcam timing, cursor sampling, and independent composition edits. Seek, playback, and export use the same evaluated visual/audio data.

The current subtitle DOM overlay remains a known finishing gap. This task preserves Story-local subtitle settings through views and bundle projections; the subsequent finishing task implements final caption editing/rendering.

## Persistence and compatibility

- Keep V3 and version `1.4.0-beta.1`; new optional fields must accept older V3 input. Do not claim that older app versions can open newly extended files.
- Keep one `.captr`; `project.json` is authoritative. Stage all global and private sources/sidecars under `assets/<assetId>/`, Record compositions separately, and current Story projections under `Story/`. Manifest projection filenames use bounded unique ordinals; staging consumes each exact manifest `file`. IDs remain unchanged, including long valid legacy IDs, prefix/case distinctions and reserved basename words; filenames are projections, not identities.
- Extend media traversal, asset manifests, transcript/caption sidecar copying, media-path validation, and workspace resolution to all private libraries, including libraries in empty Stories. Generate current Story projections after canonical paths are staged, with no stale absolute references in projection copies.
- Unplaced global and private media must survive save/reopen. Text/Shape inline definitions and Templates are metadata; they require no fake media files.
- Preserve atomic transactions, identity-checked Ctrl+S, capture path preservation, Rename/Save As behavior, recovery queueing, and navigation freezes. Missing private media rejects the entire load before replacing the active project.

Normalize old V3 input on a clone before canonical installation; never rewrite the original bundle during load. For every placed legacy global Text/Shape, construct local content from source metadata plus the existing placement override precedence. Preserve clip IDs, start/rate, visible duration, keyframes, animation, transitions, and shape overrides. Preserve source ranges/extents when sufficient; legacy static Shapes previously allowed infinite handles, so add equal sourceIn/sourceOut head padding and grow logical extent only when required for their existing transitions, without changing visible or clip-local animation clocks. Materialized duplicated sequences receive remapped IDs where required for independent ownership. Remove legacy design Assets from the canonical media library only after all references are resolved. Preserve unplaced legacy design entries in Templates.

Normalization is idempotent. Malformed source content, dangling references, unsafe paths, contradictory inline/media fields, or ambiguous Story association reject the whole load without changing the original file, active project, or save path. V1/V2 Record conversion remains an explicit copy with new identity/path; unsupported metadata and Video/Motion legacy remain rejected.

## Validation and failure behavior

Validate every canonical Story sequence deeply with its effective media scope, not only root tracks. Validate global/private source IDs, clip-content XOR, inline definitions/extent, track compatibility, source bounds, transforms, keyframes, transition handles, composition ownership, template content, and serialization safety.

Mirrored Story projections are checked for consistency and references but do not independently register canonical IDs. Reject the entire command/import/load on failure; retain the previous state and undo history. Display a scoped, actionable error rather than silently treating a missing private source as global media.

## Implementation boundaries

The implementation plan must enumerate graft callers and all literal asset lookups before edits. Use small dedicated ownership/resolution and normalization modules; avoid turning `ProjectEditor` into another source of model rules.

Expected areas include timeline types/commands/validation/evaluation/audio/transitions/media paths, Story conversion and projection utilities, Artboard commands, editor library/timeline/inspector/canvas bounds, AI/MCP tools, voiceover integration, and main-process bundle/media checks. Update tests and issue/roadmap/changelog/AGENTS contracts when behavior changes. No unrelated terminal, Hyperframe renderer, capture native helper, or visual redesign changes are required.

## Acceptance and verification

1. Adding/editing/duplicating Text/Shape in A creates local content without increasing global or private media counts; B remains unchanged. Undo/redo restores IDs/content.
2. Template application and migrated unused design entries preserve content; separate instances edit independently.
3. A/B reuse global video and Record sources with independent clip/Record composition settings, including split/trim/rate and framing.
4. Private sources resolve only within their owner. Publication preserves IDs/paths and placements; undo/redo preserves all valid references.
5. Voiceover finalizes into its captured Story at the captured playhead; stale/deleted/canceled owners reject and clean temporary files. Placement undo retains media.
6. Root/default, legacy inherited, explicit empty, duplicated, and standalone legacy Story cases preserve ownership and metadata. Materialized legacy Artboards do not change when the root is subsequently edited. Updating a Story after reopening does not save a stale `project.stories` snapshot.
7. Old V3 Text/Shape placement overrides, unplaced designs, caption metadata, and shared Record references normalize without input mutation or content loss. Repeating normalization produces the same result.
8. Real `.captr` round trips contain all global/private sources, transcripts/sidecars, inline designs, templates, and empty-Story libraries. Broken media/path input leaves active state and original bytes unchanged.
9. Preview/export rendering of local designs and private media matches at sampled seek times, transition boundaries, and rates 0.5x/2x; Record source clocks remain correct.
10. Native regression checklist covers repeated Record + Ctrl+S, Assets-only save/reopen, imports, two independent Record placements, voiceover navigation choices, Rename/Save As/New identity, and explicit legacy conversion.

Run relevant domain/component/bundle Vitest suites and `npx tsc --noEmit`; compare full-suite failures against a recorded pre-implementation baseline. Existing historical targeted passes do not validate this change. Document native QA as pending until actually executed. After substantial code changes, run `graft build` and record current verification in issue #12.

## Review and next handoff

Specification and execution plan are approved. Tasks 1–8 passed independent reviews. Whole-branch review and its one scoped fix re-review are approved: explicit inherited-Artboard transitions are preserved and dangling Story associations reject atomically. Native regression QA is pending, nine original full-suite failures remain recorded, and no release/push/merge is authorized by these notes.
