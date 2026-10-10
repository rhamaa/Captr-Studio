# Project Home, File Names, and Rename / Save As

Date: 2026-10-04
Status: written spec approved by the user with "ok implementasikan"; implementation plan awaiting review. Product implementation has not started.

## Intent and approved scope

Normal Captr Studio startup shows Home. Users create a project or select an existing project before entering the video editor. The editor topbar displays the opened `.captr` file name. Changing that name offers Rename Project, Save As, and Cancel.

The user approved the proposed flow with "ok eksekusi" after the conversational design. This document makes that design reviewable. Execution remains native in this session and the existing Experiment checkout. No merge or push is requested.

Home and Editor occupy the same main window. Recording composition editing remains the existing in-app sub-editor. Preserve recording packages, Assets-only capture completion, independent compositions, integer-microsecond timeline clocks, and V3 storage.

## Existing integration evidence

- `src/App.tsx:13-88` mounts ProjectEditor for both the editor window and default startup; HUD, countdown, source selector, and update-toast routes are distinct.
- `src/components/welcome/WelcomeScreen.tsx:19-30,124-534` already provides project actions, project cards, search, and window controls. Reuse its useful components, removing obsolete actions from the Home surface.
- `electron/ipc/project/manager.ts:352-443` builds file-based project names/thumbnails and merges the configured Projects directory with recent paths, sorted by modification time.
- `src/components/editor/ProjectEditor.tsx:175-255,335-362,637-648` owns save/open/new/bootstrap and directly edits `project.title`. Its filename fallback currently only handles empty/default titles.
- `src/components/editor/useProjectController.ts:21-191` owns history, revisions, identity, path, imports, and serialized persistence. Save As creates a new identity; saved-path title fallback currently ignores nondefault stale titles.
- `src/components/editor/useTimelinePersistence.ts:21-63` queues immutable save snapshots and rejects stale project generations.
- `electron/ipc/register/project/save.ts:17-240` verifies project identity for in-place saves and bundles V3 media. There is no dedicated project rename contract.
- `src/components/editor/projectLifecycle.ts:47-85` prioritizes pending project opens and restores recording sessions. Home must not swallow these intents or reset their paths.

## Chosen architecture

Add a small main-window application shell with explicit booting, home, and editing states. It consumes startup intent once and owns navigation. Reuse WelcomeScreen and the existing library backend; do not introduce a second project store or a separate launcher window.

The shell and editor share one project-session controller during an editing session. Loading, New Project, returning Home, and Save As use explicit lifecycle transitions. Playback, project menus, close guards, and shortcuts subscribe only to the appropriate active screen. Home has no synthetic active project, capture identity, or silent save target.

Extract lifecycle coordination from ProjectEditor where needed instead of adding another bootstrap subscriber. Source decoders/renderers are released after a successful exit; the recording editor's composition behavior is unchanged. No project format version change is needed.

## Home experience

Home displays the Captr Studio name, window controls, New Project and Open Project actions, a searchable project grid, and Settings. A project card shows a thumbnail or neutral fallback, filename, modified time, and a path hint for otherwise ambiguous names.

The list contains supported project files in the configured Projects directory plus previously opened paths elsewhere. This is not a whole-disk project scan. Deduplicate paths using platform-aware comparisons. Refresh after successful save, rename, Save As, returning Home, and explicit refresh. Slow or stale refresh responses cannot replace newer data.

An empty library offers New Project and Open Project. Loading and read failures have distinct visible states; a failed library read does not masquerade as an empty library. Missing recent files can be omitted by the existing backend; opening a file removed since listing reports the error on Home.

New Project opens an empty V3 editor without writing a file. Its visible name is Untitled until first save. Reuse existing aspect-ratio presets if retained; unsupported quick actions remain hidden. Direct Record from Home is outside this change; recording begins from a selected/new project in the editor.

Open Project invokes the native file picker. Clicking a card opens that path. Stay on Home while loading and switch only after complete validation and session activation. Unsupported legacy projects retain the explicit convert-as-copy flow; failed/rejected conversion leaves Home and original bytes unchanged.

## Startup and navigation

