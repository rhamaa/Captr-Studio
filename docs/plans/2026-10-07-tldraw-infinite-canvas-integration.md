# Tldraw Infinite Canvas Whiteboard Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Integrate the tldraw SDK (`@tldraw/tldraw`) into Captr Studio's Repurpose hub as an infinite whiteboard canvas, enabling freeform brainstorming (notes, arrows, shapes, sketches) alongside live interactive video artboard (Story) and Hyperframe cards, while persisting all canvas state inside the authoritative `.captr` V3 bundle.

**Architecture:** Replace the custom pan/zoom and card drag loops in `RepurposeBoardEditor.tsx` with a tailored `<Tldraw />` canvas. Artboard and Hyperframe cards are rendered as custom tldraw shapes (`ShapeUtil`) with isolated pointer controls for video playback and framing. Canvas layout and freeform annotations are serialized into `TimelineProject.whiteboardSnapshot` in `project.json`, preserving backward compatibility and FFmpeg export independence.

**Tech Stack:** `@tldraw/tldraw`, React 18, TypeScript, Vite, Vitest.

**Spec:** Brainstorming session confirmed on 2026-10-07 (Option 1: Primary whiteboard replacement with hybrid persistence, custom video shapes, offline assets, and single-audio decode guardrail).

## Global Constraints

- `project.json` in `.captr` V3 remains authoritative for all media assets, recording packages, artboard tracks, framing, and compositions. Brainstorming tldraw shapes must not alter or break video export pipelines.
- Tldraw assets (icons, fonts, CSS) must be fully bundled and available offline without unpkg or remote CDN network dependencies.
- Zero regression on existing project save, autosave, and Save As flows per `AGENTS.md` regression checklist.
- Single active playback guardrail: only one artboard/hyperframe card plays video/audio decode at a time (`activePlayingId`).
- UI styling must integrate smoothly with Captr Studio's dark slate palette (`#15171C`, `#1C1F26`) and soft pastel accents (`#6FA8FF`, `#A879F5`).

## Review Focus

1. **Empty / Fresh Project (No Prior Snapshot):** Opening a project without `whiteboardSnapshot` automatically places existing artboards and hyperframes in a clean grid layout on the whiteboard without error.
2. **Offline / Air-Gapped Network Isolation:** Tldraw canvas initializes properly and renders all icons and tools when no internet connection is present.
3. **Card Deletion or Addition Synchronization:** Adding or removing an artboard/hyperframe synchronously updates both `project.repurposeBoard`/`project.hyperframes` and the corresponding tldraw shapes on the canvas.
4. **Pointer Event Isolation:** Scrubbing the video timecode, adjusting framing, or toggling Play/Pause inside a video card never triggers tldraw selection boxes or unintended canvas panning.
5. **V3 Backward Compatibility & Persistence Round-trip:** Saving a `.captr` file with `whiteboardSnapshot` preserves all shapes, arrows, and notes, and reopening the project restores the exact whiteboard state while passing `validateTimelineProject`.

---

### Task 1: Install `@tldraw/tldraw` and Configure Offline Assets & Theming

**Files:**
- Modify: `package.json`
- Create: `src/components/repurpose/whiteboard/tldrawAssets.ts`
- Create: `src/components/repurpose/whiteboard/whiteboardTheme.css`
- Test: `src/components/repurpose/whiteboard/tldrawAssets.test.ts`

**Interfaces:**
- Consumes: `@tldraw/tldraw`
- Produces: `getTldrawOfflineAssetUrls(): Record<string, string>`, theme overrides for `.tldraw__editor`

- [x] **Step 1: Write the failing test for offline asset resolver**

