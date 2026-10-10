# Changelog

All notable changes to the **Captr Studio** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Implemented — Story ownership foundation (2026-10-10)

- Text/Shapes belong inline to each Story clip; independent Templates preserve reusable presets and unused legacy designs. New designs use finite five-second source extents with undoable extension.
- Root and Artboard tracks/private media are authoritative. Assets contain reusable media and Recording sources; Story Media contains the active owner's private file media. Publish to Assets preserves source IDs and undoable references.
- Shared Recording packages retain independent placement compositions. Preview/export use scoped resolution and existing source clocks; no source flattening.
- Voiceover captures immutable originating Story/token/playhead/IDs and registers private source separately from placement. Deleted/stale/canceled takes reject with bounded cleanup. Screen Record remains global Assets-only.
- V3 clone normalization and real bundle persistence retain all libraries including unplaced private sources, sidecars, captions metadata and current projections. Bounded manifest filenames preserve long/case/prefix-distinct Story IDs. Atomic ingress and project identity/path protections remain.
- Legacy inherited Artboards preserve explicit transition overrides, including empty lists, through independent snapshot remapping. Dangling transitions and Story owner associations reject atomically without changing active project paths or source bytes.
- Version remains `1.4.0-beta.1`; no release/version bump. [Verification](docs/superpowers/plans/2026-10-10-story-asset-ownership-verification.md) records approved task/whole-branch reviews, 224 passing final covering tests, exact baseline comparison and native gaps.

### Deferred finishing and verification

- Native recorder/microphone/editor lifecycle QA remains pending. Automated lifecycle tests do not verify HUD/native interaction.
- Caption editing/burn-in, real waveform/filmstrip, grouping, grading/masks, speed curves/tracking/proxies and authored trailing-blank duration control remain backlog; this foundation preserves caption metadata.
- Task 8 and whole-branch reviews are approved after the focused migration fixes. Nine original full-suite failures and existing lint debt remain recorded; native QA is pending.

---

## [1.4.0-beta.1] - 2026-10-06

### 🚀 Highlights
- **AI Autonomous Video Editor Assistant**: Natural language prompt-driven video editing backed by local and cloud LLM CLI bridges (Antigravity `agy`, Claude Code, Cursor, Gemini CLI, Ollama, OpenCode, Aider).
- **Context-Aware `@Asset` Tagging**: Creators can reference project assets directly in prompts to feed exact durations, resolutions, paths, and transcription sidecars into LLM context.
- **Hyperframe Motion Graphics B-Roll Engine**: Programmatic HTML/CSS/Canvas kinetic typography, animated stats counters, quote callouts, and audio-reactive sound effect overlays generated and placed onto dedicated timeline tracks.
- **Offline Whisper Speech-to-Text & Karaoke Subtitles**: Integrated `whisper.cpp` GGML engine with 1-click model downloads (`tiny`, `base`, `small`, `medium`), word-level timestamping, and interactive `SubtitleOverlay` featuring 4 distinct styles (Classic, Cinematic Box, Karaoke Word Pop, Neon Glow).
- **Multi-Artboard Repurpose Editor**: Inverted multi-artboard canvas hub with docked asset library. Edit and export 9:16 vertical shorts, 1:1 square, 16:9 landscape, and 4:5 portrait independently or concurrently from a single project.
- **V3 Non-Destructive Storage Architecture**: Fully authoritative `project.json` schema, structured asset directories (`assets/<assetId>/`), sidecar audio/transcript bindings, atomic save transactions, and safe project rename flows.

---

### Added

