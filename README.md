<p align="center">
  <h1 align="center">🎥 Captr Studio</h1>
  <p align="center">
    <strong>The open-source, AI-powered motion screen recorder and multi-track video presentation editor built for creators, engineers, and product teams.</strong>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.4.0--beta.1-8B5CF6?style=for-the-badge&logo=rocket" alt="Version 1.4.0-beta.1" />
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-0F172A?style=for-the-badge&logo=electron&logoColor=white" alt="macOS Windows Linux" />
  <img src="https://img.shields.io/badge/Open%20Source-AGPL--3.0-2563EB?style=for-the-badge" alt="AGPL 3.0 License" />
  <img src="https://img.shields.io/badge/AI%20Editing-CLI%20Agent%20Bridge-10B981?style=for-the-badge&logo=openai" alt="AI Editing" />
  <img src="https://img.shields.io/badge/Whisper%20STT-Offline%20GGML-F59E0B?style=for-the-badge" alt="Whisper STT" />
  <img src="https://img.shields.io/badge/PixiJS-v8-E91E63?style=for-the-badge&logo=webgl&logoColor=white" alt="PixiJS v8" />
  <img src="https://img.shields.io/badge/GPU%20Accelerated-NVENC%20%2F%20WGC%20%2F%20SCK-06B6D4?style=for-the-badge" alt="GPU Accelerated" />
</p>

---

## 💡 What is Captr Studio?

**Captr Studio** is a high-performance desktop screen recording, multi-track presentation editor, and AI-assisted production suite. It turns raw screen captures into polished, studio-grade product walkthroughs, developer tutorials, and viral social clips out of the box — **without needing heavyweight suites like Premiere Pro, After Effects, or DaVinci Resolve.**

Captr Studio combines:
1. **Dynamic Screen Experience**: Smooth spring-damper cursor physics, Catmull-Rom spline curves, interactive click ripples, automatic zoom suggestions, and 3D perspective tilt.
2. **Autonomous AI Video Editor Assistant**: Direct CLI integration with local and cloud LLM agents (Antigravity `agy`, Claude Code, Cursor, Gemini CLI, Ollama, OpenCode, Aider) to intelligently layout projects, cut dead air, and craft B-Roll.
3. **Hyperframe Motion Graphics B-Roll Engine**: Programmatic HTML/CSS/Canvas kinetic typography, stat counters, animated quote callouts, and audio-reactive sound effect overlays.
4. **Offline Speech-to-Text & Karaoke Subtitles**: Integrated `whisper.cpp` engine for privacy-preserving, high-accuracy subtitle generation with word-level highlight animations.
5. **Multi-Artboard Repurpose Hub**: Inverted workspace to reframe, preview, and batch export 9:16 vertical shorts, 1:1 square feeds, 16:9 landscape videos, and 4:5 portrait posts from one unified timeline.

---

## ✨ Core Features & Capabilities

### 🤖 1. Autonomous AI Video Editor Assistant
- **Direct CLI Agent Bridge**: Bridge to your favorite coding and agent CLIs without API lock-in. Works natively with:
  - **Antigravity CLI (`agy`)**: High-speed deep agentic workspace reasoning.
  - **Claude Code (`claude`)**: Anthropic's flagship agent CLI.
  - **Cursor CLI (`cursor`)**: Editor-integrated agent actions.
  - **Gemini CLI (`gemini`)**: Google Gemini Pro reasoning.
  - **Ollama (`ollama`)**: 100% private local open-weights LLMs.
  - **OpenCode & Aider (`opencode`, `aider`)**: Open source pair programming CLIs.
- **Context-Aware `@Asset` Tagging**: Type `@` in the prompt to seamlessly attach project assets with exact duration, resolution, transcript sidecars, and subtitle metadata into the agent's context.
- **Two-Stage Execution Pipeline**: Agent generates structured action plans and motion script definitions before applying changes to the timeline.
- **Headless Auto-Approve Flags**: Runs non-interactively with `--dangerously-skip-permissions` and `-y` for seamless automation.
- **Live Terminal Console**: Real-time stdio streaming with color-coded execution logs and instant abort controls.

