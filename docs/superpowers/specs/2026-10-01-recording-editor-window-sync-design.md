# Recording Editor in a Synchronized Window

## Goal

Open recording-effect editing in a separate, resizable Electron window while the project editor remains open and usable. Both windows must show the same recording composition state in real time. Edits made in the recording window must update the main project preview, project dirty state, undo history, and the existing `.captr` save path.

## Current Context

- `ProjectController` in `src/components/editor/useProjectController.ts` owns the authoritative `TimelineProject`, history, revisions, selection, playhead, and save queue inside the main editor renderer.
- `RecordingCompositionEditor` in `src/recording/editor/RecordingCompositionEditor.tsx` is already a controlled component. It receives a package and composition and emits updates through `onChange`.
- `src/App.tsx` selects renderer content using the `windowType` query parameter.
- `createEditorWindow` and `createSourceSelectorWindow` in `electron/windows.ts` establish secure `BrowserWindow` configuration with `contextIsolation` and a preload bridge.
- Renderer state lives in separate JavaScript contexts per `BrowserWindow`; synchronization must use typed Electron IPC.

## Selected Architecture

Keep the main editor's `ProjectController` as the only source of truth. The recording editor window is a controlled view of one recording composition. It must not load or own a second project controller, history stack, or project save queue.

The main editor opens one child window per `(projectId, compositionId)`. Reopening the same composition focuses its existing window. Different recording compositions may have separate windows. The child uses a dedicated route such as `?windowType=recording-editor` and receives a session-scoped bootstrap snapshot containing project identity, asset/package identity, composition identity, revision, and the validated package/composition data needed for editing and media preview.

Recording-setting edits travel as typed patches, not replacement project snapshots. The child sends `projectId`, `compositionId`, `sessionId`, `requestId`, and a `Partial<RecordingSettings>` patch through a narrow preload API. The main process routes the request to the owning editor renderer. That renderer checks the active project and composition, applies the patch to the latest composition through the existing project command/history path, and publishes the authoritative composition/revision back through the main process to the child. This keeps undo, dirty tracking, save, and the main preview connected to the same update.

The IPC bridge must be explicit and typed. It must validate the sender window and session, reject requests for a stale project/composition, and deduplicate repeated `requestId` values. It must not expose generic IPC channel access to renderer code. The main process relays messages and owns child-window lifecycle; it does not become a second project-state store.

## Window and State Lifecycle

1. The main renderer requests an editor window for a recording clip using stable project, asset, and composition IDs.
2. The main process validates that the request came from the active editor window, creates or focuses the matching child `BrowserWindow`, and sends the bootstrap snapshot after the child route is ready.
3. The child renders `RecordingCompositionEditor` from the snapshot. Every setting change is submitted as a patch and reflected only after the authoritative update returns.
4. The main renderer publishes composition changes from commands, undo/redo, and project replacement to any open child editing that composition.
5. If the project controller begins a new/open/conversion session, project identity changes (including Save As), or the target composition is removed, the main editor invalidates the session and closes the child. The user can reopen it from the current project. A stale child cannot edit the new project.
6. Closing the child releases its session; it does not roll back accepted edits. The main project remains dirty until the normal project save succeeds. Saving remains owned by the main editor, so Ctrl+S and `.captr` persistence keep their existing behavior.

The child window is non-modal and parented to the main editor. The main project timeline selection and playhead remain owned by the main editor; the recording preview's local playback position remains local to that child. Composition settings and rendered project preview update in both windows in real time.

The child window contains recording-effect controls and preview only. Project-level New/Open/Save/Export/Record actions remain in the main editor.

## Scope

### Included

- Dedicated Electron window and renderer route for the recording composition editor.
- Typed preload methods and IPC contracts for open, bootstrap, patch, authoritative update, error, and close lifecycle.
- Main-process window manager keyed by project and composition identity.
- Main-renderer integration with `ProjectController`, history, dirty state, and live preview.
- Stale-session rejection, request deduplication, cleanup on window/project lifecycle changes, and focused tests.

### Excluded

- Moving `ProjectController`, history, or project persistence into the Electron main process.
- A second project editor or independent save path in the child window.
- Synchronizing the main timeline's selection/playhead with the child preview playhead.
- Changes to recording capture, finalization, package storage, or legacy Slide conversion.

## Validation

- Unit tests prove setting patches applied from the child update the single authoritative composition and produce normal history/dirty revisions.
- IPC/window-manager tests prove only the owner editor and matching session can exchange messages, duplicate requests are ignored, and stale project/composition messages are rejected.
- Renderer tests prove the dedicated route bootstraps, displays an error for an invalid/expired session, and releases listeners on close.
- Existing composition-adapter and project-controller tests continue to pass.
- Native Windows QA verifies the main editor remains usable while the child is moved/resized, setting changes update both previews, Ctrl+S persists edits, and reopening the `.captr` restores the same composition settings.

## Risks and Decisions

- High-frequency slider updates could create excessive history entries. Preserve current composition-editor interaction semantics during the first implementation; tests must check one accepted patch follows the existing history path. If current controls already support gesture grouping, reuse it rather than adding a second transaction model.
- A child renderer may finish loading after its project has changed. Session and project identity checks make the bootstrap/update path fail closed and prevent stale writes.
- Local media preview must continue using the existing approved media URL path; renderer-provided arbitrary file paths are not accepted as IPC commands.