```typescript
// src/components/repurpose/whiteboard/tldrawAssets.test.ts
import { describe, it, expect } from "vitest";
import { getTldrawOfflineAssetUrls } from "./tldrawAssets";

describe("tldrawAssets", () => {
  it("returns local offline asset URLs without unpkg or remote CDN references", () => {
    const urls = getTldrawOfflineAssetUrls();
    expect(urls).toBeDefined();
    for (const [key, value] of Object.entries(urls)) {
      if (typeof value === "string") {
        expect(value).not.toContain("unpkg.com");
        expect(value).not.toContain("cdn.jsdelivr.net");
      }
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/repurpose/whiteboard/tldrawAssets.test.ts`
Expected: FAIL (module not found).

- [x] **Step 3: Install `@tldraw/tldraw` and implement `tldrawAssets.ts` & `whiteboardTheme.css`**

Install dependency:
```bash
npm i --legacy-peer-deps @tldraw/tldraw
```
Implement `getTldrawOfflineAssetUrls` in `src/components/repurpose/whiteboard/tldrawAssets.ts` providing local asset paths.
Create `src/components/repurpose/whiteboard/whiteboardTheme.css` defining dark theme CSS variables matching Captr Studio palette (`--color-panel: #15171C`, `--color-muted-panel: #1C1F26`, `--color-accent: #6FA8FF`, `--color-selected: #A879F5`).

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/repurpose/whiteboard/tldrawAssets.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/repurpose/whiteboard/tldrawAssets.ts src/components/repurpose/whiteboard/whiteboardTheme.css src/components/repurpose/whiteboard/tldrawAssets.test.ts
git commit -m "feat(whiteboard): install tldraw and setup offline assets with studio dark theme"
```

---

### Task 2: Project Schema Extension & Validation for Whiteboard Snapshot

**Files:**
- Modify: `src/core/timeline/types.ts:120-131`
- Modify: `src/core/timeline/validation.ts:580-618`
- Modify: `src/core/timeline/repurposeCommands.ts:44-55`
- Test: `src/core/timeline/whiteboardSnapshot.test.ts`

**Interfaces:**
- Consumes: `TimelineProject`
- Produces: `TimelineProject.whiteboardSnapshot?: Record<string, unknown>`, updated `validateTimelineProject`, and `setWhiteboardSnapshot(project: TimelineProject, snapshot: Record<string, unknown>): TimelineProject`

- [x] **Step 1: Write the failing test for whiteboard snapshot validation**

```typescript
// src/core/timeline/whiteboardSnapshot.test.ts
import { describe, it, expect } from "vitest";
import { createTimelineProject } from "./commands";
import { validateTimelineProject } from "./validation";
import { setWhiteboardSnapshot } from "./repurposeCommands";

