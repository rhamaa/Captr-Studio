# Hyperframe MP4 Video Export & Offscreen Rendering Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide a high-performance, frame-accurate MP4 video exporter for Hyperframe compositions by using an offscreen Chromium window with frame-by-frame `window.seekFrame()` seeking, `webContents.capturePage()` raw BGRA frame capturing, streaming FFmpeg H.264 hardware encoding, and companion audio muxing.

**Architecture:**
- **Offscreen Chromium Frame Stepper (`hyperframeExportEngine.ts`):** Spawns a hidden offscreen `BrowserWindow` configured with the exact Hyperframe dimensions, loads the preprocessed HTML composition, and programmatically steps through time at the target frame rate (e.g. 60fps) using `window.seekFrame(timeSec)` and `window.waitForFrameReady()`.
- **Zero-IPC Direct FFmpeg Pipe:** Captures raw 32-bit BGRA frames directly in the Electron main process via `webContents.capturePage()`, piping `image.getBitmap()` buffers straight to FFmpeg stdin (`-f rawvideo -pix_fmt bgra`) to achieve maximum throughput without renderer-to-main IPC serialization overhead.
- **Hardware-Accelerated Encoding & Audio Muxing:** Automatically resolves the fastest available encoder (`h264_nvenc`, `h264_qsv`, `h264_amf`, `h264_videotoolbox`, or `libx264`) and muxes optional companion microphone/system audio tracks (`*.mic.wav` / `*.sys.wav`) seamlessly without loss of sync.
- **Export Modal UI (`HyperframeExportModal.tsx`):** A dedicated, polished dialog in `HyperframeEditor` offering resolution presets (1080p, 4K, 720p), framerate selection (60fps, 30fps), quality options, audio inclusion toggles, and live frame-by-frame progress reporting with cancel capability.

**Tech Stack:** Electron 34 (`BrowserWindow`, `webContents.capturePage`), Node.js `child_process` (FFmpeg), React 18, TypeScript, Tailwind CSS, Phosphor Icons, Vitest.

---

### Task 1: Core Offscreen Exporter Engine & FFmpeg Argument Builders

**Files:**
- Create: `electron/ipc/hyperframe/hyperframeExportEngine.ts`
- Create: `electron/ipc/hyperframe/hyperframeExportEngine.test.ts`

**Step 1: Write the failing test**
Create `electron/ipc/hyperframe/hyperframeExportEngine.test.ts` testing argument builders for rawvideo BGRA input, encoder selection, and audio muxing arguments:

```ts
import { describe, expect, it } from "vitest";
import {
    buildHyperframeFfmpegExportArgs,
    buildHyperframeAudioMuxArgs,
    calculateHyperframeCount,
} from "./hyperframeExportEngine";

describe("hyperframeExportEngine", () => {
    it("calculates exact frame count for duration and fps", () => {
        expect(calculateHyperframeCount(10, 60)).toBe(600);
        expect(calculateHyperframeCount(5.5, 30)).toBe(165);
        expect(calculateHyperframeCount(0, 60)).toBe(1);
    });

    it("builds valid FFmpeg args for rawvideo BGRA stream input", () => {
        const args = buildHyperframeFfmpegExportArgs({
            width: 1920,
            height: 1080,
            fps: 60,
            bitrate: 12_000_000,
            encoder: "libx264",
            outputPath: "C:\\temp\\output.mp4",
        });

        expect(args).toContain("-f");
        expect(args).toContain("rawvideo");
        expect(args).toContain("-pix_fmt");
        expect(args).toContain("bgra");
        expect(args).toContain("-s:v");
        expect(args).toContain("1920x1080");
        expect(args).toContain("-framerate");
        expect(args).toContain("60");
        expect(args).toContain("-c:v");
        expect(args).toContain("libx264");
        expect(args).toContain("C:\\temp\\output.mp4");
    });

    it("builds audio muxing arguments when audioSourcePath is provided", () => {
        const args = buildHyperframeAudioMuxArgs({
            videoPath: "C:\\temp\\video.mp4",
            audioPath: "C:\\temp\\mic.wav",
            outputPath: "C:\\temp\\final.mp4",
        });

        expect(args).toContain("-i");
        expect(args).toContain("C:\\temp\\video.mp4");
        expect(args).toContain("C:\\temp\\mic.wav");
        expect(args).toContain("-c:v");
        expect(args).toContain("copy");
        expect(args).toContain("-c:a");
        expect(args).toContain("aac");
        expect(args).toContain("C:\\temp\\final.mp4");
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run electron/ipc/hyperframe/hyperframeExportEngine.test.ts`
Expected: FAIL (module not found).