### ⚡ 2. Hyperframe Motion Graphics B-Roll Engine
- **Programmatic Motion Graphics**: Renders code-driven HTML5, CSS3, and Canvas visual graphics directly on top of video sequences.
- **Multi-Track B-Roll Layering**: Automatically creates and manages dedicated B-Roll visual tracks with custom stacking orders and blend modes.
- **Dynamic Animation Templates**:
  - *Kinetic Typography*: Word-by-word animated title statements.
  - *Stat Counters*: Counting numbers with percentage/currency tickers.
  - *Minimal Quote Cards*: Glassmorphism quote cards with speaker badges.
  - *Highlight Pulses*: Glowing focus circles and pointer highlights.
  - *Lower-Third Headlines*: Sleek broadcast-style title bars.
- **Audio-Reactive Sound Effects**: Synchronized sound effect trigger metadata (whoosh, pop, tick, ding) aligned with motion keyframes.

### 🎙️ 3. Offline Whisper Speech-to-Text & Karaoke Subtitles
- **100% Local & Private (`whisper.cpp`)**: High-performance C++ GGML transcription running entirely on your machine.
- **1-Click Model Downloader**: Download and switch models directly inside the app with live download progress (`tiny`, `base`, `small`, `medium`).
- **Word-Level Timestamps**: Accurately clocks every spoken word to the millisecond.
- **Interactive Subtitle Overlay**:
  - 4 visual design presets: *Karaoke Word Pop*, *Classic Subtitle*, *Cinematic Box*, and *Neon Glow*.
  - Word-level active highlighting with smooth color transitions and auto-wrapping.
  - Interactive on-canvas drag, resize handles, and boundary snapping.
  - Cut-synchronized: splitting or trimming clips automatically cuts and shifts subtitle segments.

### 📱 4. Multi-Artboard Repurpose Editor
- **Inverted Canvas Hub**: Work with multiple aspect ratios simultaneously:
  - **9:16 Vertical**: TikTok, Instagram Reels, YouTube Shorts.
  - **1:1 Square**: Instagram Feed, LinkedIn posts.
  - **16:9 Landscape**: YouTube Standard, presentation decks.
  - **4:5 Portrait**: Social media carousel formats.
- **Independent Sequence Editing**: Edit clips and camera paths per artboard without destructive cross-effects.
- **Docked Asset Library**: Drag media assets directly from the project library onto any artboard canvas.
- **Live Concurrent Playback**: Card-based video playback with synchronized scrubbing and playback controls.

### 🚀 5. Hardware-Accelerated Screen & Audio Capture
- **Windows Graphics Capture (WGC)**: High-fps DirectX 11 capture engine (`C++`) capable of smooth 60 FPS recording with minimal CPU impact.
- **Native macOS ScreenCaptureKit**: Optimized native capture pipeline on macOS 14+ for flawless screen and per-window captures.
- **Pure Native Audio Capture**:
  - **WASAPI Loopback (Windows)**: Crystal clear system sound recording without external virtual audio cables.
  - **ScreenCaptureKit Audio (macOS)**: Native system audio separation and microphone sync.
  - **PipeWire & Web Audio (Linux)**: Robust multi-channel capture.
- **Window & Display Modes**: Record full ultra-wide monitors, specific displays, or individual application windows with clean boundary isolation.

### 🔍 6. Intelligent Auto-Zoom & Cursor Physics
- **Dynamic Auto-Zoom**: Automatically detects clicks and typing clusters to suggest focused camera zoom regions.
- **Spring Physics Motion Smoothing**: Dampens jittery hand movements via spring-damper equations (`mass`, `stiffness`, `damping`).
- **Catmull-Rom Spline Interpolation**: Seamless, organic cursor curves instead of harsh linear zig-zags.
- **3D Perspective Tilt**: Subtle, realistic 3D perspective rotation tracking the cursor towards screen edges.
- **Cinematic Motion Blur & Click Ripples**: Natural temporal motion blur and customizable click ripple waves.

### 📹 7. Presenter Webcam Bubble Overlay
- **Floating Picture-in-Picture**: Add a circular or squircle webcam bubble to your recordings.
- **Reactive Zoom Dodging**: Bubble automatically scales and repositions during zoom events to avoid blocking important screen content.
- **Customization**: Independent control over corner radius, drop shadows, borders, mirrors, and free-form timeline positioning.

### ✂️ 8. Non-Linear Timeline & Audio Studio
- **Multi-Track Timeline**: Visual and audio tracks separated cleanly. Split clip (`Ctrl+B` / `C`), visual trim handles, and ripple delete (`Shift+Delete`).
- **Speed Ramping (变速)**: Accelerate long tasks (up to 10x) or apply slow-motion highlights with pitch-corrected audio.
- **Voiceover Studio**: Record live commentary directly into the timeline with real-time VU meter and audio waveform feedback.
- **Smart Audio Ducking**: Automatically attenuates background music when narration or microphone speech is detected.
- **Rich Canvas Annotations**: Add text cards, arrows, callout shapes, blur privacy masks, and sticker figures.

