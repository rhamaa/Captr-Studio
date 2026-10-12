# Loop Background Studio Implementation Plan

> **For implementation:** Native, sequential execution. Complete and verify one task before starting the next; commit once when that task is complete.

**Goal:** Add a Home mini-app that generates seamless, infinitely looping GIF backgrounds with Dot Noise, Film Grain, and Orbit patterns.

**Architecture:** Keep the editor independent from `.captr` projects and global Assets. Build a deterministic cyclic Canvas renderer, use it for both preview and GIF frames, then expose the editor through a Home card and a back-to-Home action. GIF frames sample one complete period without duplicating the endpoint, so playback transitions from the final frame back to the first without a jump.

**Tech stack:** React, TypeScript, HTML Canvas, existing `gif.js` dependency and GIF worker setup, Vitest, existing Home and localization patterns.

**Design spec:** `docs/superpowers/specs/2026-10-12-loop-background-studio-design.md`

**Global constraints:** Honor the approved spec; GIF only, 1–10 seconds, 15/20/25/30 FPS, infinite repeat. Preview and export must share the same renderer and parameters. Never attach generated output to a project or Asset library. Keep controls responsive and report progress, cancellation, and errors.

**Review focus:** The periodic renderer and frame timing must eliminate visible loop seams; cancellation must terminate GIF work cleanly; entering or leaving the mini-app must not create or mutate project state.

## Task 1: Build the cyclic Canvas pattern engine

**Files:** Add `src/lib/loopBackground/patternRenderer.ts` and `src/lib/loopBackground/patternRenderer.test.ts`.

1. Define typed pattern and render settings for Dot Noise, Film Grain, and Orbit, including normalized phase and seeded randomness.
2. Implement a shared Canvas renderer. Make every animation periodic over `[0, 1]`; seed spatial and temporal randomness so repeated renders are deterministic and phase `0` equals phase `1` for each pattern.
3. Add tests for all three patterns at supported canvas sizes, deterministic output, and pixel-identical phase endpoints. Run the focused Vitest file and confirm the tests fail before implementation and pass afterward.
4. Run Biome on the changed files. Commit the completed task as `feat(loop-bg): add cyclic canvas patterns`.

## Task 2: Add preview, settings, and GIF export

**Files:** Add `src/components/loopBackground/LoopBackgroundStudio.tsx`, `src/components/loopBackground/LoopBackgroundStudio.css`, `src/components/loopBackground/LoopBackgroundStudio.test.tsx`, `src/lib/loopBackground/gifExport.ts`, and `src/lib/loopBackground/gifExport.test.ts`. Update the corresponding `src/i18n/locales/*/common.json` resources for the new UI.

1. Build the dedicated editor screen with animated Canvas preview and the approved pattern, aspect ratio, resolution, color, density/scale, speed, duration, and FPS controls.
2. Implement GIF export from the same renderer used by preview. Produce `duration × FPS` frames at phases `frameIndex / frameCount` (never include phase `1` as a duplicate frame), set the GIF repeat count to infinite, and surface progress, cancel, completion, and errors.
3. Test frame counts, phase schedule, infinite-repeat configuration, cancellation, and the editor’s basic pattern/control states. Run the focused Vitest tests and confirm they fail before implementation and pass afterward.
4. Run Biome, TypeScript, and the focused tests. Commit the completed task as `feat(loop-bg): add seamless gif studio`.

## Task 3: Connect the mini-app to Home

**Files:** Update `src/components/welcome/WelcomeScreen.tsx`, `src/components/welcome/WelcomeScreen.test.tsx`, `src/components/editor/ProjectApplication.tsx`, and `src/components/editor/ProjectApplication.test.tsx`; update `ISSUE.md` with delivered scope and remaining follow-ups.

1. Add a Home card that opens Loop Background Studio without creating or selecting a project. Add a back action that returns to Home and preserves the existing project/open/capture routing behavior.
2. Test card visibility and navigation in both directions, including that Home remains projectless and existing project bootstrap behavior remains unchanged.
3. Run the affected Vitest suites, `npm run lint`, `npx tsc --noEmit`, and `npm run i18n:check`; address failures caused by this work.
4. Review the final diff against the design spec, update the issue log, and commit once as `feat(loop-bg): expose studio from Home`.