| Intent | Destination |
| --- | --- |
| Normal startup without an explicit open/capture intent | Home; no automatic previous-project restoration |
| Open a `.captr` from Explorer/Finder or startup arguments | Load it, then Editor; error returns to Home |
| Project-open intent received while Home is visible | Load through the same validated open path |
| Project-open intent received while editing | Existing dirty-project guard before replacing the session |
| Finalized recording explicitly restoring its owning project | Preserve existing bootstrap and asset registration; never invent a different project |
| HUD/countdown/source selector/update-toast | Existing specialized surface |

Back to Home is available in the project editor header/menu. It pauses playback and, if dirty, offers Save, Discard, Cancel. Save must finish successfully and leave no unsaved revision before exit. A canceled/failed save or an edit delivered during saving keeps Editor active. Discard exits without saving. A pristine, never-saved empty project can exit without a prompt.

Returning Home clears the active Electron project/capture context only after the exit guard succeeds. Do not create an empty replacement project as a way to clear context. Pending imports/completions are invalidated by session generation when leaving or changing projects. A stale event must not recreate a project or populate the next project's Assets.

Active capture/finalization, export, and file transactions block project switching until finished/canceled through their existing controls. Back to Home must not silently orphan an ongoing recording. Home close exits normally; Editor close retains its existing save guard. Modal inputs do not trigger editor shortcuts.

## Filename authority and topbar

For a saved project, the active path's exact basename is the display authority: opening `Tutorial.captr` displays `Tutorial.captr`, regardless of an old `project.json.title`. The extension is visible but not editable. Untitled is shown only when there is no saved path.

Internally, `project.title` is the basename without the extension. Normalize it in validated open state and in successful save/rename responses, including nondefault stale titles. A filename/title mismatch during open does not alone mark the project dirty or silently rewrite the original bundle; the next successful save persists the normalized title.

The topbar name is a button or controlled edit affordance, not an input mutating project history on every keystroke. Activating it opens the rename dialog with a draft base name. Apply no title/path/history change before the chosen file operation succeeds. Escape/Cancel discards the draft.

First Save, ordinary Save, Save As, Rename, source preview, and recording sub-editor header all derive visible naming from the same project-session state. New/Open resets that state explicitly. Long names truncate visually with the full name available accessibly. Display extension once.

## Rename dialog

For an existing file, show the current filename and a base-name field with a fixed `.captr` suffix. Actions are Rename Project, Save As, and Cancel. Explain the two file outcomes in one sentence each; do not expose project IDs or implementation details in the UI.

- Rename Project saves the current snapshot under the new name in the same folder, retires the old filename on success, and preserves project identity, sources, compositions, selection, and timeline edits.
- Save As opens the native save dialog suggested with the new name. It writes a separate project identity, preserves the original bundle, and makes the successful copy the active project.
- Cancel, Escape, or canceled native dialogs leave the active file/path/title/identity and dirty state unchanged.
- For an unsaved project, offer Save Project and Cancel instead of Rename; there is no existing file to rename.

Reject empty names, directory separators, `.`/`..`, invalid Windows characters/reserved device names, and trailing-dot/space ambiguities. Accept Unicode and spaces. Handle `.captr` input without doubling the extension. A different file already occupying the Rename destination blocks Rename and asks for another name; it is not an overwrite prompt. Case-only renames must work on Windows. An unchanged name is a no-op.

Save As must not target the original file, including case variants and equivalent filesystem paths. Existing different destinations require the native overwrite confirmation. Overwriting another file is authorized only by that explicit user choice, and cannot be used to overwrite the original under a new identity.

## Persistence, file transactions, and races

File operations share one serialized project operation queue. Requests include the owning project ID, generation, revision, and expected active path. Backend authorization verifies the active bundle identity before Rename; arbitrary renderer paths must not bypass existing trusted-path boundaries.

Rename is a real filesystem/bundle operation, not a metadata-only title update or Save As with a retained original. Stage and validate the complete current V3 snapshot with its new internal title and unchanged identity, including unused Assets and sidecars. Original bytes remain available until the staged destination is validated. Destination publication must reject collisions at commit time, not only during an earlier existence check.