### ⚡ 9. Ultra-Fast GPU Export Engine
- **Multi-Backend Rendering via Pixi.js v8**: High-speed WebGL and WebGPU canvas compositing.
- **Native Hardware Encoders**:
  - **NVIDIA NVENC (CUDA Compositor)**: Blazing fast GPU export on RTX/GTX GPUs.
  - **Windows Media Foundation (WMF)**: Native hardware H.264 encoding.
  - **macOS VideoToolbox**: Hardware-accelerated Apple Silicon encoding.
  - **WebCodecs API & FFmpeg**: In-memory chunked export for broad cross-platform reliability.
- **Multi-Format Output**: Full resolution MP4 or palette-optimized looping GIFs.

### 💾 10. V3 Non-Destructive Project Persistence (`.captr`)
- **Authoritative `project.json`**: Complete project state index with isolated asset folders (`assets/<assetId>/`).
- **Sidecar Architecture**: Companion microphone audio, Whisper transcripts (`transcript.json`), and thumbnails stored cleanly alongside source media.
- **Atomic Operations & Recovery**: Safe save, rename, and recovery transactions that prevent file corruption.
- **Backward Compatibility**: Seamlessly open and upgrade legacy `.recordly` and `.openscreen` files.

---

## 🏗️ Architecture & Tech Stack

```
Captr Studio (v1.4.0)
├── Electron Shell (Lifecycle, Multi-Window Management, IPC Services)
│    ├── AI Agent Bridge (CLI Spawner: agy, claude, cursor, gemini, ollama, opencode, aider)
│    ├── Whisper STT Service (whisper.cpp GGML, Audio Extractor, JSON Transcripts)
│    ├── Project Storage V3 (.captr container, project.json authoritative index)
│    ├── Native Capture (WGC DirectX 11, macOS ScreenCaptureKit, WASAPI Loopback)
│    └── Native Compositor (NVIDIA CUDA Helper, WMF, VideoToolbox)
├── Renderer Layer (React 18 + Vite + Tailwind CSS)
│    ├── Launch & HUD Overlay (Floating interactive recording controller)
│    ├── Multi-Artboard Repurpose Hub (9:16, 1:1, 16:9, 4:5 simultaneous preview)
│    ├── Non-Linear Timeline Engine (Multi-track dnd-timeline, Ripple Delete, Trimming)
│    ├── SubtitleOverlay Component (Word-level karaoke styling & interactive canvas positioning)
│    ├── Hyperframe B-Roll Renderer (Dynamic HTML/CSS/Canvas kinetic typography & graphics)
│    └── Compositor Engine (PixiJS v8, WebGL / WebGPU Canvas)
└── Export Pipeline
     ├── Hardware NVENC / WMF / VideoToolbox / QSV / AMF
     └── WebCodecs + FFmpeg Muxer
```

- **Runtime**: Electron 39, Node.js, TypeScript 5
- **UI Framework**: React 18, Tailwind CSS, Radix UI Primitives, Phosphor Icons
- **Motion & Graphics**: Pixi.js v8, GSAP, Motion (Framer Motion), Hyperframe Engine
- **Speech Processing**: Whisper GGML (`whisper.cpp`), Web Audio API, FFmpeg Native Audio Extractor
- **Native Kernels**: C++20 (Direct3D11, WGC, Media Foundation, CUDA), Swift (ScreenCaptureKit)
- **Quality & Build**: Biome, Vitest, Vite 5, Electron Builder

---

## 🤖 Using the AI Video Editor Assistant

Captr Studio features an integrated **AI Assistant** that interfaces directly with local and cloud coding agents.

```
┌────────────────────────────────────────────────────────┐
│                   AI Assistant Modal                   │
│                                                        │
│  Select Agent: [ Antigravity (agy) ▾ ]  [● Connected]  │
│                                                        │
│  Prompt:                                               │
│  "Make an engaging 9:16 TikTok clip from @RawCapture.  │
│   Add energetic kinetic B-Roll for key moments and     │
│   enable Karaoke subtitles."                           │
│                                                        │
│  [ Generate Plan ]                   [ Execute Tasks ] │
└────────────────────────────────────────────────────────┘
```

