# Hyperframe Full Editor & Asset Tagging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Hyperframe editing from a cramped slide-over drawer into a full-screen sub-editor (matching the Story Editor UX) with an expansive center preview, dedicated transport controls, collapsible side panel, and `@` asset mention autocomplete in the agent prompt.

**Architecture:**
- **Full-Screen Sub-Editor (`HyperframeEditor.tsx`):** Replaces the drawer with a full workspace view integrated into `ProjectEditor.tsx` via `activeHyperframeId`. Features an expansive center stage with dedicated prominent playback transport controls (Play/Pause, Scrubber, Timecode, Reload) and a collapsible right sidebar for CLI Agent & Source Code.
- **`@` Asset Mention Autocomplete:** An interactive dropdown inside the agent prompt textarea triggered by typing `@`, allowing users to tag project media assets (video, image, audio).
- **Tagged Asset Context Injection:** Tagged assets are passed to `hyperframeAgentRunner.ts`, prioritized in `PROJECT_ASSETS.json` and highlighted under a dedicated `## PRIORITY TAGGED MEDIA` section in `TASK.md` so the CLI agent embeds and animates them.
- **Repurpose Canvas & Project Navigation:** Clicking a Hyperframe card in `RepurposeBoardEditor` invokes `onOpenHyperframeEditor(hfId)` to transition seamlessly from the Artboard Hub into the full Hyperframe Editor, with Back/Esc returning to the hub.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Phosphor Icons, Electron IPC (`child_process`), Vitest.

---

### Task 1: Tagged Asset Context Injection in Agent Runner

**Files:**
- Modify: `electron/ipc/agent/hyperframeAgentRunner.ts`
- Modify: `electron/ipc/agent/hyperframeAgentRunner.test.ts`
- Modify: `electron/electron-env.d.ts`

**Step 1: Write the failing test**
In `electron/ipc/agent/hyperframeAgentRunner.test.ts`, test that `formatHyperframeTaskPrompt` includes priority tagged media when assets are tagged:
```ts
it("formats task prompt with tagged media priority section when taggedAssets are provided", () => {
    const prompt = formatHyperframeTaskPrompt({
        userPrompt: "Animate @logo.png and bounce it",
        hyperframeName: "Intro",
        width: 1920,
        height: 1080,
        durationSec: 5,
        assetsSummary: "logo.png (image, id: a1)",
        draftFilePath: "index.html",
        taggedAssets: [
            { id: "a1", name: "logo.png", kind: "image", path: "/path/to/logo.png" },
        ],
    });

    expect(prompt).toContain("PRIORITY TAGGED MEDIA");
    expect(prompt).toContain("@logo.png");
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run electron/ipc/agent/hyperframeAgentRunner.test.ts`
Expected: FAIL

**Step 3: Implement minimal code**
Update `HyperframeTaskContext` and `formatHyperframeTaskPrompt` in `electron/ipc/agent/hyperframeAgentRunner.ts` to include `taggedAssets` and generate the `PRIORITY TAGGED MEDIA` section.

**Step 4: Run test to verify it passes**
Run: `npx vitest run electron/ipc/agent/hyperframeAgentRunner.test.ts`
Expected: PASS

---

### Task 2: Build `@` Asset Autocomplete Prompt Input Component

**Files:**
- Create: `src/components/hyperframe/HyperframePromptInput.tsx`
- Create: `src/components/hyperframe/HyperframePromptInput.test.tsx`

**Step 1: Write the failing test**
In `src/components/hyperframe/HyperframePromptInput.test.tsx`, test that typing `@` opens asset suggestion list, selecting an asset inserts `@asset-name`, and tagged assets are emitted via callback.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/hyperframe/HyperframePromptInput.test.tsx`
Expected: FAIL

**Step 3: Implement minimal code**
Implement `HyperframePromptInput.tsx`:
- Textarea with cursor detection for `@`.
- Filterable dropdown of `project.assets` with keyboard navigation (Up, Down, Enter, Tab, Escape).
- Insertion of `@assetName` at cursor position.
- Chip tags displaying currently tagged assets with remove buttons.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/hyperframe/HyperframePromptInput.test.tsx`
Expected: PASS

---

### Task 3: Build `HyperframeEditor.tsx` (Full Editor View)

**Files:**
- Create: `src/components/hyperframe/HyperframeEditor.tsx`
- Create: `src/components/hyperframe/HyperframeEditor.test.tsx`

**Step 1: Write the failing test**
In `src/components/hyperframe/HyperframeEditor.test.tsx`:
Test that `HyperframeEditor` renders full-screen sub-editor header, large center canvas preview, dedicated transport controls (Play/Pause, scrubber, reload), collapsible right sidebar (CLI Agent & Source Code), and Back/Esc handling.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/hyperframe/HyperframeEditor.test.tsx`
Expected: FAIL

**Step 3: Implement minimal code**
Implement `HyperframeEditor.tsx`:
- Header: Back button (`<ArrowLeft />`, `Esc`), title rename, aspect ratio & dimension badges, sidebar toggle.
- Expansive Stage: Large center viewport with sandboxed iframe, responsive scaling.
- Dedicated Transport Bar: Large Play/Pause button, Restart button, Timecode readout (`0.00s / 5.00s`), full-width range scrubber, loop toggle.
- Right Sidebar:
  - Tab 1 (CLI Agent): Agent runner selector, `HyperframePromptInput` with `@` mention autocomplete, inspiration preset buttons, Run/Cancel buttons, streaming log terminal.
  - Tab 2 (Source Code): Direct HTML source textarea with Apply (hot-reload) and Copy buttons.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/hyperframe/HyperframeEditor.test.tsx`
Expected: PASS

---

### Task 4: Connect `HyperframeEditor` in `RepurposeBoardEditor` & `ProjectEditor`

**Files:**
- Modify: `src/components/repurpose/RepurposeBoardEditor.tsx`
- Modify: `src/components/repurpose/RepurposeBoardEditor.test.tsx`
- Modify: `src/components/editor/ProjectEditor.tsx`

**Step 1: Write failing test / update tests**
In `RepurposeBoardEditor.test.tsx`, test `onOpenHyperframeEditor` callback when clicking "Open Code & Agent" on a Hyperframe card.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/repurpose/RepurposeBoardEditor.test.tsx`
Expected: FAIL

**Step 3: Implement minimal code**
- In `RepurposeBoardEditor.tsx`, expose `onOpenHyperframeEditor?: (hyperframeId: string) => void`.
- In `ProjectEditor.tsx`, introduce `activeHyperframeId: string | null`. When set, render `HyperframeEditor` instead of `RepurposeBoardEditor`, matching the Story Editor navigation pattern (`activeArtboardId`).

**Step 4: Run tests to verify they pass**
Run: `npx vitest run src/components/repurpose/RepurposeBoardEditor.test.tsx`
Expected: PASS

---

### Task 5: Verification, Context Graph & Commit

**Files:**
- Run: `npx vitest run` across all test suites
- Run: `npx tsc --noEmit`
- Run: `graft build`
- Git commit: `feat(hyperframe): full-screen editor with transport bar and @-asset tagging`
