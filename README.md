<p align="center">
  <h1 align="center">🎥 Captr Studio</h1>
  <p align="center">
    <strong>The open-source, motion-driven screen recorder and presentation editor built for creators, engineers, and product teams.</strong>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-0F172A?style=for-the-badge&logo=electron&logoColor=white" alt="macOS Windows Linux" />
  <img src="https://img.shields.io/badge/Open%20Source-AGPL--3.0-2563EB?style=for-the-badge" alt="AGPL 3.0 License" />
  <img src="https://img.shields.io/badge/PixiJS-v8-E91E63?style=for-the-badge&logo=webgl&logoColor=white" alt="PixiJS v8" />
  <img src="https://img.shields.io/badge/GPU%20Accelerated-NVENC%20%2F%20WGC%20%2F%20SCK-10B981?style=for-the-badge" alt="GPU Accelerated" />
</p>

---

## 💡 What is Captr Studio?

**Captr Studio** is a high-performance desktop screen recording and video presentation application designed to produce studio-grade walkthroughs, demos, and educational videos out of the box — **without requiring complex post-production software** like After Effects, Premiere Pro, or DaVinci Resolve.

Raw screen recordings typically look flat and static. Adding smooth cursor motion, intelligent focus zooms, webcam bubbles, and styled canvas frames usually requires hours of tedious keyframing. Captr Studio automates this entirely: **record your screen, and get an interactive, beautifully framed video with auto-zooms and spring physics ready in seconds.**

---

## ✨ Core Features & Capabilities

### 🚀 1. Hardware-Accelerated Screen & Audio Capture
- **Windows Graphics Capture (WGC)**: High-fps DirectX 11 capture engine (`C++`) capable of smooth 60 FPS recording with minimal CPU impact.
- **Native macOS ScreenCaptureKit**: Optimized capture pipeline on macOS 14+ for flawless screen and per-window captures.
- **Pure Native Audio Capture**:
  - **WASAPI Loopback (Windows)**: Crystal clear system sound recording without external virtual audio cables.
  - **ScreenCaptureKit Audio (macOS)**: Native system audio separation and microphone sync.
  - **PipeWire & Web Audio (Linux)**: Robust multi-channel capture.
- **Window & Display Modes**: Record full ultra-wide monitors, specific displays, or individual application windows with clean boundary isolation.

### 🔍 2. Intelligent Auto-Zoom & Cursor Physics
- **Dynamic Auto-Zoom**: Captr Studio tracks hardware cursor activity globally and automatically suggests zoom regions where key clicks or typing occur.
- **Spring Physics Motion Smoothing**: Eliminates jittery hand movements by passing cursor telemetry through real-time spring-damper equations (`mass`, `stiffness`, `damping`).
- **Cinematic Motion Blur**: Temporal and directional motion blur that makes fast camera pans and cursor sweeps look fluid and natural.
- **Interactive Click Effects**: Visual ripple waves, bounce dynamics, and cursor enlargement upon clicking.
- **Custom Cursor Styles**: Switch between macOS aesthetic pointers, minimal crosshairs, glow dots, and custom creative avatars.

### 🎙️ 3. Presenter Webcam Bubble Overlay
- **Floating Picture-in-Picture**: Add a circular or rounded webcam bubble to your recordings.
- **Reactive Zoom**: Webcam bubble can automatically scale and reposition during zoom events to avoid blocking content.
- **Customization**: Independent control over corner radius, drop shadows, borders, mirrors, and free-form timeline positioning.

### ✂️ 4. Intuitive Timeline Video Editor
- **Non-Linear Timeline**: Drag, cut, trim, ripple delete, and reposition video clips with millisecond precision.
- **Speed Ramping**: Accelerate long terminal commands or loading screens with smooth speed transitions (e.g., 2x to 10x) and slow-motion highlights.
- **Integrated Voiceover Recorder**: Record synchronized audio commentary directly over the timeline with live audio metering and waveform visualization.
- **Rich Annotations**: Insert floating text cards, arrows, callout shapes, blur masks for sensitive data, and sticker figure elements.
- **Frame Cropping**: Adjust and crop recorded regions on the fly.

### 🎨 5. Studio Canvas & Frame Styling
- **Curated Backgrounds**: Included high-resolution wallpapers, modern gradients, and solid studio color backdrops.
- **Custom Backgrounds & Videos**: Import your own brand images or looping video wallpapers.
- **Canvas Effects**: Adjustable background Gaussian blur, drop shadows, window border radiuses, and padding.
- **Aspect Ratio Presets**: 1-click formatting for YouTube (16:9), Instagram & TikTok (9:16 vertical shorts), Square (1:1), or traditional (4:3).

### ⚡ 6. Ultra-Fast GPU Export Engine
- **Multi-Backend Rendering via Pixi.js v8**: High-speed WebGL and WebGPU canvas compositing.
- **Native Hardware Encoding**:
  - **NVIDIA NVENC (CUDA Compositor)**: Blazing fast GPU export on RTX/GTX GPUs.
  - **Windows Media Foundation (WMF)**: Native hardware H.264 encoding.
  - **macOS VideoToolbox**: Hardware-accelerated Apple Silicon encoding.
  - **WebCodecs API & FFmpeg**: In-memory chunked export for broad compatibility.
