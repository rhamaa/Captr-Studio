# Changelog

All notable changes to the **Captr Studio** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### 🚀 Highlights
- **AI Custom Harness & Floating Command Bar (`Ctrl+K`)**: Re-architected Captr Studio's AI interaction layer into a sleek Spotlight command palette with deep real-time surface awareness, dynamic contextual action pills, and speculative ghost previews.
- **Deep Surface-Aware Editing Engine**: Live synchronization across 6 editor surfaces (`record-editor`, `story-editor`, `caption-editor`, `artboard`, `voiceover`, and `home`). Contextual actions adapt automatically to the active view.
- **Speculative Ghost Preview Drawer**: Non-destructive floating preview drawer displaying diff summaries with one-stroke *Accept Changes (`Enter`)* and *Discard (`Esc`)* shortcuts.
- **Pure `.captr` Metadata Mutation Architecture**: AI operations mutate in-memory project configurations via `ProjectController.execute` commands without generating redundant synthetic video proxies or touching source media files.
- **Hierarchical AI Configuration**: Global Preferences tab (`AI Harness & Models`) supporting multiple CLI runners (`agy`, `opencode`, `hermes`, `cursor`, `custom`) alongside backward-compatible per-project `aiConfig` overrides inside `.captr` files.
- **Graceful Closed-Project MCP Handling**: External AI runners connecting via MCP can safely query project context at any time without exception crashes when no project is loaded.

### Added
- **AI Custom Harness UI (`AiCommandBar.tsx` & `AiSpeculativeDrawer.tsx`)**:
  - Global `Ctrl+K` / `Cmd+K` hotkey and top bar AI button.
  - Active surface badge identifying current context and selected assets/clips.
  - Contextual action pills: `Auto-Zoom to Clicks`, `Style: Brutalism`, `Style: Claymorphism`, `Remove Silence`, `Fix Typos`, `Repurpose 9:16 Shorts`, and custom text prompts.
  - Floating speculative diff drawer with clip addition/removal/modification counts and duration deltas.
- **Record Editor Metadata Mutation Tools (`agentTools.ts` & `mcpServer.ts`)**:
  - `set_frame_appearance`: direct window and webcam frame styling.
  - `apply_appearance_preset`: one-click application of curated visual looks (Brutalism, Claymorphism, Glassmorphism, Retro Arcade, Clean Minimal, Modern Dark).
  - `auto_zoom_to_clicks`: automatic generation of smooth cubic-Bezier scale keyframes around recorded mouse click coordinates.
- **Global AI Preferences Tab (`AppSettingsDialog.tsx` & `appSettings.ts`)**:
  - Form controls for Preferred Runner (`agy`, `opencode`, `hermes`, `cursor`, `custom`).
  - Custom CLI executable path, default model selection, local MCP server port (default `4040`), and Ghost Preview toggle.
  - Dual persistence (electron-store + localStorage fallback).
- **Project Schema AI Configuration (`aiTypes.ts` & `types.ts`)**:
  - Optional `aiConfig?: ProjectAiConfig` field on `TimelineProject` preserving project-specific model and persona overrides.
- **Real-Time Surface IPC (`agent.ts`, `preload.ts`, & `mcpServer.ts`)**:
  - IPC channel `agent:sync-surface` synchronizing renderer surface changes to the main process and MCP server state.

### Changed
- Re-enabled AI features under `FEATURE_AI_ENABLED = true` with the new lean custom harness replacing legacy modal overlays.
- MCP tool `get_project_context` now returns full `CaptrAppContext` with dynamic accelerators when open, and graceful `{ isProjectOpen: false, activeView: "home" }` when closed.

---

## [1.4.0-beta.3] - 2026-10-18

### 🚀 Highlights
- **Record Editor Frame Appearance Studio**: Dedicated "Appearance" section in the Record Editor sidebar for styling screen and webcam frames with rounded corners, padding, border styling, drop shadows, and visual theme presets.
- **Rich Visual Style Presets**: Built-in visual cards for Brutalism, Claymorphism, Glassmorphism, Retro Arcade, Clean Minimal, and Modern Dark with live user preset management (save, rename, delete, import, export).
- **Outward Border Expansion Geometry**: Fixed border thickness encroaching onto recordings by positioning borders outward on the canvas and casting shadows from the outer frame contour.
- **Interactive Preview Zoom & Pan in Record Editor**: Smooth mouse wheel zooming (0.25x–5x) anchored to cursor, dedicated pan mode toggle (`Hand`), middle-click drag support, and 100% reset badge in the transport bar.
- **Custom Numeric Micro-Steppers & Keyboard Stepping**: High-precision custom dark micro-steppers (`▲`/`▼`) with native spinner suppression, keyboard arrow stepping (`↑`/`↓` ±1, Shift: ±5), and hex color input.
- **Centralized Feature Flags & Streamlined AI Surface**: Consolidated AI features behind `FEATURE_AI_ENABLED` toggle while AI workflows undergo architectural re-planning.

### Added
- **Record Editor Appearance Tab & Presets (`RecordingFrameAppearancePanel.tsx`)**:
  - Direct frame styling for Screen recording and Webcam video frames.
  - Visual preset gallery rendering live SVG previews for Brutalism, Claymorphism, Modern Dark, Glassmorphism, and more.
  - User preset manager to save, rename, delete, import, and export custom JSON presets.
  - Custom micro-stepper controls and keyboard shortcut stepping for pixel-perfect adjustments.
