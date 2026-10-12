# Record Editor Frame Appearance and Presets

**Status:** Design approved section by section; awaiting user review of this spec  
**Date:** 2026-10-12

## Problem

Record Video compositions currently expose only basic screen and webcam presentation settings. Users cannot design a visual frame around either layer, and any future style must render identically in the live preview and exported video. Users also need to reuse their own designs across projects without treating design data as media Assets.

## Goals

- Add independent appearance controls for the captured window and webcam in the Record Video sub-editor.
- Let users create visual designs from raw settings, including glass-like, solid, and brutalist looks.
- Save each layer's full appearance in its Record composition inside the `.captr` project.
- Let users save a full appearance as a named preset, reuse it across projects, and import/export it as JSON.
- Keep Record Video preview and export on the same renderer path.
- Preserve existing appearance for older projects.

## Non-goals

- Add appearance editing to Record Slide, Story Editor, or unrelated video-editor surfaces.
- Add appearance keyframes or animate frame styling over time.
- Add design presets with fixed names such as “Glass” or “Brutalist.” Those are looks users create by changing raw settings, not built-in preset choices.
- Store style presets as project media Assets, or modify recording capture, source media, or project ownership.

## User model

The Record Video Appearance panel has separate **Window** and **Webcam** targets. Selecting one target shows and edits only that target's design. Each target keeps its own values in the composition.

Controls expose the raw design values: frame padding, border width, color and opacity, corner radius, surface color and opacity, backdrop blur, and shadow color, opacity, blur, and offsets. Values are stored in project-coordinate pixels; opacity is stored from `0` to `1`. UI ranges clamp to supported renderer limits. The existing default appearance remains the initial result for compositions without new style data.

Users can save the current target's complete raw design as a named preset. A preset applies only to the currently selected target and copies values into that composition. Later edits to the composition do not change the saved preset, and edits to a preset do not change compositions that already used it.

## Composition data and compatibility

Store frame appearance in the Record composition's settings, independently for each target. The exact type name may follow the existing recording schema, but it must represent this shape:

```ts
interface RecordingFrameAppearance {
  framePadding: number;
  borderWidth: number;
  borderColor: string;
  borderOpacity: number;
  cornerRadius: number;
  surfaceColor: string;
  surfaceOpacity: number;
  backdropBlur: number;
  shadow: {
    color: string;
    opacity: number;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

interface RecordingFrameAppearances {
  window: RecordingFrameAppearance;
  webcam: RecordingFrameAppearance;
}
```

The field is optional in existing composition data. Resolution fills missing values from legacy `borderRadius`, webcam `cornerRadius`, and webcam shadow settings, preserving their current appearance. Newly edited settings are written to the composition; project-wide settings and Assets remain unchanged. No synthetic media asset or sidecar file is created in the project.

## Rendering behavior

The Record Video preview already evaluates a recording composition through the project renderer. Extend the shared `FrameRenderer` path so both preview and export use the same appearance evaluator.

For each layer, the renderer treats the resolved layout rectangle as the outer frame. It draws the shadow and surface, insets the media by `framePadding`, clips the media to `cornerRadius`, and draws the border within the outer rectangle. Backdrop blur samples and blurs pixels behind the frame before drawing its surface; it must not blur the source media itself. Window appearance is applied to the captured-window layer, and webcam appearance to the webcam layer. Existing layout placement and stacking order remain authoritative.

`framePadding: 0`, transparent surface, zero border, and no added shadow preserve legacy geometry. All style values affect only their selected layer. The renderer applies safe bounds for padding, radius, blur, and shadow so invalid project values cannot create unbounded work or draw outside the frame.

## Preset library and JSON exchange

Presets live in an app-wide **Record Presets** library, separate from project `.captr` Assets and project files. Store one versioned JSON file per preset under the application's user-data directory, for example `userData/record-frame-presets/<preset-id>.json`. This library is available in every project for the current app user.

Each preset file contains a format version, stable ID, name, timestamps, and a complete `RecordingFrameAppearance` snapshot. It has no window/webcam target; applying the same design to both targets requires selecting and applying it to each one independently.

The Appearance panel provides:

- A library picker for applying a saved preset to the selected target.
- **Save as preset** for capturing the selected target's current full design.
- **Import JSON** and **Export JSON** for one preset at a time through native file dialogs.
- Rename and delete actions for library entries.

Import validates the format version and every design value before changing the library. Invalid or unsupported files leave the library and project untouched and show a readable error. Import creates a new library ID and does not overwrite an existing preset. Export writes the selected preset as portable JSON. Applying a preset copies its values into the current composition, so the `.captr` file remains self-contained and portable.

Library writes should be atomic. The library manager validates names, rejects empty names, and resolves duplicate names without overwriting an existing entry. The UI reports save/import/export failures and never claims success when persistence fails.

## Persistence and editing behavior

Changing a raw control updates the selected target's appearance in the composition through the existing composition update path. Existing command scope, project ID, generation, and revision rules continue to apply. Saving and reopening a `.captr` project restores both Window and Webcam values even if the preset library is later unavailable.

Selecting or importing a preset does not place media, add project Assets, change source paths, create a new project, or alter the other target. Preset-library operations do not modify the current composition until the user applies a preset.

## Validation and tests

- Schema tests cover valid raw values, clamping/rejection boundaries, and fallback from legacy composition settings.
- Composition save/reopen tests confirm independent Window and Webcam styles survive in `.captr`.
- Renderer tests cover frame padding, clipping, surface, border, blur, and shadow for both targets, including safe handling of malformed values.
- Preview/export parity tests use the same frame time and composition, then compare rendered frame output.
- Preset-library tests cover persistence across projects, full-value snapshots, atomic write failure, duplicate IDs/names, and delete/rename.
- JSON tests cover round-trip, unsupported versions, malformed fields, and no mutation on failed import.
- UI tests verify target isolation, preset application to only the selected target, save-as-preset, import/export actions, and surfaced failures.
- Update `ISSUE.md` with implementation status and the latest native QA coverage for Record Video.

## Acceptance criteria

1. Window and Webcam each have editable raw appearance values in the Record Video sub-editor.
2. User-created settings can produce glass-like, solid, and brutalist designs without built-in named style presets.
3. Each layer's style persists in its Record composition inside `.captr` and survives save/reopen.
4. Preview and export render the same composition appearance through the shared renderer.
5. Users can save full-design presets, reuse them in other projects, and import/export each preset as JSON.
6. Presets stay outside project media Assets; applying a preset copies values and leaves other targets and projects unchanged.
7. Older projects keep their prior default appearance and continue to open.