#### 🤖 AI Autonomous Video Editor Assistant & CLI Bridge
- **Multi-Agent CLI Bridge Service (`electron/agentService.ts`)**:
  - Auto-detection and seamless execution of AI CLI tools across system `PATH` and user installation directories (`~/.antigravity/bin`, `~/.npm-global/bin`, `~/.local/bin`, `%LOCALAPPDATA%\Programs`).
  - First-class support for **Antigravity CLI** (`agy`), **Claude Code** (`claude`), **Cursor CLI** (`cursor`), **Gemini CLI** (`gemini`), **Ollama** (`ollama`), **OpenCode** (`opencode`), and **Aider** (`aider`).
  - Automatic permission-bypass flags (`--dangerously-skip-permissions`, `-y`, `--auto-approve`) for frictionless headless workflow execution.
  - Native binary direct execution without cmd shell-wrapping on Windows, preventing argument distortion and process orphan issues.
  - Real-time stdio streaming over IPC channels (`agent:execute`, `agent:stream`) with cancellation support (`agent:cancel`).
- **AI Assistant Modal UI (`src/components/video-editor/AIAssistantModal.tsx`)**:
  - Floating dark-mode modal with live CLI agent selection and status badge.
  - Interactive `@` trigger popover for mentioning project assets (`@Asset`) with preview thumbnails and type badges.
  - Two-stage pipeline support: plan generation followed by direct execution of timeline changes and B-Roll generation.
  - Collapsible real-time execution log terminal with autoscroll and error highlighting.

#### ⚡ Hyperframe Motion Graphics B-Roll Engine
- **Motion Graphics Compilation & Runner (`src/utils/hyperframeRenderer.ts`, `src/types/brollTypes.ts`)**:
  - Deterministic compilation of HTML5, CSS3, and Canvas animations into visual timeline B-Roll clips.
  - Multi-track layering: dedicated B-Roll visual tracks with customizable stacking orders, blend modes, and opacity curves.
  - Built-in animation templates: *Kinetic Typography*, *Animated Metric / Stat Counter*, *Minimal Quote Card*, *Highlight Pulse*, and *Lower-Third Headline*.
  - Audio sound-effect sidecar trigger support (whoosh, pop, tick, ding) synchronized with animation keyframes.

#### 🎙️ Speech-to-Text (Whisper) & Karaoke Subtitles
- **Offline Whisper Transcription Engine (`electron/whisperService.ts`, `electron/audioExtractor.ts`)**:
  - Bundled high-performance `whisper.cpp` runtime with multi-threading and CPU SIMD acceleration (AVX2, NEON).
  - 1-Click GGML model downloader with progress tracking and byte verification (`tiny`, `base`, `small`, `medium`).
  - Automatic audio extraction from source video or companion microphone sidecars (`audio.wav`, 16kHz mono).
  - JSON transcript output format containing full segment text, confidence, and millisecond-accurate word-level timestamps.
- **Interactive Subtitle Overlay (`src/components/video-editor/SubtitleOverlay.tsx`)**:
  - 4 visual caption presets: *Karaoke Word Pop*, *Classic Subtitle*, *Cinematic Box*, and *Neon Glow*.
  - Word-level active highlighting with dynamic scaling, smooth color morphing, and auto-wrapping.
  - Interactive on-canvas drag positioning, boundary snapping, and scale handles.
  - Automatic cut synchronization: subtitle segments automatically split and ripple when timeline clips are trimmed or cut.

#### 📱 Multi-Artboard Repurpose Editor
- **Multi-Artboard Hub (`src/components/video-editor/ArtboardHome.tsx`, `MultiArtboardViewer.tsx`)**:
  - Inverted workflow allowing creators to preview and manage multiple social aspect ratios simultaneously:
    - 9:16 Vertical (TikTok, Instagram Reels, YouTube Shorts)
    - 1:1 Square (Instagram Feed, LinkedIn)
    - 16:9 Landscape (YouTube Standard, Desktop Presentations)
    - 4:5 Portrait (Social Media Carousels)
  - Independent timeline sequence editing per artboard without destructive cross-contamination.
  - Docked Asset Library sidebar with instant drag-and-drop to any artboard canvas.
  - Individual card video playback, pause, and scrub synchronization.

