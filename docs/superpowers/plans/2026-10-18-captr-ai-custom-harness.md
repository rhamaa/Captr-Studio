# Captr Studio AI Custom Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a non-redundant, context-aware AI Custom Harness for Captr Studio that reads `.captr` metadata, mutates it via `ProjectController.execute`, and exposes a floating `Ctrl+K` command interface with deep surface awareness across Story, Record, Caption, and Artboard editors.

**Architecture:** A lightweight context sensor tracks active surfaces (Home, Story, Record Editor, Captions, Artboards) and syncs to a local MCP server. A background headless CLI execution pipe runs model tools that mutate `project.json` declaratively without generating synthetic media or parallel rendering. A floating `Ctrl+K` command bar and speculative ghost timeline provide instant visual preview with one-click "Accept/Discard".

**Tech Stack:** TypeScript, React, Electron IPC, Model Context Protocol (MCP), Vitest, Phosphor Icons, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-18-captr-ai-custom-harness-design.md`

## Global Constraints

- Never flatten Recording packages, synthesize dummy video/audio files, or alter media asset directories in `assets/<assetId>/`.
- All committed mutations must route through `ProjectController.execute(...)` commands to guarantee undo/redo (`Ctrl+Z`) and `.captr` V3 schema persistence integrity.
- Follow `/ponytail`: minimal working diff, reuse existing xterm/MCP/controller infrastructure, zero unnecessary abstractions.
- Maintain backward compatibility with `.captr` projects created in earlier V3 versions (`1.4.0-beta.3` and below).

## Review Focus

- MCP client calling `get_project_context` when no project is open (e.g. at Home screen) must return `{ isProjectOpen: false, activeView: "home" }` rather than throwing an error.
- Switching between Story Editor, Record Editor, Caption Editor, and Artboards must immediately update `activeSurface` in Electron and update available contextual pills.
- Speculative Ghost changes must remain purely in-memory until user clicks "Accept", and "Discard" must cleanly drop all ghost overlays without marking project dirty.
- Record Editor appearance mutations via AI must enforce outward border expansion (`frameRenderer.ts`) without encroaching on video media.
- Per-project AI settings (`aiConfig`) must cleanly serialize to `project.json` and cleanly fall back to global settings if absent.

---

### Task 1: AI Harness Types & Timeline Project Schema Extension

**Files:**
- Create: `src/core/timeline/aiTypes.ts`
- Modify: `src/core/timeline/types.ts`
- Modify: `src/core/timeline/validation.ts`
- Test: `src/core/timeline/aiTypes.test.ts`

**Interfaces:**
- Consumes: `TimelineProject` from `src/core/timeline/types.ts`
- Produces: `ActiveSurface`, `CaptrAppContext`, `GlobalAiSettings`, `ProjectAiConfig` in `src/core/timeline/aiTypes.ts`

- [ ] **Step 1: Write the failing test for AI types and project validation**

```typescript
// src/core/timeline/aiTypes.test.ts
import { describe, expect, it } from "vitest";
import { validateTimelineProject } from "./validation";
import { createTimelineProject } from "./commands";
import type { ProjectAiConfig } from "./aiTypes";

