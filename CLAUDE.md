# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Captr Studio** is an Electron + Vite + React 18 + TypeScript desktop app: a screen recorder plus a
multi-track "Story" video editor (forked from Recordly). It does native capture (WGC on Windows,
ScreenCaptureKit on macOS), offline Whisper transcription, PixiJS preview/export, multi-Artboard
repurposing (9:16 / 1:1 / 16:9), Hyperframe motion graphics, and an AI agent bridge (local MCP
server + external CLI runners). Projects are saved as single `.captr` ZIP bundles.

Active work happens on the `Experiment` branch; `main` is the PR base. Much of the in-repo prose
(`ISSUE.md`, `AGENTS.md`, `docs/`) is in Indonesian.

## Read first

- **`AGENTS.md`** — binding contracts for Record slides, `.captr` V3 saving/autosave, visual effects
  and shapes, Home/project naming, and file-operation queuing. Follow it before touching recording,
  saving, Story ownership, or project lifecycle code.
- **`ISSUE.md`** — issue log and regression checklists. Update it when a contract changes, and record
  native QA status and test coverage there.
- `docs/architecture/` — `project-format.md` (`.captr` V3 layout), `ownership.md` (asset/Story
  ownership), `timing-rendering.md` (time mapping, `evaluateProject`), `agent-mcp.md` (AI harness).
- `DESIGN.md` — UI design system (soft pastel glassmorphism, `captr-*` color tokens, banned neon
  cyan/sky colors).

## Navigating the code: use graft

The repo is indexed in `graft/`. Prefer it over grep/reading whole files:

- `graft ask "<question>" --source` — locate and understand code (add `--full` for whole spans)
- `graft grep "<literal>"` — exhaustive occurrences
- `graft skeleton <file>` — a file's API surface
- `graft callers <symbol> [--direction out] [--depth N|all]` — call edges / blast radius
- `graft build` — refresh the graph after large changes

## Commands

```bash
npm install            # postinstall runs scripts/postinstall.mjs
npm run dev            # Vite dev server + Electron (renderer on :5173)
npm test               # vitest --run (all tests)
npx vitest run path/to/file.test.ts      # single test file
npx vitest run -t "test name"            # single test by name
npx tsc --noEmit       # typecheck (tsconfig excludes *.test.ts from tsc)
npm run lint           # biome check .   (lint:fix / format also available)
npm run i18n:check     # verify locale keys against src/i18n/locales/en
npm run build          # native helpers + tsc + vite build + CJS normalize/smoke + electron-builder
npm run build:win:local  # Windows build allowing a missing Whisper runtime
```

`npm run build` compiles native helpers first (`build:platform-native-helpers`: Windows capture,
GPU export, NVIDIA CUDA compositor, cursor monitor, Whisper runtime). The Electron main bundle is
emitted as `dist-electron/main.cjs` and then normalized/smoke-tested by
`scripts/normalize-electron-main-cjs.mjs` / `scripts/smoke-electron-main-cjs.mjs`.

Some tests depend on loopback servers, hardlinks, or junctions and can fail inside a sandbox while
passing outside it — check before treating such failures as product bugs.

## Code style

- Biome: **tabs**, line width 100, LF line endings. Run `npm run lint:fix` rather than hand-formatting.
- TypeScript `strict`, `noUnusedLocals`, `noUnusedParameters`.
- Path alias `@/*` → `src/*` (in both Vite and Vitest).
- Tests are colocated as `*.test.ts(x)` next to the source; `fast-check` is available for property tests.
- UI strings go through i18n (`useScopedT` / `useI18n` from `src/contexts/I18nContext.tsx`); add keys
  to `src/i18n/locales/en/*.json` first.

## Architecture

### Processes

- **`electron/main.ts`** — app lifecycle, tray, menu, window creation (`electron/windows.ts`), `.captr`
  file-open handling, updater, local media HTTP server (`electron/mediaServer.ts`).
- **`electron/preload.ts`** — exposes `window.electronAPI` via `contextBridge`. Any new IPC channel
  needs a handler in main *and* a bridge method here.