Use a recoverable local transaction for destination publication and original retirement. Record only transaction-owned paths and verified identity in a small recovery record; no recursive deletion of user directories. If original retirement fails, roll back the published destination when safely attributable to that transaction and keep the original active. Recovery must never delete a file modified/replaced by another process. Case-only Rename uses a unique same-directory intermediate name and the same recovery rules. Interrupted operations are resolved before listing/reopening affected projects; ambiguous recovery preserves files and reports an actionable error.

On success, synchronize renderer path/title, Electron currentProjectPath/recording context, remembered recent path, and OS document title. Rename replaces the old recent entry; Save As retains both. Update these only from a verified successful result; reconciliation after a recent-list write failure must use the actual committed file outcome, not falsely report the old path as still active.

Block overlapping navigation and editing during Rename/Save As file commits, including keyboard commands. Pending asynchronous work is checked against ownership before applying it. Ordinary Save retains revision-aware behavior: edits after the saved snapshot remain dirty. No completion from an old generation may change the current topbar/path.

Undo/redo changes timeline content, not filesystem identities or committed filenames. After Rename or Save As, undo/redo must continue to display and persist the active filename; an older history snapshot must not restore a previous file title. Ctrl+S uses the new verified active path. New Project and explicit conversion maintain separate identities/paths.

## Change boundaries

Expected owners are the main-window shell/App routing, WelcomeScreen/project cards, ProjectEditor navigation/name affordance, project lifecycle/controller/history/persistence, Electron project save/library/session handlers, preload/types, and affected locale keys. Add a focused file-transaction helper rather than extending the save handler indefinitely.

Preserve recording-session subscribers and the native/browser capture path contracts. Update ISSUE.md and AGENTS.md when the implementation changes naming/lifecycle contracts. Do not restore Slide runtime, separate recording windows, or previously removed recording-sidebar panels. No new dependencies are presumed.

## Acceptance and verification

1. Normal launch shows Home without activating an empty project. Empty/error/loading project libraries render distinctly; search and card opening work.
2. New Project enters an empty editor as Untitled. Open `Tutorial.captr` whose internal title differs: topbar and sub-editor show Tutorial.captr.
3. New/Open/back-to-Home obey Save/Discard/Cancel. Canceled or failed saves and edits during save prevent navigation.
4. First Save with a different chosen name updates topbar and persisted title. Save As creates a new identity and leaves original bytes unchanged; cancel and same-original-path attempts do not alter state.
5. Rename changes the physical filename in the same directory, preserves identity and all library media, refreshes Home, and Ctrl+S subsequently targets the new file.
6. Real bundle tests cover library-only recording sidecars, title mismatch, duplicate placement edits, missing sources, invalid names, destination collision, Windows case-only rename, file-lock failures, and transaction rollback/recovery.
7. Fault injection at staging/publication/retirement/recent-index boundaries verifies accurate active path, recoverable bytes, and no unrelated file removal. Save/rename/navigation race tests reject stale results.
8. Undo/redo after Rename/Save As cannot restore obsolete names. Repeated Record after Rename retains the active `.captr`; late imports/completions cannot enter another project or reactivate Home's exited project.
9. Cold/warm OS file opening, native menus/shortcuts, close protection, and recording bootstrap continue to work. Unsupported legacy conversion preserves original files.
10. Browser interaction checks cover Home -> Editor -> Home, dialogs, narrow/desktop layouts, keyboard/accessibility, and filename truncation. Focused tests, TypeScript, renderer/Electron build, and Graft refresh accompany code changes.

Native Windows QA must exercise real rename/case-only rename, file locks, OS dialogs, Ctrl+S, recording into the renamed project, save/reopen, Save As, and direct Explorer opening. Automated fixtures/builds do not count as native QA. Existing failures remain reported separately; no full-suite success claim without a fresh complete run.

## Self-review and handoff

Scope matches the approved conversational flow. Existing Home/library components are reused. Startup, native project-open intent, recording bootstrap, dirty guards, filename authority, source ownership, separate Save As identity, collision checks, transaction recovery, and history naming invariants have explicit outcomes and acceptance checks.

The user approved this written spec. The next gate is review of the written implementation plan. Preserve native execution in the current session. This spec changes no product code or storage contract by itself.
