# Project Transitions and Basic Shapes Design

**Date:** 2026-10-05  
**Status:** Awaiting user review  
**Scope:** First visual-transition and basic-shape phase for the Project Editor. Audio transitions are a separate follow-up.

## Goal

Add usable transitions between adjacent visual clips, enter/exit animation for visual components, and four basic editable shapes. Keep the project timeline duration unchanged, keep Recordings as editable packages, and make preview and export evaluate the same project-time result.

## User workflow

### Transitions between clips

1. User selects the boundary between two adjacent visual clips on the same visual track.
2. User adds a transition, chooses a preset, and adjusts duration, direction/color where relevant, and easing.
3. The timeline shows a transition block centered on the cut. Its handles adjust duration; the Inspector edits its settings or removes it.
4. Preview and export blend the two source samples over the transition interval. Neither clip moves, and project duration does not change.

New clip transitions default to 500 ms, reduced to the maximum available centered duration when source handles cannot provide 500 ms. The Inspector makes the resulting duration and handle limit visible.

Initial presets:

- Cross Dissolve
- Fade Through Black and Fade Through White
- Wipe, with direction
- Push, with direction

### Component animation

Select a visual clip to configure its **Masuk** and **Keluar** animation in the Inspector. Each side supports Fade, Slide, Scale/Pop, and Wipe Reveal, with direction where relevant. These settings apply to supported imported visual media, text, basic shapes, and the complete rendered output of a Record composition.

Each component animation defaults to 300 ms, is capped at 2 seconds and the clip's visible duration, and is measured on project time regardless of clip playback rate. Masuk and Keluar intervals cannot overlap. They are independent of clip-to-clip transitions.

### Basic shapes

The user can add a rectangle, ellipse, line, or arrow at the playhead. The shape appears as a visual component on the timeline and can be selected, transformed, styled, animated, duplicated, and deleted like other components. Its geometry and base style are project data, not an external media file. Each placement has independent transform, animation, and style overrides.

## Architecture

### Project model

Add optional V3 fields; do not bump the project version for this change. Older V3 projects without these fields load with no transitions, no component animations, and no shape assets.

- Store clip-to-clip transitions in a project-level collection. Each relation has a stable ID, visual track ID, outgoing clip ID, incoming clip ID, preset and parameters, positive integer-microsecond duration, and easing.
- Store component enter/exit settings with the corresponding visual clip. Each side has a preset, duration, easing, and optional direction. An unset side means no animation.
- Add a typed shape asset definition for rectangle, ellipse, line, or arrow, with validated geometry and solid fill/stroke properties as appropriate. It has no filesystem path. A placed shape clip shares immutable source geometry but can hold per-placement style overrides and uses the normal clip transform and component-animation settings.
- Keep relationships separate from media assets. Clip deletion never deletes an asset. Transition IDs and shape asset IDs remain stable across undo/redo and save/reopen.

Validation rejects unknown presets, invalid colors or geometry, non-finite values, unsafe or duplicate IDs, invalid references, non-positive durations, unsupported easing, and malformed transition relations. It must not silently discard malformed transition data. Existing V3 projects that lack optional fields remain valid.

### Clip-transition rules and source handles

A clip transition is valid only when its outgoing and incoming clips are enabled visual clips on the same track and are directly adjacent: the outgoing clip's project end equals the incoming clip's project start. The boundary time is derived from the clips; it is not duplicated as independently editable state.

The transition interval is centered at boundary `b`: `[b - duration/2, b + duration/2)`. Project duration and both clip placements remain unchanged. During that interval, the evaluator samples the outgoing source past its visible source end and the incoming source before its visible source start, maps samples through clip rate and any Record-composition time mapping, then blends them using transition progress and easing. Outside the interval, normal clip evaluation applies.

The centered duration requires a usable outgoing tail handle and incoming head handle of at least half the requested duration in project time. The available maximum is computed after source-clock, rate, and Record-composition mapping. Images and generated shapes can hold their still image as a handle. Recordings remain their original packages; transitions sample their composed output and do not flatten or rewrite the package.

If the available handle is too short, the domain command rejects the requested duration with the maximum available duration. The UI shows that maximum and explains the limit. It must not silently move clips, shorten their visible ranges, or extend the project. Moving, trimming, splitting, or deleting a clip that makes a transition pair non-adjacent removes that relation in the same atomic project-history operation. Undo restores both the clip state and the relation.

### Component animation evaluation

Animations are evaluated from the clip's visible project-time start/end, not from media time. The deterministic sampler returns progress in `[0, 1]` for a given project timestamp, including after random seek. It samples the clip's existing transform/keyframes first, then composes the enter/exit effect over that base result. Fade multiplies opacity; Slide and Scale/Pop modify the sampled transform; Wipe Reveal adds a directional clip reveal. A component animation never changes clip timing or audio.

Trim and rate changes do not scale animation durations. On a trim, the affected edge animation stays attached to that visible edge and is clamped to the remaining duration after preserving the opposite-edge animation; remove it if no duration remains. A split keeps the original entry on the left segment and the original exit on the right segment. New inner edges receive no animation. Undo restores the exact prior durations and settings.

### Shared evaluation and rendering

Use one pure project-time evaluator/sampler for Project Preview and timeline export. It returns visual layers and transition progress/source samples in stable track order. Preview and export consume the same evaluated result; neither implements its own transition timing.