- **`electron/ipc/`** — IPC handlers. `handlers.ts` wires up `register/*` modules (agent, assets,
  export, hyperframeExport, permissions, project, recording, settings, sources, transcription).
  Subfolders hold the implementations: `project/` (bundles, file service, rename transactions,
  workspace), `recording/`, `export/`, `ffmpeg/`, `transcription/`, `agent/` (MCP server, runners),
  `cursor/`, `hyperframe/`. Shared main-process state lives in `ipc/state.ts`.
- **`electron/native/`** — Swift (ScreenCaptureKit, cursor) and C++ helpers (`wgc-capture`,
  `windows-capture`, `gpu-export-probe`, `nvidia-cuda-compositor`, `cursor-monitor`).
- **`electron/extensions/`** — extension loader/marketplace (see `EXTENSIONS.md`).

### Renderer

A single bundle; `src/App.tsx` switches on the `?windowType=` query param: `hud-overlay`
(recorder HUD, `LaunchWindow`), `source-selector`, `countdown`, `update-toast`, and `editor`
(`components/editor/ProjectApplication.tsx`).

- **`src/core/`** — pure, framework-free domain logic and the most heavily tested code.
  - `core/timeline/` — the V3 `TimelineProject` model (`types.ts`), commands (`commands.ts`:
    `createTimelineProject`, `placeAsset`, `edit`, …; plus editing/shape/media/repurpose/design
    template command modules), `validation.ts` (`validateTimelineProject`), undo `history.ts`,
    Story ownership (`storyOwnership.ts`: `getStoryProject`, scopes `root` | `artboard`;
    `normalizeStoryOwnership.ts`), `evaluation.ts` (`evaluateProject`), keyframes/transforms,
    transitions, captions, audio plan, and the AI agent tool layer (`agentTools.ts`,
    `agentPayload.ts`, `aiIntentParser.ts`).
  - `core/project/` — legacy V1/V2 conversion and backward compat, project name rules.
- **`src/components/editor/`** — the current editor. `ProjectController` in
  `useProjectController.ts` owns the in-memory project, history, revisions, dirty state, save
  persistence, and import sessions; all edits (including AI edits) go through
  `ProjectController.execute`. `ProjectEditor.tsx` is the main shell (Story timeline, preview,
  inspector, Artboards, Hyperframes, AI command bar `Ctrl+K`, speculative diff drawer).
- **`src/recording/`** — recording package schema, completed-recording ingestion, media probing,
  silence detection, and the Record composition editor (`recording/editor/RecordingCompositionEditor.tsx`).
- **`src/lib/exporter/`** — export pipeline (`ProjectFrameRenderer`, modern video exporter, muxer,
  GIF, audio encoding/routing, backend policy for native/GPU export).
- **`src/components/video-editor/`** — older Recordly-era editor components; many pieces (playback,
  annotations, export settings, shortcuts dialog) are still reused, but `VideoEditor.tsx` is not
  the main editor.
- `src/components/repurpose/` (Artboards + tldraw whiteboard), `hyperframe/`, `settings/`,
  `launch/`, `ui/` (Radix/shadcn-style primitives, `cn` in `src/lib/utils.ts`).

### Key invariants (summary — `AGENTS.md` is authoritative)

- **`.captr` V3** is one ZIP per project. `project.json` is the authoritative index; media and
  sidecars live in `assets/<assetId>/`, Record compositions in `compositions/`, and `Story/` is a
  derived projection. Never write `slides/` or `slide.json`. Saving V3 goes through
  `electron/ipc/register/project/save.ts` (`normalizeStoryOwnership` → stage → pack), and all file
  operations are serialized through `projectFileQueue` / `performProjectFileOperation`.
- **Ownership**: global `project.assets` (video/image/audio/recording); private `localAssets` per root
  Story or Artboard (video/image/audio only); Text/Shape live inline in `clip.content` — a clip has
  exactly one of `content` or `assetId`, and no synthetic media assets are created.
- **Time** is in microseconds (`…Us`). Story time → clip-local time (`sourceInUs`/`sourceOutUs`,
  `rate`) → source/Record time map. New inline elements get a 5,000,000 µs extent.
- **Preview and export share `evaluateProject`** — never special-case one path.
- Save identity checks: Ctrl+S may only write a bundle whose `projectId` matches; Save As creates a
  new identity; autosave only runs for projects that already have a path (1.2 s idle debounce).
- Screen recordings added from an open project go to that project's Assets only (no automatic
  timeline placement) and must preserve `currentProjectPath` through the HUD and finalization.