describe("aiTypes & schema validation", () => {
  it("preserves optional aiConfig in project validation", () => {
    const project = createTimelineProject("test-p1", "Test Project");
    const aiConfig: ProjectAiConfig = {
      modelOverride: "gemini-1.5-pro",
      personaPrompt: "Fast tech tutorial with 2-word captions",
      silenceThresholdMs: 700,
    };
    project.aiConfig = aiConfig;
    const validated = validateTimelineProject(project);
    expect(validated.aiConfig).toEqual(aiConfig);
  });

  it("allows projects without aiConfig for backward compatibility", () => {
    const project = createTimelineProject("legacy-p1", "Legacy");
    const validated = validateTimelineProject(project);
    expect(validated.aiConfig).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/timeline/aiTypes.test.ts`  
Expected: FAIL with module `./aiTypes` not found.

- [ ] **Step 3: Implement `src/core/timeline/aiTypes.ts` and update `types.ts` & `validation.ts`**

Define `ActiveSurface`, `CaptrAppContext`, `GlobalAiSettings`, `ProjectAiConfig`. Add optional `aiConfig?: ProjectAiConfig;` to `TimelineProject` interface in `src/core/timeline/types.ts` and pass through in `validateTimelineProject`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/timeline/aiTypes.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/timeline/aiTypes.ts src/core/timeline/types.ts src/core/timeline/validation.ts src/core/timeline/aiTypes.test.ts
git commit -m "feat(ai): define AI harness types and extend project schema with optional aiConfig"
```

---

### Task 2: Active Surface Awareness in Electron & MCP Server

**Files:**
- Modify: `electron/ipc/agent/mcpServer.ts`
- Modify: `electron/ipc/register/agent.ts`
- Modify: `electron/preload.ts`
- Test: `electron/ipc/agent/mcpServer.test.ts`

**Interfaces:**
- Consumes: `CaptrAppContext`, `ActiveSurface` from `src/core/timeline/aiTypes.ts`
- Produces: `syncActiveSurface(surface: ActiveSurface)`, updated `get_project_context` MCP tool

- [ ] **Step 1: Write the failing test for closed-project and surface-aware MCP responses**

```typescript
// in electron/ipc/agent/mcpServer.test.ts
it("returns clean context object when no project is open instead of throwing error", async () => {
  setMcpProjectContext({ project: null, editContext: null, transcripts: {} });
  const result = await executeMcpToolCall("get_project_context");
  const parsed = JSON.parse(result.text);
  expect(parsed.isProjectOpen).toBe(false);
  expect(parsed.activeView).toBe("home");
  expect(parsed.availableActions).toContain("create_project");
});

it("returns activeSurface and contextual accelerators when project is open in record-editor", async () => {
  setMcpActiveSurface({
    kind: "record-editor",
    recordingAssetId: "asset-rec-1",
    packageId: "pkg-1",
    activeTab: "appearance",
    outwardBorderWidth: 4,
  });
  const result = await executeMcpToolCall("get_project_context");
  const parsed = JSON.parse(result.text);
  expect(parsed.activeSurface.kind).toBe("record-editor");
  expect(parsed.availableAccelerators.some((a: any) => a.id === "auto-zoom-clicks")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/ipc/agent/mcpServer.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement active surface tracking and graceful closed-project MCP handler**

In `electron/ipc/agent/mcpServer.ts`:
- Add `activeSurfaceState: ActiveSurface = { kind: "none" }`.
- Export `setMcpActiveSurface(surface: ActiveSurface): void`.
- Update `executeMcpToolCall("get_project_context")` to check if `activeContext?.project` is null; if null, return formatted `{ isProjectOpen: false, activeView: "home", availableActions: [...] }`.
- When project is open, include `activeSurface` and populate `availableAccelerators` dynamically based on `activeSurface.kind`.
In `electron/ipc/register/agent.ts`: register IPC listener `agent:sync-surface`.
In `electron/preload.ts`: expose `syncActiveSurface(surface: ActiveSurface): void`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/ipc/agent/mcpServer.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/ipc/agent/mcpServer.ts electron/ipc/register/agent.ts electron/preload.ts electron/ipc/agent/mcpServer.test.ts
git commit -m "feat(ai): add surface-aware context tracking and graceful closed-project handling in MCP server"
```

---

### Task 3: Global Preferences AI & Models Tab

**Files:**
- Modify: `src/lib/appSettings.ts`
- Modify: `src/components/settings/AppSettingsDialog.tsx`
- Test: `src/components/settings/AppSettingsDialog.test.tsx`

**Interfaces:**
- Consumes: `GlobalAiSettings` from `src/core/timeline/aiTypes.ts`
- Produces: `getGlobalAiSettings()`, `saveGlobalAiSettings()`, AI & Models settings UI tab

- [ ] **Step 1: Write the failing test for AI settings storage and dialog rendering**

```typescript
// in src/components/settings/AppSettingsDialog.test.tsx
it("renders AI & Models tab with runner and model selections", async () => {
  renderWithProviders(<AppSettingsDialog open={true} onOpenChange={() => {}} defaultTab="ai" />);
  expect(screen.getByText(/AI Harness & Models/i)).toBeInTheDocument();
  expect(screen.getByText(/Preferred CLI Runner/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/settings/AppSettingsDialog.test.tsx`  
Expected: FAIL (tab "ai" not present).

- [ ] **Step 3: Implement AI settings tab in `AppSettingsDialog.tsx` and storage in `appSettings.ts`**

In `src/lib/appSettings.ts`: add `getGlobalAiSettings()` and `setGlobalAiSettings(settings: Partial<GlobalAiSettings>)` with defaults (`preferredRunner: "agy"`, `defaultModel: "gemini-1.5-pro"`, `mcpServerPort: 4040`, `enableGhostPreview: true`).
In `src/components/settings/AppSettingsDialog.tsx`: add `<TabsTrigger value="ai">` with `Cpu` or `Sparkle` icon, rendering form controls for runner selection (`agy`, `opencode`, `hermes`, `cursor`, `custom`), model name input, and port configuration.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/settings/AppSettingsDialog.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/appSettings.ts src/components/settings/AppSettingsDialog.tsx src/components/settings/AppSettingsDialog.test.tsx
git commit -m "feat(settings): add AI Harness & Models configuration tab in global preferences"
```

---

### Task 4: Surface-Specific Metadata Mutation Tools (Record & Caption Editors)

**Files:**
- Modify: `src/core/timeline/agentTools.ts`
- Modify: `electron/ipc/agent/mcpServer.ts`
- Test: `src/core/timeline/agentTools.test.ts`

**Interfaces:**
- Consumes: `TimelineProject`, `RecordingFrameAppearance`
- Produces: `applySetFrameAppearance`, `applyAppearancePreset`, `applyAutoZoomToClicks` in `agentTools.ts`

- [ ] **Step 1: Write failing tests for Record Editor metadata mutation tools**

```typescript
// in src/core/timeline/agentTools.test.ts
it("applies frame appearance preset to project composition without modifying media files", () => {
  const project = createProjectWithRecordingComposition();
  const updated = applyAppearancePreset(project, "composition-1", "brutalism");
  const comp = updated.compositions.find(c => c.id === "composition-1");
  expect(comp?.settings.windowAppearance?.borderWidth).toBe(4);
  expect(comp?.settings.windowAppearance?.borderColor).toBe("#000000");
});

it("generates auto-zoom keyframes from cursor clicks metadata", () => {
  const project = createProjectWithRecordingComposition();
  const clickTimestampsUs = [1_000_000, 3_000_000];
  const updated = applyAutoZoomToClicks(project, "clip-1", clickTimestampsUs, { scale: 1.5 });
  const clip = updated.tracks[0].clips.find(c => c.id === "clip-1");
  expect(clip?.keyframes?.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/timeline/agentTools.test.ts`  
Expected: FAIL (`applyAppearancePreset` not defined).

- [ ] **Step 3: Implement metadata mutation tools in `agentTools.ts` and register in `mcpServer.ts`**

Implement:
- `applySetFrameAppearance(project, compositionId, target, appearancePatch)`
- `applyAppearancePreset(project, compositionId, presetName)`
- `applyAutoZoomToClicks(project, clipId, clickTimestampsUs, options)`
Register new MCP tools in `mcpServer.ts`: `set_frame_appearance`, `apply_appearance_preset`, `auto_zoom_to_clicks`.
Ensure all functions are pure metadata transforms returning `{ project: TimelineProject }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/timeline/agentTools.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/timeline/agentTools.ts electron/ipc/agent/mcpServer.ts src/core/timeline/agentTools.test.ts
git commit -m "feat(ai): implement Record Editor metadata mutation tools and register in MCP server"
```

---

### Task 5: Floating Command Bar (`Ctrl+K`) & Speculative Preview UI

**Files:**
- Create: `src/components/editor/AiCommandBar.tsx`
- Create: `src/components/editor/AiSpeculativeDrawer.tsx`
- Modify: `src/components/editor/ProjectEditor.tsx`
- Modify: `src/core/featureFlags.ts`
- Test: `src/components/editor/AiCommandBar.test.tsx`

**Interfaces:**
- Consumes: `CaptrAppContext`, `AgentDiffSummary`, `ProjectController`
- Produces: `<AiCommandBar />` and `<AiSpeculativeDrawer />` integrated in `ProjectEditor`

- [ ] **Step 1: Write the failing test for `AiCommandBar` shortcut and contextual pills**

```typescript
// src/components/editor/AiCommandBar.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiCommandBar } from "./AiCommandBar";

describe("AiCommandBar", () => {
  it("renders contextual action pills matching active surface", () => {
    const onAction = vi.fn();
    render(
      <AiCommandBar
        open={true}
        onClose={() => {}}
        activeSurface={{
          kind: "record-editor",
          recordingAssetId: "a1",
          packageId: "p1",
          activeTab: "appearance",
          outwardBorderWidth: 2,
        }}
        onExecuteAction={onAction}
      />
    );
    expect(screen.getByText(/Auto-Zoom to Clicks/i)).toBeInTheDocument();
    expect(screen.getByText(/Style: Brutalism/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Auto-Zoom to Clicks/i));
    expect(onAction).toHaveBeenCalledWith("auto_zoom_to_clicks");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editor/AiCommandBar.test.tsx`  
Expected: FAIL (module `./AiCommandBar` not found).

- [ ] **Step 3: Implement `AiCommandBar`, `AiSpeculativeDrawer`, and wire into `ProjectEditor`**

In `src/components/editor/AiCommandBar.tsx`:
- Modal spotlight bar with backdrop blur, text prompt input, and horizontal scrollable contextual action pills based on `activeSurface`.
- Keyboard navigation (`↑`/`↓` for pills, `Enter` to run, `Esc` to close).
In `src/components/editor/AiSpeculativeDrawer.tsx`:
- Compact floating toast/drawer showing diff stats (`clipsAdded`, `durationDelta`, etc.) with `Accept (Enter)` and `Discard (Esc)` buttons.
In `src/components/editor/ProjectEditor.tsx`:
- Add `useHotkeys` / `keydown` listener for `Ctrl+K` / `Cmd+K` toggling command bar.
- Sync active surface via `window.electronAPI.syncActiveSurface(...)` whenever editing tabs/clips/artboards change.
- Connect "Accept" to `controller.execute(...)` and "Discard" to clearing speculative draft.
In `src/core/featureFlags.ts`: set `FEATURE_AI_ENABLED = true`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editor/AiCommandBar.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/AiCommandBar.tsx src/components/editor/AiSpeculativeDrawer.tsx src/components/editor/ProjectEditor.tsx src/core/featureFlags.ts src/components/editor/AiCommandBar.test.tsx
git commit -m "feat(editor): integrate floating Ctrl+K command bar and speculative ghost drawer"
```

---

### Task 6: End-to-End Verification, Typecheck & Regression Check

**Files:**
- Test: `src/components/editor/ProjectEditor.test.tsx`
- Test: `electron/ipc/agent/mcpServer.test.ts`
- Documentation: `ISSUE.md`

- [ ] **Step 1: Run comprehensive test suite**

Run: `npm test`  
Expected: All tests pass 100%.

- [ ] **Step 2: Run TypeScript compile verification**

Run: `npx tsc --noEmit`  
Expected: Exit code 0 without any type errors.

- [ ] **Step 3: Re-index graft context graph**

Run: `npx graft build`  
Expected: Graph rebuilt with all new nodes and edges connected.

- [ ] **Step 4: Commit and finalize**

```bash
git add .
git commit -m "chore(ai): verify end-to-end AI custom harness and context synchronization"
```
