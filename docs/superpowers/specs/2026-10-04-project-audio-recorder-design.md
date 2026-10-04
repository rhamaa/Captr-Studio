# Project Audio Recorder Design

**Date:** 2026-10-04  
**Status:** Awaiting user review  
**Scope:** First sub-project in the Project Editor expansion. Transition effects remain a separate follow-up design and implementation cycle.

## Goal

Let users record a microphone-only voiceover inside the Project Editor, save that recording in the project Asset Library, and place an editable audio clip at the playhead where recording began. The feature must be independent of screen recording and preserve audio through `.captr` save/reopen.

## User workflow

1. User opens **Record Audio** from the Asset Library.
2. The recorder lists available microphones. User selects a device, sees a live input meter, then starts recording.
3. Recording starts from the current project playhead while project preview plays. The starting project time is held as an anchor; seeking and timeline edits are disabled until recording stops or is discarded.
4. User stops or discards. Stop pauses preview, closes the microphone stream, finalizes and probes the audio file, registers it in Assets, then places a clip at the anchored start time.
5. The clip uses an unlocked audio track with no overlap at that time. If none is available, the editor creates a new audio track. The existing audio clip waveform is shown.
6. Undoing placement removes only the timeline clip. The recorded source remains in Assets and can be placed again. Removing the Asset remains a separate library action and is blocked while referenced by a clip.

The audio recorder is not the screen recorder: it requests an audio-only stream, does not start Recorder HUD or capture-session IPC, and does not mix screen-recording microphone/system streams into the voiceover.

## Architecture

### Recorder boundary

Create a focused recorder controller/component that owns microphone enumeration, permission, `MediaRecorder`, input metering, timer, and stream cleanup. It emits a finalized audio file and measured duration; it does not mutate project state. It selects a MIME type supported by `MediaRecorder.isTypeSupported`, preserves the resulting MIME type, and maps only to extensions accepted by the existing recorded-audio IPC (`webm`, `wav`, `mp3`, `m4a`, or `ogg`).

Use the existing `save-recorded-audio` IPC to write under the app's `recordings/voiceovers` directory. That handler remembers the returned path as an approved local-read path. Add a narrowly scoped cleanup IPC for discarded or stale temporary voiceovers; it may delete files only inside that voiceovers directory. Project bundle files are never deleted by this cleanup path.

### Project integration

ProjectEditor owns the handoff from finalized file to project state:

- Create a `MediaAsset` with `kind: "audio"`, measured `durationUs`, source path, and stable generated ID.
- Register the Asset as one project-history change.
- In a second project-history change, place a new audio clip at the start anchor. Keep the generated asset/clip/track IDs stable for redo.
- Choose the first unlocked audio track with a free interval covering the clip. If all audio tracks overlap or are locked, add an unlocked audio track and place the clip there in the same history change.
- Existing project-media staging traverses all Assets, including unplaced audio. On `.captr` save, the audio file is copied into `assets/<assetId>/` and referenced relatively by `project.json`.

This two-step history behavior is intentional: undo placement must retain the recording in the library. The audio asset uses the existing V3 model and existing persistence format; no new project version or screen-recording package schema is needed.

### Recording session and project identity

At start, capture the current `projectId`, ProjectSession generation, and playhead `startUs`. Finalization may register only if the same project session is still current. If the project changes while permission is pending or the recording is finalizing, stop/close the stream, reject registration into the new project, and remove the temporary file through the restricted cleanup IPC.

During recording, allow preview playback but disable seek, clip edits, and recorder re-entry. An attempt to close, open, or create a project prompts the user to finish and keep the take, discard it, or stay in the current project. Do not switch projects until that choice completes. The voiceover start anchor never follows the moving playhead.

## Failure behavior

- Microphone permission denial, device removal, or unavailable MediaRecorder shows an actionable error and leaves project state unchanged.
- Discard stops the stream and removes any temporary output; it never registers an Asset or clip.
- Stop finalizes the Blob, saves it, and probes it as audio. If persistence or probing fails, keep the Blob available in the recorder UI with Retry and Discard actions; project state remains unchanged until validation succeeds. Clean up any failed temporary output before retry. Do not claim success with an unplayable or unmeasured file.
- Project change invalidates pending callbacks by session generation. A late file is cleaned up and cannot enter the active project.
- All tracks, `AudioContext`, timers, and animation frames are cleaned on stop, discard, error, unmount, and project change.

## Compatibility and storage invariants

- Existing V1/V2 conversion behavior and existing V3 projects remain unchanged; absent optional metadata retains current defaults.
- Voiceover Assets are ordinary V3 audio Assets, so their storage follows the `.captr` bundle contract: authoritative `project.json`, relative media paths, and media owned under `assets/<assetId>/` after save.
- Asset-only recordings survive save/reopen. Removing a timeline clip never removes its source file.
- Before changing save, autosave, or bundling code, follow the Record project regression checklist in `ISSUE.md`. Update `ISSUE.md` if the media ownership or project persistence contract changes.

## Verification

### Automated tests

- Recorder requests audio-only media, selects a supported MIME/extension pair, measures finalized duration, and releases every track/context/timer on stop, discard, error, and unmount.
- Permission failure, no input device, save failure, probe failure, and discard leave project state unchanged.
- Successful completion creates one audio Asset and one clip at the original playhead anchor, even while preview advanced.
- A conflicting/locked audio track causes a new audio track to be added; placements do not overlap within one track.
- Undoing placement preserves the Asset; redoing restores the same clip and IDs.
- A stale generation cannot register a file into another project and invokes restricted temp-file cleanup.
- `.captr` save/reopen retains an audio Asset with no timeline reference and retains a placed voiceover with its waveform source.

### Desktop QA

Record and discard a take; record while previewing a clip; confirm the voiceover starts at the original playhead; record over an occupied audio interval; save and reopen `.captr`; undo/redo placement; remove the clip and confirm its Asset remains; switch projects during permission/finalization and verify no stale Asset appears. Confirm the screen Record flow still works independently.

## Out of scope

- Screen, webcam, or system-audio recording changes.
- Audio editing effects, noise reduction, transcription, automatic ducking, or cloud sync.
- Transition effects. They will be designed as the next independent sub-project after this Audio Recorder cycle.
