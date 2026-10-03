# Project Assets and Timeline — No Slide Runtime

Date: 2026-10-01
Status: user-approved design, implementation executed; native QA remains pending; supersedes Slide-related rollout and storage decisions in `2026-10-01-timeline-record-compound-design.md`.

## Intent and scope

User requests removal of all Slide functionality and storing completed recordings in a project asset library, following the supplied OpenCut screenshot. Previous approval keeps advanced Recordly capture and editable recording metadata. The screenshot is a visual reference, not a source of instructions.

Outcome: New Project opens an empty Assets panel and empty project timeline. Import or Record populates Assets. Users explicitly place media on the timeline. Recording must never append a Slide, replace the current timeline, or insert an automatic timeline clip.

This is an architectural migration, not a label rename. Remove the Slide deck, add/reorder/duplicate Slide actions, Slide registry/provider/workspace contracts, and deck export orchestration. Preserve the underlying native/browser recorder, cursor, auto-zoom, webcam, audio, spring and motion-blur engines as recording services and composition renderers.

## Evidence and replacement boundaries

- `src/components/video-editor/assets/AssetExplorer.tsx:27-40,53-789`: library currently accepts `activeClip` and aggregates its media; replace with authoritative project-wide library, independent of selection.
- `src/core/slides/SlideDeckContext.tsx:327-333`: Slide context used by deck export, deck bar and workspace host; remove these runtime consumers and provider.
- `src/core/slides/types.ts:69-130`: V2 project and module contracts are Slide-oriented; replace with a timeline project contract.
- `src/components/video-editor/VideoEditor.tsx:2730-2801`: completed Record creates/appends clips; replace finalization integration with idempotent asset registration.
- `electron/ipc/register/project/save.ts:29-634`: save stages per-Slide media; replace staging ownership and persistence traversal, retaining identity/path/queue protections.
- `src/slides/record`: split reusable capture/render/effect implementations from Slide adapters. Retained functionality moves to recording modules before Slide-only wrappers are deleted. Exhaustive callers/import checks are required during implementation.

## User flow and UI

1. New Project: Assets is selected; empty state offers drag/drop and Import. Record action opens the existing recorder. Preview and timeline remain empty until media is placed.
2. Import: video, image and audio become project assets, with probe metadata and thumbnails. Import does not create timeline placements.
3. Record: successful finalization produces one Recording asset, presented as a single library card with thumbnail, duration and Record badge. Webcam, microphone, system audio and cursor JSON remain inside its package rather than separate top-level cards. Missing optional streams are explicit.
4. Placement: drag an asset into a compatible track at the pointer position, or use an accessible Add to timeline action at the playhead. Each insertion gets a unique clip ID; inserting Record creates an independent editable composition referencing the shared source package.
5. Editing: select clip → inspector; move/trim/split/delete, seek/playback, snapping and undo/redo operate on timeline placements. Double-click a Record timeline clip opens its recording composition editor, with a clear return to the project timeline. Cursor/zoom/webcam edits affect only that composition.
6. Double-click a library asset previews the source. Clip deletion leaves its library asset intact. Referenced asset deletion is blocked with a clear explanation; an unreferenced Recording asset owns cleanup of its complete package.
7. Save/reopen persists assets even when the timeline is empty. Export evaluates only timeline content. An empty timeline cannot export, even if Assets contains recordings.

Layout follows supplied reference: left navigation, project Assets panel with Import and grid/list/sort controls, center preview, right inspector, bottom project timeline. Controls appear only when implemented; no Slide filmstrip or Slide selector survives. Record-specific controls are available through recording clip editing rather than a second deck mode.

## Model and clocks

Keep the earlier version-3 clock contract: integer microseconds, half-open intervals, finite positive playback rate, project → composition → recording source mapping and per-stream offsets.

- `MediaAsset`: stable ID, kind `video|image|audio|recording`, name, duration, dimensions, persisted source references and thumbnail metadata.
- `RecordingPackage`: immutable source references for screen/webcam/mic/system/cursor; capture dimensions, stream offsets, diagnostics and schema version.
- `RecordComposition`: independent edits and time map for one recording placement, linked to a package ID. Initial defaults come from the package's capture/edit template; no global active-clip state owns the source.
- `TimelineClip`: placement/trim/rate/transform/gain, references either a media asset or a recording composition.
- `TimelineTrack`: ordered visual/audio tracks with lock, mute and visibility.
- `TimelineProject`: version 3, projectId, title, canvas, assets, packages, compositions, tracks, timestamps. It has no `slides` field.