- **Multiple Output Formats**: Export clean MP4 videos with custom bitrates or lightweight looping GIFs with palette optimization.

### 💾 7. Project Persistence (`.captr`)
- Save and resume full edit sessions anytime in the native `.captr` project format.
- Backward compatibility: Seamlessly open and upgrade legacy `.recordly` and `.openscreen` project files.

---

## 🏗️ Architecture & Tech Stack

```
Captr Studio
├── Electron Shell (Process Lifecycle & Native Window Control)
│    ├── Windows IPC (WASAPI, WGC DirectX 11 Capture, CUDA Compositor)
│    ├── macOS IPC (ScreenCaptureKit, VideoToolbox)
│    └── Linux IPC (DesktopCapturer, PipeWire)
├── Renderer Layer (React 18 + Vite + Tailwind CSS)
│    ├── Launch & HUD Overlay (Floating interactive control bar)
│    ├── Non-Linear Timeline Engine (dnd-timeline, GSAP, Motion)
│    └── Compositor Engine (PixiJS v8, WebGL / WebGPU Canvas)
└── Export Pipeline
     ├── Hardware NVENC / WMF / VideoToolbox
     └── WebCodecs + FFmpeg Stream Muxer
```

- **Runtime**: Electron 39, Node.js, TypeScript
- **UI Framework**: React 18, Tailwind CSS, Radix UI Primitives, Phosphor Icons
- **Motion & Canvas**: Pixi.js v8, GSAP, Motion (Framer Motion)
- **Native Kernels**: C++20 (Direct3D11, WGC, Media Foundation, CUDA), Swift (ScreenCaptureKit)
- **Quality & Build**: Biome, Vitest, Vite 5, Electron Builder

---

## 🗺️ Product Roadmap

### 📍 Phase 1: v1.3.x (Current Milestone) — Foundation & Stability
- [x] Complete brand unification to **Captr Studio**
- [x] Stable Windows Graphics Capture (WGC) 60 FPS recording with WASAPI audio loopback
- [x] Real-time spring physics smoothing for cursor trajectories
- [x] Pixi.js v8 canvas rendering for preview and export
- [x] Native GPU export probes (NVIDIA NVENC / CUDA helper support)
- [x] Multi-language support (English, Chinese, Spanish, Portuguese, French, etc.)

### 🚀 Phase 2: v1.4.x (Upcoming Milestone) — Creator Intelligence & Polish
- [ ] **On-Device AI Auto-Captions**: Integrate local Whisper.cpp inference for 100% private, automated subtitles with karaoke word-by-word highlight animations.
- [ ] **Smart Audio Ducking**: Automatically lower background music/system audio when voice activity is detected on the microphone.
- [ ] **Live Screen Drawing**: Annotate directly on the screen with pens, highlighters, and spotlights while recording is in progress.
- [ ] **Export Presets & Platform Templates**: Instant 1-click styling setups optimized for X/Twitter demo videos, YouTube tutorials, and vertical TikTok/Reels.
- [ ] **Extension Marketplace Expansion**: Support for custom device mockups (iPhone, iPad, MacBook, browser address bars).

### 🌟 Phase 3: v2.0 (Major Release) — Collaborative & Cloud Capabilities
- [ ] **Instant Cloud Publish & Stream Sharing**: One-click upload to generate a sharable interactive preview link (Loom / CleanShot alternative).
- [ ] **Multi-Source Recording**: Simultaneously capture multiple windows or multi-monitor feeds and switch angles on the timeline.
- [ ] **Linux Hardware Compositor Parity**: Native Vulkan / VAAPI export acceleration for Linux workstations.
- [ ] **AI Video Summarization & Chaptering**: Automatically generate chapters and description bullet points from audio transcripts.

---

## 🛠️ Development & Building from Source

### Prerequisites

- **Node.js**: >= 20.x
- **Platform Compilers**:
  - **Windows**: Visual Studio 2022 (with "Desktop development with C++" and Windows 10/11 SDK) + CMake. For CUDA export: NVIDIA CUDA Toolkit.
  - **macOS**: Xcode 15+ & Command Line Tools (`xcode-select --install`).
  - **Linux**: GCC/Clang, CMake, `libx11-dev`, `libxtst-dev`, `libxrandr-dev`.

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
# Run unit tests
npm test

# Run code style & linting check
npm run lint

# Format code
npm run format
```

### Packaging Builds

```bash
# Package for current platform
npm run build

# Target specific platform
npm run build:win      # Windows (NSIS installer)
npm run build:mac      # macOS (DMG & Zip)
npm run build:linux    # Linux (AppImage)
```

---

## 📄 License & Acknowledgements

- **License**: Captr Studio is open-source software licensed under the **AGPL 3.0** license.
- **Acknowledgements**:
  - Built upon foundational research and inspirations from [Recordly](https://github.com/webadderallorg/Recordly) and [OpenScreen](https://github.com/siddharthvaddem/openscreen).
  - Special thanks to the open-source community, contributors, and the creators of Pixi.js, FFmpeg, and Electron.
