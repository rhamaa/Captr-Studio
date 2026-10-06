# Unified Artboard Hyperframe & Pluggable CLI Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify Hyperframe compositions directly onto the main Repurpose Artboard canvas as interactive visual cards alongside Story cards, eliminating separate tabs, and provide a slide-over drawer editor featuring live preview, code editing, and an open pluggable CLI Agent prompt bar (`agy`, `claude`, `codex`, `opencode`, `kiro`, `trae`, `cline`, `hermes`, `custom`).

**Architecture:**
- **Pluggable CLI Agent Service (Electron IPC):** Expands `electron/ipc/agent/agentDetector.ts` and `agentRunner.ts` to support an open registry of CLI agent binaries (`agy`, `claude`, `codex`, `opencode`, `kiro`, `trae`, `cline`, `hermes`, and user-defined custom binaries). Adds `runHyperframeAgentTask` which builds an isolated workspace containing current `index.html`, `PROJECT_ASSETS.json` (real local paths, durations, transcripts), and executes the agent process with full context injection.
- **Unified Artboard Canvas (`RepurposeBoardEditor.tsx`):** Removes the separate "Hyperframes" full-page tab. In the main canvas toolbar, adds a "+ Hyperframe" creation action with aspect ratio preset selection (16:9, 9:16, 1:1, etc.). Renders `HyperframeCard` instances alongside `RepurposeArtboardCard` on the same infinite pannable/zoomable canvas.
- **Slide-over Drawer Editor (`HyperframeEditorDrawer.tsx`):** A slide-over panel accessible from any Hyperframe card containing a 60 FPS live sandboxed preview, code editor, and an Agent Prompt Bar with agent status detection, context preview chips, prompt submission, execution logs, and live code updating.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Phosphor Icons, Electron IPC (`child_process`), yauzl/zip bundling, Vitest.

---

### Task 1: Pluggable CLI Agent Registry Expansion & IPC Detection

**Files:**
- Modify: `electron/ipc/agent/agentDetector.ts`
- Modify: `electron/ipc/agent/agentDetector.test.ts`
- Modify: `electron/electron-env.d.ts`
- Modify: `electron/preload.ts`

**Step 1: Write the failing test**
In `electron/ipc/agent/agentDetector.test.ts`, add tests verifying detection of the expanded list of agents (`kiro`, `trae`, `cline`, `hermes`) as well as custom user-defined command checks:
```ts
it("includes kiro, trae, cline, and hermes in known agents list", () => {
	const ids = KNOWN_AGENTS.map((a) => a.id);
	expect(ids).toContain("kiro");
	expect(ids).toContain("trae");
	expect(ids).toContain("cline");
	expect(ids).toContain("hermes");
});

it("supports checking custom CLI agent command availability", async () => {
	const customCheck = await checkAgentAvailability("non-existent-agent-binary-12345");
	expect(customCheck).toBeNull();
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run electron/ipc/agent/agentDetector.test.ts`
Expected: FAIL (missing `kiro`, `trae`, etc. in KNOWN_AGENTS)

**Step 3: Implement minimal code**
Update `KNOWN_AGENTS` in `electron/ipc/agent/agentDetector.ts` to include:
- `kiro` (Kiro CLI)
- `trae` (Trae CLI)
- `cline` (Cline CLI)
- `hermes` (Hermes Agent)
Expose IPC handler `detect-agents` and `check-custom-agent` in `electron/ipc/handlers.ts` and `preload.ts`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run electron/ipc/agent/agentDetector.test.ts`
Expected: PASS

---

### Task 2: Hyperframe Agent Task Runner with Full Project Context

**Files:**
- Create/Modify: `electron/ipc/agent/hyperframeAgentRunner.ts`
- Create: `electron/ipc/agent/hyperframeAgentRunner.test.ts`
- Modify: `electron/ipc/handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/electron-env.d.ts`

**Step 1: Write the failing test**
In `electron/ipc/agent/hyperframeAgentRunner.test.ts`:
Test that context assembly formats `PROJECT_ASSETS.json`, current `index.html`, and instructions prompt correctly, and handles agent output parsing.

**Step 2: Run test to verify it fails**
Run: `npx vitest run electron/ipc/agent/hyperframeAgentRunner.test.ts`
Expected: FAIL (runner module not found)

**Step 3: Implement minimal code**
Implement `runHyperframeAgentTask`:
- Creates temp directory.
- Writes current `index.html`.
- Writes `PROJECT_ASSETS.json` detailing media assets (paths, types, dimensions, durations, transcripts).
- Executes chosen CLI agent with `-p` or stdin.
- Reads back modified `index.html` or captured stdout.
- Cleans up temp directory safely.
Expose `window.electronAPI.runHyperframeAgentTask` via IPC.

**Step 4: Run test to verify it passes**
Run: `npx vitest run electron/ipc/agent/hyperframeAgentRunner.test.ts`
Expected: PASS

---

### Task 3: HyperframeCard Component for the Unified Artboard

**Files:**
- Create: `src/components/repurpose/HyperframeCard.tsx`
- Create: `src/components/repurpose/HyperframeCard.test.tsx`
- Modify: `src/core/story/storyTypes.ts` (ensure `aspectRatio` property exists on `HyperframeComposition`)

**Step 1: Write the failing test**
In `src/components/repurpose/HyperframeCard.test.tsx`:
Test rendering card with title, aspect ratio badge (`16:9`), duration, sandboxed iframe preview, and action callbacks (`onOpenEditor`, `onRename`, `onDuplicate`, `onDelete`).

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/repurpose/HyperframeCard.test.tsx`
Expected: FAIL (`HyperframeCard` not found)