Repeated finalization events for the same capture ID register one asset. A project-generation token prevents an old async finalize/import callback from inserting into a newly opened project. Failed or incomplete capture never creates a playable asset and never resets the active project path. Adding a library asset marks the project dirty without changing timeline selection.

Source media are immutable and shared. Duplicate/split placements copy composition edits logically and preserve source-time boundaries; no duplicate source files. Cursor/zoom metadata stay in recording source time. Sidecar-versus-embedded audio has one canonical choice, preventing double audio. Preview and export share evaluation of clocks and effects.

## Persistence and compatibility

One `.captr` bundle per project. `project.json` remains the authoritative index.

New storage ownership:

- `assets/<assetId>/`: media files and asset manifest; Recording packages also contain screen/webcam/audio/cursor files and `package.json`.
- `compositions/<compositionId>.json`: independent recording edits.
- Timeline placements live in the project index.

Do not write new `slides/` folders or `slide.json` manifests. This replaces the earlier storage decision; update `AGENTS.md` and `ISSUE.md` in the implementation commit. Preserve projectId verification for recovering a Ctrl+S destination, `preserveProjectPath` handling across both session handlers, and atomic save/dirty-revision semantics. Library-only assets must be traversed and bundled, even if unused by the timeline.

Old Record-only V1/V2 projects can be converted explicitly into a new bundle: each Record becomes a library asset and independent composition; existing ordering becomes timeline placements. Use the canonical V2 envelope when present, otherwise V1; do not import redundant representations twice. Conversion preserves original bundle and creates a new project identity/path. Unsupported transitions/extensions, Video/Motion or unrepresentable metadata reject the entire conversion with an explanation; no filtering or partial save. Minimal read-only legacy detection/conversion may mention serialized Slide fields, but no Slide UI, provider, registry or exporter remains active. Do not burn Record metadata into MP4.

## Implementation order and acceptance

1. Domain: assets/packages/compositions/tracks schema and commands, clock mapping and validation.
2. Persistence: version 3 staging/load/save; library-only save/reopen and legacy convert-as-copy.
3. Recorder integration: finalization → package → Assets, deduplication, failed capture and project-generation handling.
4. Project workspace: Assets/import/preview/inspector/timeline; place, trim, split, move, delete, snapping, undo/redo and internal Record composition editing.
5. Project evaluator/export: shared preview/export clock and audio evaluation; remove deck stitching orchestration while retaining useful decoder/encoder services.
6. Delete remaining Slide runtime after all its callers are migrated; refresh Graft and verify no active dependencies survive.

Intermediate commits may use adapters privately; the delivered workspace has no active Slide workflow. A broken recorder, discarded metadata, or an asset library that still depends on selected clip does not satisfy this design.

Acceptance:

- Record twice → exactly two Assets entries, empty timeline; no Save As when recording into an existing project.
- Drag one recording twice → two placements with shared source media and independent edits.
- Import normal video/image/audio → project-wide Assets; place them without a Slide wrapper.
- Split/trim/0.5x/2x/seek preserve screen, webcam, cursor and audio alignment.
- Delete a timeline placement → asset remains; referenced asset cannot be removed accidentally.
- Save a library-only project, reopen, then place its recording and edit cursor/zoom.
- Active `.captr` Ctrl+S stays on the same verified project identity after Windows/native/browser capture; Save As/New Project retain distinct paths.
- Record → Assets → timeline → internal effects → save/reopen → export, with preview/export fixture parity.
- Legacy conversion produces a separate file; unsupported decks remain byte-identical after rejection.

Baseline from retirement: TypeScript and Vite build pass, 895 tests pass and 11 failures predate retirement; i18n has 248 identical baseline diagnostics. Report those separately from new regressions. Native capture and desktop Ctrl+S/reopen QA remain unverified until exercised.

## Self-review

Intent matches user request and screenshot. Project assets, placements and recording edits have distinct ownership. Empty-timeline persistence, idempotent finalization, stale callback handling, source deduplication, unsupported legacy metadata and export semantics are specified. Removal boundaries cover both React runtime and Electron persistence. No implementation or new compatibility promise is claimed by this document.