### Supported CLI Agents
1. **Antigravity (`agy`)**: High-performance local reasoning agent. Automatically detected in `PATH` or standard user bin folders.
2. **Claude Code (`claude`)**: Anthropic CLI agent running Claude 3.7 Sonnet.
3. **Cursor CLI (`cursor`)**: Cursor's integrated command-line tool.
4. **Google Gemini CLI (`gemini`)**: Google's command line interface.
5. **Ollama (`ollama`)**: Runs fully offline with Llama 3, Qwen 2.5, DeepSeek, etc.
6. **OpenCode & Aider (`opencode`, `aider`)**: Autonomous open-source pair programmers.

### Mentioning Assets (`@Asset`)
Type `@` inside the prompt textarea to open the asset suggestion popover. Selecting an asset embeds a tagged reference that automatically feeds:
- Asset ID, filename, and absolute filesystem path
- Exact media duration, width, height, and FPS
- Companion audio channels and Whisper transcript sidecars

---

## 🗺️ Progress & Implementation Status

Dokumentasi capaian fitur dan fondasi teknis yang telah selesai diimplementasikan hingga rilis saat ini (**v1.4.0-beta.1**):

### ✅ 1. Brand Identity & Project Architecture
- [x] **Konsolidasi Identitas Captr Studio**: Nama aplikasi, identifier Windows (`studio.captr.app`), dan pipeline rilis resmi `rhamaa/Captr-Studio`.
- [x] **Official App Icon**: Logo resmi kurva **C** neon dan lensa aperture menyala (`icon.ico`, `icon.icns`, `png/*`).
- [x] **V3 Non-Destructive Project Format (`.captr`)**: Format proyek berbasis direktori terstruktur dengan indeks `project.json` authoritative, isolasi asset di `assets/<assetId>/`, dan transaksi simpan/rename atomik.
- [x] **Legacy Project Support**: Kompatibilitas mundur penuh untuk membuka dan meng-upgrade proyek `.recordly` dan `.openscreen`.

### ✅ 2. Screen & Audio Capture Core
- [x] **Windows Graphics Capture (WGC)**: Helper native C++ (Direct3D 11) perekaman layar dan jendela aplikasi hingga 60 FPS.
- [x] **macOS ScreenCaptureKit Engine**: Helper native Swift untuk perekaman layar jernih tanpa latency kursor pada macOS 14+.
- [x] **Native WASAPI Audio Loopback (Windows)**: Perekaman suara internal sistem jernih tanpa virtual audio cable.
- [x] **Multi-channel Microphone Capture**: Perekaman mikrofon simultan dengan isolasi track mandiri.

### ✅ 3. Smart Motion & Cursor Physics
- [x] **Global Hardware Cursor Tracking**: Pelacakan posisi kursor dan klik mouse real-time via `uiohook-napi`.
- [x] **Spring Physics Smoothing**: Peredaman getaran tangan menggunakan osilator harmonik pegas (*mass, damping, stiffness*).
- [x] **Catmull-Rom Spline Interpolation**: Kurva lintasan kursor sinematik yang mengalir alami.
- [x] **Intelligent Auto-Zoom**: Deteksi klaster klik dan ketikan tombol untuk framing kamera dinamis.
- [x] **3D Perspective Tilt**: Kemiringan kamera 3D halus mengikuti pergerakan kursor ke sudut layar.

### ✅ 4. AI Autonomous Video Editor & Hyperframe Engine
- [x] **CLI Agent Bridge**: Integrasi IPC multi-agent yang mendukung Antigravity (`agy`), Claude Code, Cursor, Gemini CLI, Ollama, OpenCode, dan Aider.
- [x] **Context-Aware `@Asset` Tagging**: Sisipkan referensi aset media dan transkrip langsung ke prompt agent.
- [x] **Hyperframe B-Roll Engine**: Generator grafis berbasis kode untuk kinetic typography, stat counters, kartu kutipan, dan transisi visual berlapis.
- [x] **Multi-Track B-Roll Layering**: Penempatan klip B-roll pada track visual mandiri di atas video utama.

### ✅ 5. Offline Whisper STT & Karaoke Subtitles
- [x] **Native Whisper Engine (`whisper.cpp`)**: Transkripsi audio lokal berkecepatan tinggi tanpa memerlukan koneksi internet.
- [x] **1-Click Model Downloader**: Unduh dan ganti model GGML (`tiny`, `base`, `small`, `medium`) langsung dari antarmuka aplikasi dengan indikator progres unduhan.
- [x] **Word-Level Timestamps**: Penandaan waktu kata-per-kata presisi milidetik yang disimpan dalam berkas sidecar `transcript.json`.
- [x] **Interactive SubtitleOverlay**: 4 gaya caption (*Karaoke Word Pop*, *Classic*, *Cinematic Box*, *Neon Glow*), auto-wrapping, drag positioning, dan sinkronisasi otomatis saat klip dipotong (*ripple cut*).

