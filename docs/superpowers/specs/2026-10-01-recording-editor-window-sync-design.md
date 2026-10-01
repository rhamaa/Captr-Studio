# Recording Editor Sub-Editing Panel

## Goal

When a user double-clicks a recorded clip, switch the main project window into a focused recording sub-editor for that clip. Keep the project editor in the same window and return to its timeline when the user chooses Back. Recording edits remain part of the current project and use its existing history and `.captr` save behavior.

## Current Context

- `ProjectController` in `src/components/editor/useProjectController.ts` owns the authoritative `TimelineProject`, history, revisions, selection, playhead, and save queue in the main renderer.
- `RecordingCompositionEditor` in `src/recording/editor/RecordingCompositionEditor.tsx` is controlled: it receives a package and composition and emits updates through `onChange`.
- `ProjectEditor` already tracks an `editingClipId`; timeline and inspector actions set it, and the editor resolves the matching composition/package.
- The current editor renders the sub-editor as a modal overlay above the still-visible project workspace. The requested flow replaces that overlay with a dedicated in-window sub-editor view.

## Selected Architecture

Keep one `ProjectEditor` instance and one `ProjectController`. Render one of two body views below the shared project header:

- Project view: asset library, preview, inspector, timeline, and footer.
- Recording sub-editor view: recording effects editor for the selected recording clip.

When `editingClipId` resolves to a valid recording composition and package, render the sub-editor in place of the project workspace. Do not show a backdrop, modal dialog, or second `BrowserWindow`. Keep the project-level header and save controls available. The sub-editor keeps its own “Back to project” action.

The existing `onChange` callback continues to apply `updateComposition` through the same `ProjectController`. This keeps composition edits in the existing undo history and marks the main project dirty. The sub-editor does not own project persistence. Its local preview playhead remains local; the project timeline selection and playhead stay in the controller while the project view is hidden.

Returning to the project clears `editingClipId` and renders the existing workspace from the current controller snapshot. Do not recreate or reset the controller, selection, playhead, path, save queue, or history during this view switch. If the target clip/composition disappears, exit the sub-editor safely and return to the project view.

## Navigation and State Lifecycle

1. Double-clicking a recording clip in the timeline or choosing its Edit action sets `editingClipId` and stops project timeline playback.
2. The editor resolves the selected clip's recording package and composition, then replaces the project workspace with the recording sub-editor.
3. Recording-setting edits execute `updateComposition` against the latest project in the existing controller. Accepted edits update history and dirty state immediately.
4. “Back to project” clears `editingClipId`; the asset library, preview, inspector, and timeline return with their prior selection and playhead. The project preview now reflects the edited composition.
5. Project replacement or removal of the edited composition clears the sub-editor target. The main editor's normal New/Open/Save/Save As flows remain authoritative.

## Scope

### Included

- Replace the composition modal overlay with an in-window sub-editor view.
- Preserve existing timeline/inspector open actions and the editor's Back action.
- Fill the available workspace area with recording effects controls and preview.
- Keep edits in the main controller's history, dirty state, undo/redo, and project save flow.
- Add focused tests for mutually exclusive project/sub-editor views and restoration behavior.

### Excluded

- A separate Electron `BrowserWindow`, IPC state synchronization, or a second project store.
- Changes to recording capture, finalization, package storage, or legacy Slide conversion.
- Synchronizing the recording preview's local playhead with the project timeline playhead.

## Validation

- Component tests prove the recording sub-editor replaces the project workspace and the project workspace returns when the sub-editor closes.
- Project-controller tests verify selection, playhead, history, and dirty state remain owned by the same project while composition edits are applied.
- Existing timeline interaction and recording-composition adapter tests continue to pass.
- Native Windows QA opens a recording clip from the timeline, edits an effect, returns to the same selection/playhead, saves with Ctrl+S, and reopens the `.captr` with the edit intact.

## Risks and Decisions

- Switching conditional body views must not unmount `ProjectEditor` or recreate its controller. Only workspace and sub-editor children should swap.
- The project preview is hidden while editing; it must render the edited composition immediately after Back.
- Invalid or removed composition targets must not leave the screen blank or trap keyboard shortcuts; return safely to the project view.
