# Story Editor finishing

Approved scope: the five development stages in the conversation, executed natively in order. Record Editor remains the source/composition editor; Story is the final sequence owned by its Artboard. Output dimensions remain fixed by the Artboard.

## Deliverables

1. Stabilize the current test baseline. Separate environmental failures from product failures, fix reproduced regressions, and keep native QA evidence explicit.
2. Final captions: generate Story-owned editable segments/words from source transcripts, edit timing/text/style with undo/redo, and burn them into the shared preview/export renderer. Source mapping must honor clip trims, rate and nested Record clocks. Captions persist in `.captr` under the canonical owner, independently per Artboard.
3. Real waveform and video filmstrip in Story timeline. Reuse the existing audio peak generator and media URL transport. Cache bounded source results, cancel/ignore stale work and clean up media resources. A loading/error state must never show invented waveform data. Trimming/rate select the corresponding source interval.
4. Clip/attribute clipboard, groups, link/unlink video/audio and fades. Operations use immutable commands/history, preserve private media boundaries and independent Record compositions, reject locked tracks and remain atomic. Groups move together. Unlinking a visual media clip creates a corresponding audio placement without flattening its package; linking restores synchronized selection/movement. Fades use the same envelope in playback and export.
5. Placement crop, rectangle/ellipse masks, basic brightness/contrast/saturation adjustments and editable Bezier keyframe curves. Renderer changes apply to preview/export and transitions. All settings are optional and backward-compatible in V3, validated at load, and undoable.

## Decisions

- Reuse current Canvas renderer, domain commands, peak extraction and existing controls. No new dependencies.
- Generated captions snapshot source-clock segments per placement, so later trim/rate/move and Record composition edits stay synchronized. Manual captions use Story time. Explicit regeneration replaces local segments through history; source transcripts remain unchanged.
- Clipboard is internal and scoped to the current project/Story; switching context clears it. No hidden cross-project import.
- Groups are a movement/selection relation, not a nested compound sequence. Speed curves, tracking, LUT import and proxy generation are outside these five stages.
- Native hardware/desktop QA is reported as pending when unavailable; automated checks are never presented as native verification.

## Acceptance

- Tests cover invalid inputs, locked tracks, undo/redo, source/rate mapping, owner isolation and persistence of optional fields.
- Existing V3 projects open unchanged. Save failures preserve original bytes/path.
- Full-suite results, native limitations and per-stage commits are recorded in the progress ledger and `ISSUE.md`.