**Step 3: Implement minimal code in `electron/ipc/hyperframe/hyperframeExportEngine.ts`**
Implement `calculateHyperframeCount`, `buildHyperframeFfmpegExportArgs`, `buildHyperframeAudioMuxArgs`, and the offscreen rendering loop helper function `exportHyperframeVideoJob`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run electron/ipc/hyperframe/hyperframeExportEngine.test.ts`
Expected: PASS (all tests green).

**Step 5: Commit**
`git commit -m "feat(hyperframe): implement core offscreen export engine and ffmpeg builders"`

---

### Task 2: Register Electron IPC Handlers & Expose in Preload Bridge

**Files:**
- Create: `electron/ipc/register/hyperframeExport.ts`
- Modify: `electron/ipc/handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/electron-env.d.ts`

**Step 1: Write the failing type check**
Add IPC definitions to `electron/electron-env.d.ts`:
- `exportHyperframeVideo(options: HyperframeExportOptions): Promise<HyperframeExportResult>`
- `cancelHyperframeExport(sessionId: string): Promise<{ success: boolean }>`
- `onHyperframeExportProgress(callback: (progress: HyperframeExportProgress) => void): () => void`

**Step 2: Run typecheck to verify it fails**
Run: `npx tsc --noEmit`
Expected: FAIL (missing methods in preload).

**Step 3: Implement minimal code in `electron/ipc/register/hyperframeExport.ts` and `electron/preload.ts`**
- Create `electron/ipc/register/hyperframeExport.ts` with `registerHyperframeExportHandlers()`.
- Register in `electron/ipc/handlers.ts`.
- Expose methods in `electron/preload.ts`.

**Step 4: Run typecheck to verify it passes**
Run: `npx tsc --noEmit`
Expected: PASS (0 errors).

**Step 5: Commit**
`git commit -m "feat(hyperframe): register export IPC handlers and preload bridge"`

---

### Task 3: Build `HyperframeExportModal` UI Component

**Files:**
- Create: `src/components/hyperframe/HyperframeExportModal.tsx`
- Create: `src/components/hyperframe/HyperframeExportModal.test.tsx`

**Step 1: Write the failing test**
Create `src/components/hyperframe/HyperframeExportModal.test.tsx`:
- Tests that the modal renders resolution choices (1080p, 4K, 720p).
- Tests framerate selection (60 fps, 30 fps).
- Tests companion audio toggle.
- Tests progress bar display when export is running.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/hyperframe/HyperframeExportModal.test.tsx`
Expected: FAIL (component not found).

**Step 3: Implement minimal code in `src/components/hyperframe/HyperframeExportModal.tsx`**
- Preset options with Captr Studio pastel/dark slate aesthetics.
- File picker dialog trigger via `window.electronAPI.showSaveDialog`.
- Execution state tracking (`idle`, `exporting`, `completed`, `error`).
- Real-time progress bar with current frame / total frames and percentage.
- Completion screen with "Open File Location" button.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/hyperframe/HyperframeExportModal.test.tsx`
Expected: PASS.

**Step 5: Commit**
`git commit -m "feat(hyperframe): create HyperframeExportModal UI component"`

---

### Task 4: Integrate Export Button into `HyperframeEditor` Top Header

**Files:**
- Modify: `src/components/hyperframe/HyperframeEditor.tsx`
- Modify: `src/components/hyperframe/HyperframeEditor.test.tsx`

**Step 1: Write the failing test**
In `src/components/hyperframe/HyperframeEditor.test.tsx`, add test:
- Asserts presence of "Export MP4" button in the top header (`hyperframe-export-btn`).

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/hyperframe/HyperframeEditor.test.tsx`
Expected: FAIL.

**Step 3: Implement minimal code in `src/components/hyperframe/HyperframeEditor.tsx`**
- Add `<DownloadSimple /> Export MP4` button in the top header.
- Connect state `isExportModalOpen` and render `<HyperframeExportModal />`.
- Pass current HTML, active version, project context, resolution, and audio path to the modal.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/hyperframe/HyperframeEditor.test.tsx`
Expected: PASS (all tests pass).

**Step 5: Commit**
`git commit -m "feat(hyperframe): integrate Export MP4 button and export modal into HyperframeEditor"`

---

### Task 5: End-to-End Build, Verification & Documentation

**Files:**
- Run Vitest test suites.
- Run `npx tsc --noEmit`.
- Run `graft build`.
- Update `ISSUE.md`.

**Step 1: Run all test suites**
Run: `npx vitest run`
Expected: PASS.

**Step 2: Run type check**
Run: `npx tsc --noEmit`
Expected: PASS (0 errors).

**Step 3: Rebuild code graph**
Run: `graft build`

**Step 4: Update ISSUE.md & final commit**
`git commit -m "docs: update ISSUE.md with Hyperframe MP4 export pipeline verification"`