**Step 3: Implement minimal code**
Implement `HyperframeCard.tsx`:
- Glassmorphic card matching `RepurposeArtboardCard` styling.
- Lavender `#A879F5` `HYPERFRAME` tag.
- Sandboxed iframe live preview with 16:9/9:16/1:1 aspect containment.
- Header with title, aspect ratio, duration, and action buttons (`Open Code & Agent`, `Duplicate`, `Delete`).
- Drag handle for repositioning on the canvas.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/repurpose/HyperframeCard.test.tsx`
Expected: PASS

---

### Task 4: Slide-over Drawer Editor (`HyperframeEditorDrawer.tsx`)

**Files:**
- Create: `src/components/repurpose/HyperframeEditorDrawer.tsx`
- Create: `src/components/repurpose/HyperframeEditorDrawer.test.tsx`

**Step 1: Write the failing test**
In `src/components/repurpose/HyperframeEditorDrawer.test.tsx`:
Test drawer opens with live preview, code editor, agent prompt bar with agent selector, and dispatches prompt events.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/repurpose/HyperframeEditorDrawer.test.tsx`
Expected: FAIL (`HyperframeEditorDrawer` not found)

**Step 3: Implement minimal code**
Implement `HyperframeEditorDrawer.tsx`:
- Header: title, aspect ratio, resolution, duration slider, close button.
- Center: Live interactive preview with scrubber, play/pause, restart.
- Side tabs:
  - **AI Agent Prompt**: Agent dropdown (with detection status), context summary badges (assets count, resolution, speech transcripts), prompt textarea, "Generate / Refine" button, execution status/logs.
  - **Source Code**: Direct HTML/CSS/JS editing with instant hot reload.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/repurpose/HyperframeEditorDrawer.test.tsx`
Expected: PASS

---

### Task 5: Unify Artboard in `RepurposeBoardEditor.tsx`

**Files:**
- Modify: `src/components/repurpose/RepurposeBoardEditor.tsx`
- Modify: `src/components/repurpose/RepurposeBoardEditor.test.tsx`

**Step 1: Write the failing test**
In `src/components/repurpose/RepurposeBoardEditor.test.tsx`:
Verify that `RepurposeBoardEditor` renders both Story cards and Hyperframe cards on the same canvas stage, has the "+ Hyperframe" button, and opens `HyperframeEditorDrawer` without switching to a separate page tab.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/repurpose/RepurposeBoardEditor.test.tsx`
Expected: FAIL (assertion for unified cards or + Hyperframe button fails)

**Step 3: Implement minimal code**
In `RepurposeBoardEditor.tsx`:
- Remove `activeTab === "hyperframes"` full-page branch.
- Add "+ Hyperframe" button in top bar with preset aspect ratio dropdown (16:9, 9:16, 1:1, custom).
- In the `.repurpose-artboards-grid`, map over both `board.artboards` and `project.hyperframes ?? []` rendering `HyperframeCard`.
- Integrate `HyperframeEditorDrawer` slide-over modal when `editingHyperframeId` is selected.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/repurpose/RepurposeBoardEditor.test.tsx`
Expected: PASS

---

### Task 6: Full Verification, Documentation & Commit

**Files:**
- Run: `npx vitest run` across all touched test suites.
- Run: `npx tsc --noEmit`
- Run: `npx graft build`
- Git commit: `feat(hyperframe): unify hyperframe cards on artboard canvas with pluggable CLI agent drawer`