describe("Whiteboard Snapshot Persistence", () => {
  it("validates project with or without whiteboardSnapshot", () => {
    const project = createTimelineProject("proj-1", "My Project");
    expect(() => validateTimelineProject(project)).not.toThrow();

    const snapshot = {
      schema: { schemaVersion: 2 },
      store: { "shape:1": { id: "shape:1", type: "note" } },
    };
    const updated = setWhiteboardSnapshot(project, snapshot);
    expect(updated.whiteboardSnapshot).toEqual(snapshot);

    const validated = validateTimelineProject(updated);
    expect(validated.whiteboardSnapshot).toEqual(snapshot);
  });

  it("rejects non-object whiteboardSnapshot", () => {
    const project = createTimelineProject("proj-1", "My Project");
    const invalid = { ...project, whiteboardSnapshot: "not-an-object" };
    expect(() => validateTimelineProject(invalid)).toThrow("Invalid whiteboard snapshot");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/timeline/whiteboardSnapshot.test.ts`
Expected: FAIL (functions/properties missing).

- [x] **Step 3: Implement schema extension, validation, and command helper**

1. In `src/core/timeline/types.ts`:
   Add `whiteboardSnapshot?: Record<string, unknown>;` to `TimelineProject`.
2. In `src/core/timeline/validation.ts`:
   Add validation check:
   ```typescript
   if (p.whiteboardSnapshot !== undefined) {
     requireValue(object(p.whiteboardSnapshot), "Invalid whiteboard snapshot: must be an object");
   }
   ```
3. In `src/core/timeline/repurposeCommands.ts`:
   Add:
   ```typescript
   export function setWhiteboardSnapshot(
     project: TimelineProject,
     snapshot: Record<string, unknown>,
   ): TimelineProject {
     return {
       ...project,
       whiteboardSnapshot: snapshot,
       updatedAt: new Date().toISOString(),
     };
   }
   ```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/timeline/whiteboardSnapshot.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/timeline/types.ts src/core/timeline/validation.ts src/core/timeline/repurposeCommands.ts src/core/timeline/whiteboardSnapshot.test.ts
git commit -m "feat(timeline): add whiteboardSnapshot to TimelineProject schema and validation"
```

---

### Task 3: Custom Tldraw Shape Definitions for Artboard Cards & Hyperframe Cards

**Files:**
- Create: `src/components/repurpose/whiteboard/shapes/ArtboardCardShapeUtil.tsx`
- Create: `src/components/repurpose/whiteboard/shapes/HyperframeCardShapeUtil.tsx`
- Create: `src/components/repurpose/whiteboard/shapes/customShapes.ts`
- Test: `src/components/repurpose/whiteboard/shapes/customShapes.test.ts`

**Interfaces:**
- Consumes: `RepurposeArtboardCard`, `HyperframeCard`, `@tldraw/tldraw`
- Produces: `ArtboardCardShapeUtil`, `HyperframeCardShapeUtil`, `customShapeUtils`, shape record factories (`createArtboardCardShape`, `createHyperframeCardShape`)

- [x] **Step 1: Write the failing test for custom shape utilities**

```typescript
// src/components/repurpose/whiteboard/shapes/customShapes.test.ts
import { describe, it, expect } from "vitest";
import {
  customShapeUtils,
  ARTBOARD_CARD_SHAPE_TYPE,
  HYPERFRAME_CARD_SHAPE_TYPE,
  createArtboardShapeProps,
  createHyperframeShapeProps,
} from "./customShapes";

describe("Custom Tldraw Shapes", () => {
  it("registers artboard-card and hyperframe-card shape utils", () => {
    expect(customShapeUtils.length).toBeGreaterThanOrEqual(2);
    const types = customShapeUtils.map((util) => util.type);
    expect(types).toContain(ARTBOARD_CARD_SHAPE_TYPE);
    expect(types).toContain(HYPERFRAME_CARD_SHAPE_TYPE);
  });

  it("creates valid default shape props with calculated dimensions", () => {
    const artboardProps = createArtboardShapeProps("ab-1", 1080, 1920, 360);
    expect(artboardProps.artboardId).toBe("ab-1");
    expect(artboardProps.w).toBe(Math.round(360 * (1080 / 1920)));
    expect(artboardProps.h).toBe(360 + 88);

    const hyperframeProps = createHyperframeShapeProps("hf-1", 1920, 1080, 360);
    expect(hyperframeProps.hyperframeId).toBe("hf-1");
    expect(hyperframeProps.w).toBe(Math.round(360 * (1920 / 1080)));
    expect(hyperframeProps.h).toBe(360 + 88);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/repurpose/whiteboard/shapes/customShapes.test.ts`
Expected: FAIL (modules not found).

- [x] **Step 3: Implement custom shape utilities and factories**

1. In `src/components/repurpose/whiteboard/shapes/customShapes.ts`:
   Define constants `ARTBOARD_CARD_SHAPE_TYPE = "artboard-card"`, `HYPERFRAME_CARD_SHAPE_TYPE = "hyperframe-card"`.
   Define prop helper functions `createArtboardShapeProps` and `createHyperframeShapeProps`.
2. In `src/components/repurpose/whiteboard/shapes/ArtboardCardShapeUtil.tsx`:
   Implement `ArtboardCardShapeUtil` extending `BaseBoxShapeUtil`.
   In `getDefaultProps()` return `{ artboardId: "", w: 202, h: 448 }`.
   In `component(shape)` render `<HTMLContainer>` holding `RepurposeArtboardCard` with contextual callbacks. Ensure interactive buttons have `pointerEvents: "all"` and stop propagation so tldraw drag handles only trigger on the card header/border.
3. In `src/components/repurpose/whiteboard/shapes/HyperframeCardShapeUtil.tsx`:
   Implement `HyperframeCardShapeUtil` extending `BaseBoxShapeUtil`.
   In `component(shape)` render `<HTMLContainer>` holding `HyperframeCard`.
4. Export `customShapeUtils = [ArtboardCardShapeUtil, HyperframeCardShapeUtil]`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/repurpose/whiteboard/shapes/customShapes.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/repurpose/whiteboard/shapes/
git commit -m "feat(whiteboard): implement ArtboardCardShapeUtil and HyperframeCardShapeUtil for tldraw"
```

---

### Task 4: Implement `RepurposeWhiteboardCanvas` & Synchronize Project State

**Files:**
- Create: `src/components/repurpose/whiteboard/whiteboardSync.ts`
- Create: `src/components/repurpose/whiteboard/RepurposeWhiteboardCanvas.tsx`
- Modify: `src/components/repurpose/RepurposeBoardEditor.tsx`
- Test: `src/components/repurpose/whiteboard/whiteboardSync.test.ts`

**Interfaces:**
- Consumes: `customShapeUtils`, `TimelineProject`, `onChange`, `activePlayingId`, `tldrawAssets`
- Produces: `<RepurposeWhiteboardCanvas />` replacing custom pan/zoom canvas in `RepurposeBoardEditor.tsx`

- [x] **Step 1: Write the failing test for whiteboard sync logic**

```typescript
// src/components/repurpose/whiteboard/whiteboardSync.test.ts
import { describe, it, expect } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { ensureRepurposeBoard } from "@/core/timeline/repurposeCommands";
import { calculateInitialCardPositions, reconcileProjectCardsWithStore } from "./whiteboardSync";

describe("whiteboardSync", () => {
  it("calculates clean grid layout coordinates for cards when no snapshot exists", () => {
    const project = ensureRepurposeBoard(createTimelineProject("proj-1", "Test"));
    const artboardIds = project.repurposeBoard!.artboards.map((a) => a.id);
    const positions = calculateInitialCardPositions(artboardIds, []);
    expect(positions.size).toBe(artboardIds.length);
    for (const [id, pos] of positions.entries()) {
      expect(pos.x).toBeGreaterThanOrEqual(100);
      expect(pos.y).toBeGreaterThanOrEqual(100);
    }
  });

  it("detects missing cards in store and generates additions", () => {
    const existingShapeIds = new Set(["shape:artboard-card-1"]);
    const targetArtboardIds = ["artboard-card-1", "artboard-card-2"];
    const missing = reconcileProjectCardsWithStore(targetArtboardIds, existingShapeIds);
    expect(missing).toEqual(["artboard-card-2"]);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/repurpose/whiteboard/whiteboardSync.test.ts`
Expected: FAIL (modules not found).

- [x] **Step 3: Implement `whiteboardSync.ts`, `RepurposeWhiteboardCanvas.tsx`, and wire into `RepurposeBoardEditor.tsx`**

1. Implement `src/components/repurpose/whiteboard/whiteboardSync.ts`:
   - `calculateInitialCardPositions(artboardIds, hyperframeIds)`: arranges cards side-by-side with 48px gap.
   - `reconcileProjectCardsWithStore`: determines which items exist in `project.json` but need shapes created in tldraw store.
2. Implement `src/components/repurpose/whiteboard/RepurposeWhiteboardCanvas.tsx`:
   - Mount `<Tldraw />` with `shapeUtils={customShapeUtils}`, `assetUrls={getTldrawOfflineAssetUrls()}`, and dark theme class.
   - Inject project context (artboards, rootProject, activePlayingId, handlers) through a React context provider so shape components can access them cleanly.
   - Store listener: throttled snapshot updates dispatched to `onSnapshotChange(snapshot)` which updates `project.whiteboardSnapshot`.
   - Single audio/video playback guardrail: passing `activePlayingId` so only the actively playing card runs video loop.
3. In `src/components/repurpose/RepurposeBoardEditor.tsx`:
   - Replace manual pan/zoom `stagePan`/`stageZoom` div with `<RepurposeWhiteboardCanvas />`.
   - Forward asset library drag-and-drop into canvas.
   - Keep left docked sidebar and header toolbar with export actions.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/repurpose/whiteboard/whiteboardSync.test.ts`
Expected: PASS.

- [x] **Step 5: Run TypeScript verification to ensure clean compilation**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [x] **Step 6: Commit**

```bash
git add src/components/repurpose/whiteboard/whiteboardSync.ts src/components/repurpose/whiteboard/RepurposeWhiteboardCanvas.tsx src/components/repurpose/RepurposeBoardEditor.tsx src/components/repurpose/whiteboard/whiteboardSync.test.ts
git commit -m "feat(repurpose): replace manual pan-zoom stage with tldraw infinite whiteboard canvas"
```

---

### Task 5: End-to-End Persistence Verification, Regression Check & Documentation

**Files:**
- Create: `src/components/repurpose/whiteboard/whiteboardIntegration.test.ts`
- Modify: `ISSUE.md`

**Interfaces:**
- Consumes: full Repurpose whiteboard persistence and export contracts
- Produces: comprehensive test coverage and documentation updates

- [x] **Step 1: Write integration test for .captr save/load with whiteboard elements**

```typescript
// src/components/repurpose/whiteboard/whiteboardIntegration.test.ts
import { describe, it, expect } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { ensureRepurposeBoard, setWhiteboardSnapshot } from "@/core/timeline/repurposeCommands";
import { validateTimelineProject } from "@/core/timeline/validation";

describe("Whiteboard .captr Bundle Integration", () => {
  it("survives project cloning, JSON serialization, and validation intact", () => {
    const project = ensureRepurposeBoard(createTimelineProject("proj-wb", "Whiteboard Show"));
    const fakeTldrawSnapshot = {
      schema: { schemaVersion: 2 },
      store: {
        "record:page": { id: "page:1", name: "Brainstorm" },
        "shape:arrow1": { id: "shape:arrow1", type: "arrow", props: { start: { x: 0, y: 0 }, end: { x: 100, y: 100 } } },
        "shape:note1": { id: "shape:note1", type: "note", props: { text: "Ideas for hook" } },
      },
    };

    const projectWithWb = setWhiteboardSnapshot(project, fakeTldrawSnapshot);
    const jsonString = JSON.stringify(projectWithWb);
    const parsed = JSON.parse(jsonString);

    const validated = validateTimelineProject(parsed);
    expect(validated.whiteboardSnapshot).toEqual(fakeTldrawSnapshot);
    expect(validated.repurposeBoard!.artboards.length).toBeGreaterThan(0);
  });
});
```

- [x] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/components/repurpose/whiteboard/whiteboardIntegration.test.ts`
Expected: PASS.

- [x] **Step 3: Run full test suite & TypeScript typecheck**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: All tests pass, 0 type errors.

- [x] **Step 4: Update ISSUE.md with V3 whiteboard contract and rebuild graft graph**

Update `ISSUE.md` documenting the tldraw infinite canvas whiteboard feature, offline asset bundling, and `.captr` V3 persistence.
Run `npx graft build` to keep the repo context graph synchronized.

- [x] **Step 5: Commit**

```bash
git add src/components/repurpose/whiteboard/whiteboardIntegration.test.ts ISSUE.md
git commit -m "docs: document tldraw infinite whiteboard canvas in ISSUE.md and verify e2e persistence"
```
