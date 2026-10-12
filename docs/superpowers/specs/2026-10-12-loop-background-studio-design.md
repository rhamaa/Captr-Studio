# Loop Background Studio

## Goal

Add a small, project-independent mini-app to Captr Studio Home for designing short animated backgrounds and exporting them as infinitely looping GIFs. The first release focuses on procedural visuals; it does not create or modify `.captr` projects or Assets.

## Approved product decisions

- Launch from a new Home card and open a dedicated editor view with a back-to-Home action.
- Build with a React screen and pure HTML Canvas rendering, then encode frames with the existing `gif.js` dependency.
- Start with three patterns: Dot Noise, Film Grain, and Orbit.
- Provide a live animated preview, basic appearance/motion controls, and GIF export.
- Keep designs session-only in the first release; no project or preset persistence.

## User flow

1. User selects the Loop Background Studio card on Home.
2. A dedicated editor opens with a centered canvas preview and settings panel.
3. User selects a pattern, sets a 16:9, 9:16, or 1:1 canvas, output size (720p or 1080p), colors, and pattern-specific density, size, and speed; duration (1–10 seconds, default 4) and frame rate (15, 20, 25, or 30 FPS) configure the loop.
4. User previews the animation and chooses Export GIF.
5. Export reports progress, allows cancellation, and produces a downloadable GIF configured to repeat forever.
6. Back returns to Home. Leaving or restarting the app discards the current design.

## Rendering and loop behavior

- Keep each pattern renderer deterministic: the same config and phase produce the same pixels.
- Preview phase is `(elapsed time / duration) mod 1`. Export samples `frameIndex / totalFrames` for indices from zero through `totalFrames - 1`; it must not append a duplicate endpoint frame.
- Motion uses periodic functions and seeded values so the transition from the final exported frame to frame zero is visually continuous.
- Dot Noise animates a seeded dot field; Film Grain animates a deterministic grain field; Orbit animates seeded elements along periodic paths.
- Preview and export call the same frame-rendering function so exported visuals match the editor.
- Use `gif.js` with its existing worker-URL bundling pattern, a finite configured frame delay, and repeat value `0` for infinite playback.

## Interface

- Home card: “Loop Background Studio” with a concise description of creating looping animated backgrounds.
- Editor header: Back to Home, editor name, and Export GIF action.
- Main area: live canvas preview with a stable aspect ratio.
- Settings panel: pattern selector; 16:9, 9:16, or 1:1 canvas; 720p or 1080p output; background/accent colors; pattern density/scale/speed; 1–10 second duration (default 4); 15/20/25/30 FPS.
- During export, show frame/render progress and a cancel action; on success expose the GIF download.
- The editor remains independent of project selection and project save state.

## Boundaries

- GIF is the first-release output. MP4/WebM, timeline editing, importing media, saved presets, project asset integration, and Story/Record Editor integration are out of scope.
- Keep the feature inside the existing desktop app and Home flow; do not add Remotion or Hyperframes runtime dependencies.
- Existing video-editor GIF export behavior remains unchanged.

## Acceptance criteria

- Home opens the dedicated editor and Back returns to Home without changing project state.
- All three patterns preview and export using identical rendering logic.
- Exported GIF has the selected dimensions, approximate duration/frame rate, and infinite loop metadata.
- First-to-last playback transition is seamless for each pattern and the same config renders deterministically.
- Export progress, cancel, and error states leave the editor usable.
- No project, Asset, or saved-preset files are created or modified.
- Meaningful tests cover phase wrapping/determinism, dimension and frame-count calculations, Home entry/back behavior, and export configuration.

## Implementation notes

`ProjectApplication` owns Home-level navigation, and `WelcomeScreen` owns the Home card surface. The new editor should be selected only while no project controller is active; opening a project must clear or supersede the Home tool selection. Keep renderer and export helpers separate from UI components so loop math and frame output can be tested without Electron.

The existing `GifExporter` currently decodes video before encoding. The mini-app should share the installed `gif.js` dependency and worker setup while adding frames directly from its Canvas renderer, rather than fabricating a video source or changing video export behavior.