### ✅ 6. Multi-Artboard Repurpose Editor
- [x] **Multi-Artboard Hub**: Kanvas terintegrasi untuk mengedit dan mempratinjau rasio 9:16 (TikTok/Reels), 1:1 (Instagram), 16:9 (YouTube), dan 4:5 (Portrait) secara bersamaan.
- [x] **Independent Sequence Editing**: Pengeditan timeline mandiri per artboard tanpa saling merusak konten artboard lain.
- [x] **Docked Asset Library**: Bilah pustaka aset yang dapat ditarik (*drag-and-drop*) langsung ke sembarang artboard.

### ✅ 7. Timeline Editor & Audio Studio
- [x] **Non-Linear Timeline UX**: Pemotongan klip instan (`Ctrl+B` / `C`), visual trim handles, dan *Ripple Delete* (`Shift+Delete`).
- [x] **Speed Ramping (变速)**: Kontrol kecepatan klip 0.25x hingga 8x dengan koreksi pitch audio.
- [x] **Voiceover Studio**: Perekam suara narasi terintegrasi lengkap dengan visual VU meter dan waveform level audio.
- [x] **Smart Audio Ducking**: Otomatis meredam musik latar saat narasi terdeteksi untuk menjaga kejelasan vokal.

### ✅ 8. GPU Export & Multi-Language Localization
- [x] **Hardware Video Encoding**: NVENC (NVIDIA CUDA), WMF (Windows), VideoToolbox (Apple Silicon), Intel QuickSync, dan AMD AMF.
- [x] **Dukungan 10 Bahasa (i18n)**: English, Chinese (Simplified & Traditional), Spanish, Portuguese, French, Russian, Korean, Dutch, Italian.

---

## 🛠️ Development & Building from Source

### Prerequisites

- **Node.js**: >= 20.x (Recommended: Node.js 22 LTS)
- **Compilers & Native Tooling**:
  - **Windows**: Visual Studio 2022 (with "Desktop development with C++" workload and Windows 10/11 SDK) + CMake. Optional for CUDA: NVIDIA CUDA Toolkit 12+.
  - **macOS**: Xcode 15+ & Command Line Tools (`xcode-select --install`).
  - **Linux**: GCC/Clang, CMake, `libx11-dev`, `libxtst-dev`, `libxrandr-dev`, `libasound2-dev`.

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rhamaa/Captr-Studio.git
   cd Captr-Studio
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start in development mode**:
   ```bash
   npm run dev
   ```

4. **Launch standalone video editor in dev**:
   ```bash
   npm run dev:editor
   ```

### Running Tests & Linting

```bash
# Run unit tests (Vitest)
npm test

# Run TypeScript type check
npx tsc --noEmit

# Run Biome code style check
npm run lint

# Auto-format codebase
npm run format
```

### Packaging Installers

```bash
# Package for current host platform
npm run build

# Package platform-specific targets
npm run build:win          # Windows (NSIS .exe installer)
npm run build:win:local    # Windows local build (allows missing prebuilt whisper binaries)
npm run build:mac          # macOS (.dmg and .zip)
npm run build:linux        # Linux (.AppImage)
```

---

## 📦 Publishing & Releases

Refer to [`RELEASING.md`](RELEASING.md) for the complete end-to-end release guide, including:
- Automated GitHub Releases via `.github/workflows/release.yml`
- Generating SHA-256 checksums (`npm run checksums:release`)
- Code signing configurations (Apple Developer ID, Windows Authenticode)
- Publishing releases using GitHub CLI (`npm run release:create`)

---

## 📄 License & Acknowledgements

- **License**: Captr Studio is open-source software licensed under the **AGPL 3.0** license. See [`LICENSE.md`](LICENSE.md).
- **Acknowledgements**:
  - Built upon foundational research and inspirations from [Recordly](https://github.com/webadderallorg/Recordly) and [OpenScreen](https://github.com/siddharthvaddem/openscreen).
  - Special thanks to the open-source community, contributors, and the creators of PixiJS, FFmpeg, Whisper.cpp, and Electron.
