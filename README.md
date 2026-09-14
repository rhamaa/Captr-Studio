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

## 🗺️ Progress & Implementation Status (Kondisi Proyek Sejauh Ini)

Dokumentasi capaian fitur dan fondasi teknis yang telah selesai diimplementasikan hingga rilis saat ini (**v1.3.0-beta.3**):

### ✅ 1. Brand Identity & Project Unification
- [x] **Konsolidasi Identitas Captr Studio**: Migrasi penuh nama aplikasi, identifier Windows (`studio.captr.app`), dan konfigurasi build.
- [x] **New Official App Icon**: Implementasi logo baru Captr Studio dengan kurva huruf **C** di tengah, lensa rekam menyala, dan integrasi ikon platform lengkap (`.ico`, `.icns`, `.png`).
- [x] **Format Proyek Native (`.captr`)**: Format berkas proyek baru dengan backward compatibility penuh untuk membuka berkas lama `.recordly` dan `.openscreen`.
- [x] **Pembaruan Konfigurasi Distribusi**: Penyelarasan repositori GitHub, issue tracker, dan pipeline rilis ke `rhamaa/Captr-Studio`.

### ✅ 2. Screen & Audio Capture Core
- [x] **Windows Graphics Capture (WGC)**: Helper native C++ (Direct3D 11) untuk perekaman layar penuh dan spesifik jendela aplikasi hingga 60 FPS.
- [x] **macOS ScreenCaptureKit Engine**: Helper native Swift untuk perekaman layar bersih tanpa latency kursor pada macOS 14+.
- [x] **Linux Electron Desktop Capturer**: Pipeline perekaman fallback untuk lingkungan desktop Linux.
- [x] **Native WASAPI Audio Loopback (Windows)**: Perekaman suara sistem jernih tanpa memerlukan virtual audio cable eksternal.
- [x] **Multi-channel Microphone Capture**: Perekaman mikrofon simultan dengan isolasi track dan browser fallback audio mixing.

### ✅ 3. Smart Motion & Cursor Physics
- [x] **Global Hardware Cursor Tracking**: Pelacakan posisi dan event klik mouse secara real-time via `uiohook-napi` dan native monitor.
- [x] **Spring Physics Smoothing**: Peredaman getaran gerakan tangan kursor menggunakan kalkulasi spring-damper (*mass, damping, stiffness*).
- [x] **Intelligent Auto-Zoom**: Analisis aktivitas kursor otomatis yang mendeteksi fokus klik dan menghasilkan saran region pembesaran kamera.
- [x] **Motion Presentation Effects**: Efek *motion blur* sinematik, *click ripples* visual saat mouse ditekan, dan *cursor bounce*.
- [x] **Cursor Aesthetic Presets**: Pilihan style kursor (macOS pointer, Tahoe, minimal dot, crosshair, dll.).

### ✅ 4. Presenter Webcam Overlay
- [x] **Floating Picture-in-Picture Bubble**: Overlay kamera depan melayang dengan kontrol posisi drag-and-drop.
- [x] **Styling & Effects**: Pengaturan ukuran, radius sudut lingkaran (*roundness*), bayangan (*drop shadow*), border, dan opsi cermin (*mirror*).
- [x] **Zoom-Reactive Scaling**: Bubble kamera otomatis menyesuaikan skala dan posisi saat kamera melakukan auto-zoom agar tidak menutupi materi penting.

### ✅ 5. Non-Linear Timeline Video Editor
- [x] **Interactive Multi-track Timeline**: Editor visual dengan dukungan *clip trimming, cutting, splitting*, dan *ripple delete*.
- [x] **Speed Ramping (变速)**: Akselerasi bagian video tertentu (1x hingga 10x) untuk melewati proses panjang, serta opsi *slow-motion*.
- [x] **Voiceover Narration Recorder**: Perekam suara narasi pengisi langsung di timeline lengkap dengan VU meter dan visualisasi level audio.
- [x] **Rich Canvas Annotations**: Penambahan teks bergaya, kartu judul, bentuk/panah penunjuk, efek sensor blur, dan stiker figur.
- [x] **Dynamic Cropping Tool**: Pemotongan area bingkai video sesuai kebutuhan presentasi.

### ✅ 6. Studio Canvas & Frame Styling
- [x] **Wallpaper & Background Presets**: Pustaka latar belakang bawaan beresolusi tinggi, gradien modern, dan warna studio solid.
- [x] **Custom Background Import**: Dukungan impor gambar latar kustom dan video wallpaper berulang (*looping video*).
- [x] **Framing Controls**: Pengaturan keburaman latar (*gaussian blur*), bayangan bingkai (*drop shadow*), radius sudut jendela, dan *padding*.
- [x] **Preset Aspek Rasio**: Format 1-klik untuk YouTube (16:9), TikTok/Reels/Shorts (9:16), Square (1:1), dan klasik (4:3).

### ✅ 7. High-Performance GPU Export Pipeline
- [x] **Dual Rendering Engine (Pixi.js v8)**: Compositor grafis berperforma tinggi berbasis WebGPU dan WebGL.
- [x] **Hardware Video Encoding (NVENC / CUDA)**: Akselerasi ekspor berbasis NVIDIA CUDA compositor C++ helper.
- [x] **Windows Media Foundation & macOS VideoToolbox**: Akselerasi encoder hardware H.264 bawaan sistem operasi.
- [x] **Universal WebCodecs + FFmpeg**: Pipeline encoding dalam memori dengan stream-copy muxing untuk stabilitas universal.
- [x] **Multi-format Output**: Ekspor video MP4 resolusi penuh dan GIF animasi ringan dengan optimasi palet warna.

### ✅ 8. Settings & Multi-language Localization
- [x] **Dukungan 10 Bahasa (i18n)**: English, Chinese (Simplified & Traditional), Spanish, Portuguese (pt-BR), French, Russian, Korean, Dutch, Italian.
- [x] **Persistent Preferences**: Penyimpanan pengaturan tema (`captr.theme`), shortcut keyboard kustom, dan preferensi countdown rekam.

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