- **Preview Zoom & Pan Controls in Record Editor (`RecordingCompositionEditor.tsx`)**:
  - Smooth wheel zoom with cursor focal point anchoring.
  - Pan mode toggle button and middle-click pan drag.
  - 1-click zoom reset to 100% in transport bar.
  - Synchronized overlay handles and live rendering during zoom/pan.
- **Outward Border Expansion (`frameRenderer.ts`)**:
  - Outward stroke placement (`x - b/2`, `y - b/2`, `w + b`, `h + b`) preserving the recorded video's active viewport without overlaying pixels.
  - Frame drop shadow adjusted to cast from the outer border boundary.
- **Central Feature Flags (`src/core/featureFlags.ts`)**:
  - Clean `FEATURE_AI_ENABLED` configuration hiding unfinished AI buttons and drawers cleanly.

### Changed
- **Record Editor Layout**: Frame styling moved to its own dedicated sidebar tab alongside Scene, Cursor, and Layout.
- **Hyperframe Studio**: Defaulted to Direct Source Code mode with CLI Agent drawer hidden until planned.

### Fixed
- Fixed border thickness covering recording media in Record Editor export and preview.
- Fixed browser default number spinner arrows disrupting input styling in appearance panels.
- Fixed canvas drag/pan state desynchronization in recording preview monitor.

---

## [1.4.0-beta.2] - 2026-10-17

### 🚀 Highlights
- **Interactive Transform Keyframe Engine**: Toggle keyframes on Position (X/Y), Scale (X/Y), and Rotation with diamond indicators (`◆`/`◇`) in the Inspector, visual keyframe diamonds on timeline clips, and auto-keyframing directly from the canvas gizmo.
- **Live Canvas Transform Gizmo & Drag Sync**: Smoothly manipulate overlay objects in the video preview without position jumping or desynchronized bounding boxes.
- **Unified Left Sidebar & Top Rail Navigation**: Replaced the separate 48px left rail with a clean, space-saving horizontal top bar inside the sidebar card header for switching between Assets, Shapes, Text Overlays, and Templates.
- **Rich Shape & Highlight Studio**: Expanded shape library with visual SVG cards, blur/privacy masks, callouts, arrows, and granular controls for fill, stroke, corner radius, and opacity.
- **Standardized Timeline Track Architecture**: Separated media and audio tracks with contextual track naming (`Shape`, `Shape 1`, `Track 1`, `Audio 1`, etc.).
- **Studio Design System Custom Dark Scrollbars**: Sleek 6px custom scrollbars matching Captr Studio theme tokens across the Timeline, Inspector, Asset Grid, and Modal dialogs, eliminating stark Windows native scrollbar UI.
- **Story Editor Finishing & Test Baseline Stabilization**: Complete Story-owned captions, shared preview/export burn-in, filmstrips, clip clipboard, and 1,670+ passing automated tests.

### Added
- **Visual Keyframe Engine**:
  - Interactive diamond toggle buttons (`◆`/`◇`) for transform properties in `ProjectInspector`.
  - Timeline keyframe glyphs rendering exact timestamp markers inside `TimelineClipItem`.
  - Timeline toolbar keyframe navigation: toggle keyframe (`K`), jump to previous/next keyframe.
  - Canvas gizmo interactions (drag, resize) that immediately create and update keyframes when transform keyframing is active.
- **Shape & Highlight Library (`ShapeLibrary.tsx`)**:
  - Visual SVG shape selector cards for Rectangle, Ellipse, Line, Arrow, Star, Callout Bubble, and Privacy Blur masks.
  - Detailed shape attribute configuration panel with live preview of fill color, stroke color, stroke width, corner radius, opacity, and blur intensity.
  - Direct 1-click addition onto timeline at playhead position.
- **Custom Scrollbar System**:
  - Global 6px custom scrollbars with `--scrollbar-thumb`, `--scrollbar-track`, and hover states.
  - Suppressed default Windows native scrollbar buttons (`::-webkit-scrollbar-button { display: none !important; }`).
- **Standardized Track Naming System**:
  - Clean separation into visual media tracks and audio tracks without cluttered subtypes.
  - Context-aware dynamic track names based on primary clip type (`Shape`, `Shape 1`, `Track 1`, `Audio 1`, etc.).

### Changed
- **Left Sidebar Layout**: Replaced the standalone 48px rail column with an integrated horizontal top navigation bar embedded in the sidebar card header, expanding available video preview workspace.
- **Live Overlay Dragging**: Overhauled drag and resize physics in `StoryEditor` so overlay graphics and their selection bounding boxes translate simultaneously in real time without teleporting on mouse release.
- **Story Finishing & Baseline**: Integrated Story-owned captions, placement source-clock mapping, independent Artboard anchors, shared Canvas burn-in, filmstrips, clip clipboard, and group/link selections.

### Fixed
- Fixed overlay bounding box desynchronization during live dragging on preview canvas.
- Fixed stark white Windows scrollbars showing in dark mode UI on Windows.
- Restored missing shadow direction label in `RecordingFrameAppearancePanel`.
- Stabilized the automated baseline to 1,670+ passing tests across 238 test suites.

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