Transition compositing occurs after each visual layer is rendered. For Record clips, render the complete composition—including screen, cursor, webcam, layout, zoom, and existing effects—at the requested mapped time, then composite that rendered result with the neighboring clip. Shape rendering uses the same frame renderer and layer ordering as other project visuals. Audio evaluation and mix behavior are unchanged in this phase.

The existing Slide/video-editor `TransitionsSection` is a legacy Slide workflow. It must not be reused as the Project Editor model, evaluator, or UI implementation. This project feature belongs to the V3 timeline/editor path.

## Interaction and presentation

- Show an add-transition affordance at eligible visual clip boundaries. A transition is selected independently from either clip.
- Render a compact transition block centered on the boundary. Duration handles resize it; snapping and track locks follow existing Project Timeline rules.
- Selecting a transition exposes preset, direction/color, duration, easing, and remove controls in the Inspector.
- Selecting a visual component exposes separate Masuk/Keluar controls. Show current duration and disable options that cannot fit the clip.
- Add Shape exposes rectangle, ellipse, line, and arrow. New shapes start at the playhead on an unlocked visual track; if needed, create a visual track through the existing track command.
- Keep selection, undo, redo, keyboard, and drag operations on the existing project-history/command path.

Audio fades, audio crossfades, transitions across gaps or different tracks, overlap-style timeline transitions that extend project duration, arbitrary vector/path editing, shape import, transition marketplace/presets, and keyframed custom transition curves are out of scope for this phase.

## Compatibility and persistence

- Optional transition, component-animation, and shape fields round-trip through existing V3 `project.json` validation and persistence; no new media files are needed for basic shapes.
- Existing V3 projects load with default empty transition/shape behavior and save without unrelated changes.
- Shape assets are project assets and participate in normal library references and remove-while-referenced protection. Timeline deletion leaves the source shape asset intact.
- Save/reopen preserves transition settings, shape definitions, and per-placement overrides. If validation fails, project loading fails as a whole rather than silently dropping edits.
- Do not change Record capture finalization, `.captr` ownership rules, or automatic recording placement. Before any persistence code change, follow the Record project regression checklist in `ISSUE.md`; update `ISSUE.md` if the storage contract changes.

## Failure behavior

- A non-adjacent, disabled, non-visual, or cross-track pair cannot receive a transition.
- A requested duration exceeding either required handle is rejected and reports the available maximum.
- A trim that shortens the clip clamps only the animation at the trimmed edge to the available duration after the opposite-edge animation; if none remains, it removes that edge animation. A split keeps outer-edge animations on their corresponding segments and adds no animation at the new cut.
- Malformed transition or shape data prevents the project from loading; it is never silently dropped.
- Missing Record source media follows existing required-media behavior and cannot produce a blank successful transition render.
- Render/export failure or cancellation leaves source assets and project data unchanged.

## Verification

### Automated tests

- V3 validation accepts old documents with absent optional fields and round-trips new transitions, animations, shapes, and per-placement overrides.
- Transition commands accept only adjacent clips on one visual track; validate IDs, preset parameters, integer-microsecond duration, and maximum handle duration.
- Handle calculations cover rates below/above 1x, source in/out trims, image/shape holds, and Record-composition mapping. Too-short handles reject without changing clips or project duration.
- Moving, trimming, splitting, or deleting a related clip removes an invalid relation atomically; undo/redo restores the relation and clip state.
- Transition endpoints and midpoints, all presets, easing, and random seeks produce deterministic source times and blend weights.
- Enter/exit animations honor project-time duration, keyframe composition, clip trims/splits, rate changes, and no-overlap validation.
- Shape geometry/style validation, placement overrides, layer order, serialization, and frame rendering cover rectangle, ellipse, line, and arrow.
- Preview and export render the same deterministic frames around cuts and component-animation boundaries, including a Record composition blended with imported media.
- Existing audio output is unchanged; empty-timeline export and missing required source checks retain existing behavior.

### Desktop QA

Create each basic shape; style, duplicate, animate, save, and reopen it. Add each clip-transition preset between imported video clips and between a Record composite and imported media. Test duration resizing at full and limited handles, playback at the cut, random seeking before/during/after, clip move/trim/split/delete with undo/redo, and project duration invariance. Compare preview and exported frames. Reopen a pre-feature V3 project and verify it still opens. Verify Ctrl+S and `.captr` save/reopen preserve all new data. Native desktop QA remains pending until exercised on the target app.

## Implementation sequence

1. Add typed transition/shape/component-animation data, validation, immutable commands, handle calculator, and history behavior; cover them with domain tests.
2. Extend the shared project evaluator with transition sampling and component-animation sampling; verify deterministic random seek and source-clock mapping.
3. Render the four basic shapes and compositing effects through the shared project frame renderer; prove preview/export frame parity.
4. Add transition-boundary timeline interactions, shape creation, and Inspector controls using existing project commands and history.
5. Complete V3 save/reopen tests, regression coverage, build/test checks, and native desktop QA. Update the issue ledger only if storage behavior changes.

## Plan self-review

The agreed scope is represented: fixed project duration with source handles; distinct boundary relations and per-component enter/exit animations; shared preview/export evaluation; preservation of the complete Record composition; v1 presets and basic shapes; optional V3 data; atomic cleanup and undo; and a validation/test sequence. Audio transitions and broader custom vector/animation tools remain outside this phase.
