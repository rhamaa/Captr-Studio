# 🎥 Captr Studio v1.4.0-beta.1

Welcome to **Captr Studio v1.4.0-beta.1**! This major release transforms Captr Studio into a next-generation AI-assisted video production powerhouse, introducing an autonomous video editing assistant, offline Whisper speech-to-text with word-level karaoke subtitles, a programmatic Hyperframe B-Roll motion graphics engine, a multi-artboard social repurposing workspace, and V3 non-destructive project persistence.

---

### 🌟 Key Highlights

#### 🤖 Autonomous AI Video Editor Assistant & CLI Bridge
- **Multi-Agent CLI Integration**: Directly command your video projects using natural language backed by local or cloud CLI agents: **Antigravity** (`agy`), **Claude Code** (`claude`), **Cursor** (`cursor`), **Gemini CLI** (`gemini`), **Ollama** (`ollama`), **OpenCode** (`opencode`), and **Aider** (`aider`).
- **Context-Aware `@Asset` Mentions**: Type `@` in the prompt to seamlessly attach media assets into the LLM context, feeding file paths, exact durations, resolutions, and speech transcripts.
- **Two-Stage Execution Flow**: Generates structured edit plans before applying timeline operations or rendering B-Roll motion graphics.
- **Real-Time Terminal Streaming**: Live log output with automatic permission bypass (`--dangerously-skip-permissions` / `-y`).

#### ⚡ Hyperframe Motion Graphics B-Roll Engine
- **Code-Driven Visuals**: Compile and render programmatic HTML5/CSS3/Canvas motion graphics into dedicated timeline B-Roll tracks.
- **Dynamic Animation Presets**: Kinetic Typography, Animated Metric / Stat Counters, Minimal Quote Cards, Highlight Pulses, and Lower-Third Headlines.
- **Audio-Reactive SFX**: Synchronized sound effect trigger markers (whoosh, pop, tick, ding) tied directly to animation keyframes.

#### 🎙️ Offline Whisper STT & Animated Karaoke Subtitles
- **100% Private Offline Speech-to-Text**: High-speed native `whisper.cpp` engine running locally on your CPU/GPU.
- **1-Click Model Downloader**: Download and switch GGML models (`tiny`, `base`, `small`, `medium`) directly inside the app with live progress tracking.
- **Word-Level Precision**: Millisecond-accurate timestamping saved to JSON sidecars (`transcript.json`).
- **Interactive SubtitleOverlay**: 4 visual presets (*Karaoke Word Pop*, *Classic Subtitle*, *Cinematic Box*, *Neon Glow*), auto-wrapping, drag & resize handles, and automatic sync with timeline cuts.

#### 📱 Multi-Artboard Repurpose Editor
- **Inverted Canvas Hub**: Simultaneously preview and produce 9:16 Vertical Shorts, 1:1 Square Feeds, 16:9 Landscape Videos, and 4:5 Portrait Carousels.
- **Independent Sequences**: Each artboard maintains its own camera framing and timeline sequence without destroying the master project.
- **Docked Asset Library**: Drag and drop media assets directly onto any artboard canvas.

#### 🗄️ V3 Non-Destructive Project Architecture (`.captr`)
- **Authoritative `project.json`**: Structured storage format with clean asset isolation under `assets/<assetId>/`.
- **Sidecar Bundling**: Companion microphone audio tracks, transcripts, and thumbnails are cleanly bundled and preserved.
- **Atomic Transactions & Recovery**: Fault-tolerant save, rename, and recovery routines prevent project corruption.

---

### 📦 Installation & Upgrade

Download the appropriate installer for your operating system below:

- **Windows**: `Captr Studio-1.4.0-beta.1-Setup.exe` (x64)
- **macOS**: `Captr Studio-1.4.0-beta.1.dmg` (Universal: Apple Silicon & Intel)
- **Linux**: `Captr Studio-1.4.0-beta.1.AppImage` (x64)

Verify artifact integrity using the published `SHA256SUMS.txt` checksum file.