#### 🗄️ V3 Non-Destructive Project Architecture
- **V3 Project Schema (`src/types/project.ts`, `electron/projectStore.ts`)**:
  - Authoritative `project.json` file inside the `.captr` container.
  - Dedicated asset isolation under `assets/<assetId>/` holding original media, generated audio wavs, transcripts, and thumbnails.
  - Non-destructive metadata editing: all cuts, speeds, transforms, overlays, and transitions persist without touching source files.
  - Project Home screen with recent projects, verified atomic Save/Save As/Rename transactions, and corrupt file recovery.

---

### Changed
- Bumping version to `1.4.0-beta.1` across `package.json` and `package-lock.json`.
- Restructured timeline track hierarchy to cleanly separate Primary Video (A-Roll), Overlay B-Roll (Hyperframe & Media), Subtitles, Annotations, and Multi-channel Audio (System + Mic + BGM).
- Updated Windows installer configurations to bundle native Whisper runtime helpers and file associations (`.captr`).
- Replaced legacy naming across all components, configuration files, and documentation in favor of **Captr Studio**.
- Upgraded Biome and TypeScript build pipeline with strict typing across all IPC channels.

---

### Fixed
- Fixed CLI flag ordering where `--dangerously-skip-permissions` had to precede `-p` arguments for Antigravity (`agy`).
- Fixed Windows `cmd.exe` shell quoting bug that caused `.exe` agent binaries to fail execution or drop arguments.
- Resolved companion microphone audio sidecar resolution in recording packages where audio would occasionally fail to transcribe.
- Fixed artboard clip state leakage where multiple artboard preview instances previously shared identical composition clocks.
- Fixed hotkey interceptors to properly ignore events when typing within input fields, textareas, and modal prompt inputs.
- Resolved race condition during rapid consecutive project save and rename operations.

---

## [1.3.0-beta.3] - 2026-09-19

### Added
- **Brand Identity & App Icon Consolidation**:
  - Official Captr Studio neon **C** aperture logo with glowing recording dot.
  - Standardized multi-platform application icon bundles (`icon.ico`, `icon.icns`, `png/*`).
  - Windows `AppUserModelId` registered as `studio.captr.app`.
- **Hardware-Accelerated Screen & Audio Capture**:
  - Windows Graphics Capture (WGC) DirectX 11 native C++ helper up to 60 FPS.
  - macOS ScreenCaptureKit native Swift engine for crystal clear screen recording.
  - WASAPI loopback audio capture on Windows for direct system audio recording.
- **Intelligent Auto-Zoom & Cursor Physics**:
  - Spring-damper oscillator smoothing (`mass`, `damping`, `stiffness`) for natural cursor motion.
  - Centripetal Catmull-Rom spline path interpolation.
  - Cinematic motion blur and interactive radial click ripple waves.
  - 3D perspective tilt effect tracking cursor position across screen corners.
- **Hardware GPU Export Pipeline**:
  - NVIDIA NVENC hardware H.264 encoding via CUDA Compositor helper.
  - Intel QuickSync (QSV), AMD AMF, and Apple VideoToolbox hardware acceleration support.
  - Universal WebCodecs + FFmpeg chunked fallback muxer.
- **10-Language Internationalization (i18n)**:
  - English, Simplified Chinese, Traditional Chinese, Spanish, Brazilian Portuguese, French, Russian, Korean, Dutch, Italian.

---

## [1.2.0] - 2026-05-23

### Added
- Non-linear timeline with split clip (`Ctrl+B` / `C`), trim handles, and ripple delete (`Shift+Delete`).
- Floating presenter webcam PiP bubble with custom corner radius, borders, drop shadows, and auto-zoom dodging.
- Per-clip speed ramping from 0.25x up to 8x with audio pitch compensation.
- Studio canvas styling: curated wallpaper library, custom image/video imports, blur, and frame padding.
- Integrated voiceover recording studio with live audio VU metering.
- Rich canvas annotations: text cards, callouts, blur privacy masks, and stickers.
- Export to MP4 and lightweight animated GIFs with palette optimization.
