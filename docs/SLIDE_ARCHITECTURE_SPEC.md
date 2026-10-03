# Spesifikasi Arsitektur: Slide-Based Multi-Workspace (Captr Studio)

Dokumen spesifikasi teknis arsitektur modular berbasis **Slide** untuk Captr Studio.

---

## 1. Konsep Utama & Visi UX

Project video tidak lagi monolitik satu timeline panjang. Project dipecah menjadi rangkaian sekuensial **Slides**:

```
+---------------------------------------------------------------------------------+
| TOP BAR: Project Title | Global Audio | Settings | Export                        |
+---------------------------------------------------------------------------------+
|                                                                                 |
|                        ACTIVE SLIDE WORKSPACE HOST                              |
|                                                                                 |
|  [Jika Slide Record Aktif]                 [Jika Slide Video Aktif]             |
|  - Paradigma: Screen Studio                - Paradigma: CapCut / Filmora NLE    |
|  - Auto-zoom, cursor smoothing             - Multi-track timeline               |
|  - Wallpaper backdrop & window shadow      - B-Roll, split/cut, text overlays   |
|  - Quick trim & speed                      - Advanced audio mixing              |
|                                                                                 |
+---------------------------------------------------------------------------------+
| SLIDE DECK BAR (Navigator Bawah):                                               |
| [Slide 1: Record] ──[Crossfade]──> [Slide 2: Video] ──[Slide]──> [+] Add Slide   |
+---------------------------------------------------------------------------------+
```

### Tipe Slide (Slide Types)
1. **Record Slide (`record`)**:
   - Fokus: Perekaman layar, auto-zoom cerdas, smoothing kursor, kamera PiP, background wallpaper estetik.
   - Paradigma: Screen Studio / Recordly.
2. **Video Slide (`video`)**:
   - Fokus: Editing multi-track konvensional (video, audio, B-roll, teks, stiker, efek).
   - Paradigma: CapCut / Filmora.
3. **Keyframing Slide (`keyframe`)** *(Rencana Mendatang)*:
   - Fokus: Animasi grafis gerak presisi tinggi berbasis kurva bezier dan keyframe properti.
4. **Remotion Slide (`remotion`)** *(Rencana Mendatang)*:
   - Fokus: Komposisi video terprogram berbasis React & code-driven motion graphics.

---

## 2. Core Abstraction & Modularity

### A. Kontrak Interface `SlideModule`
Setiap tipe slide diisolasi sebagai modul independen dengan interface baku:

```typescript
// src/core/slides/types.ts
export type SlideType = "record" | "video" | "keyframe" | "remotion";

export interface SlideData<TMeta = unknown> {
  id: string;
  type: SlideType;
  title: string;
  durationMs: number;
  order: number;
  meta: TMeta;
}

export interface SlideTransition {
  id: string;
  fromSlideId: string;
  toSlideId: string;
  type: "none" | "crossfade" | "wipe-left" | "slide-left" | "zoom-in";
  durationMs: number;
}

export interface SlideModule<TMeta = unknown> {
  type: SlideType;
  displayName: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;

  // Workspace View saat slide aktif
  WorkspaceComponent: React.ComponentType<{
    slide: SlideData<TMeta>;
    onUpdateMeta: (updater: (prev: TMeta) => TMeta) => void;
  }>;

  // Thumbnail generator untuk Deck Bar
  generateThumbnail: (slide: SlideData<TMeta>, timeMs: number) => Promise<string>;

  // Frame renderer untuk export pipeline
  renderFrame: (
    slide: SlideData<TMeta>,
    timeMs: number,
    targetCanvas: HTMLCanvasElement | OffscreenCanvas,
  ) => Promise<void>;

  // Audio mix extractor (buffer PCM / WAV)
  renderAudioTrack?: (
    slide: SlideData<TMeta>,
    offlineAudioContext: OfflineAudioContext,
  ) => Promise<AudioBuffer | null>;

  // Schema & default state
  schema: import("zod").ZodSchema<TMeta>;
  createDefaultMeta: () => TMeta;
}
```

### B. Slide Registry Pattern
Komponen core tidak boleh hardcode tipe slide. Registrasi dilakukan via `SlideRegistry`:

```typescript
// src/core/slides/registry.ts
class SlideRegistry {
  private modules = new Map<SlideType, SlideModule<any>>();

  register(module: SlideModule<any>) {
    this.modules.set(module.type, module);
  }

  get(type: SlideType): SlideModule<any> {
    const mod = this.modules.get(type);
    if (!mod) throw new Error(`Slide type not registered: ${type}`);
    return mod;
  }

  getAll(): SlideModule<any>[] {
    return Array.from(this.modules.values());
  }
}

export const slideRegistry = new SlideRegistry();
```

---

## 3. Struktur Project File (`.captr`)

File `.captr` adalah direktori terstruktur (atau zip container) dengan pemisahan aset per slide:

```
my-video-project.captr/
├── project.json                   <-- Root configuration & orchestration
├── assets/                        <-- Global assets (BGM, sound effects umum)
│   └── background-music.mp3
└── slides/
    ├── slide_01_rec/
    │   ├── slide.json             <-- Record slide data (zooms, telemetry, styling)
    │   ├── screen.mp4             <-- Raw screen recording
    │   ├── system.wav             <-- Sidecar system audio
    │   └── mic.wav                <-- Sidecar microphone audio
    │
    ├── slide_02_vid/
    │   ├── slide.json             <-- Video slide data (tracks, clips, cuts, texts)
    │   └── media/
    │       ├── broll-cut1.mp4
    │       ├── overlay-logo.png
    │       └── voiceover.wav
    │
    └── slide_03_remotion/
        ├── slide.json             <-- Remotion props & metadata
        └── src/
            └── Composition.tsx    <-- React motion code
```

### Format Schema `project.json`
```json
{
  "version": "2.0.0",
  "projectId": "proj-uuid-1234",
  "title": "Tutorial Onboarding",
  "canvas": {
    "width": 1920,
    "height": 1080,
    "fps": 60
  },
  "slides": [
    {
      "id": "slide-rec-1",
      "type": "record",
      "title": "Intro Screen Capture",
      "dirName": "slide_01_rec",
      "durationMs": 12500
    },
    {
      "id": "slide-vid-2",
      "type": "video",
      "title": "B-Roll Showcase",
      "dirName": "slide_02_vid",
      "durationMs": 8000
    }
  ],
  "transitions": [
    {
      "id": "trans-1",
      "fromSlideId": "slide-rec-1",
      "toSlideId": "slide-vid-2",
      "type": "crossfade",
      "durationMs": 500
    }
  ],
  "globalAudioTracks": [
    {
      "id": "bgm-1",
      "path": "assets/background-music.mp3",
      "volume": 0.25,
      "fadeInMs": 1000,
      "fadeOutMs": 2000
    }
  ]
}
```

---

## 4. Pipeline Rendering & Transisi Global

Rendering project multi-slide menggunakan pendekatan **2-Tier Pipeline**:

```
[Slide 1: Record] ──> Offscreen Canvas + WebCodecs ──> Temp Video 1 (.mp4) \
                                                                             ├──> [FFmpeg Stitcher & xfade Engine] ──> Final Output MP4
[Slide 2: Video]  ──> Offscreen Canvas + WebCodecs ──> Temp Video 2 (.mp4) /     (+ Global BGM & Audio Mix)
```

### Tahap 1: Slide Chunk Render
1. Setiap slide memanggil `SlideModule.renderFrame()` sesuai durasinya sendiri.
2. Output di-encode menjadi file video sementara (`temp-slide-01.mp4`, `temp-slide-02.mp4`) via WebCodecs atau native encoder.
3. Audio per slide di-render menjadi buffer PCM / WAV sementara.

### Tahap 2: Global Transition Stitcher
1. Electron IPC ([electron/ipc/export/stitcher.ts](file:///d:/Projects/Captr%20Studio/electron/ipc/export/stitcher.ts)) merangkai file video sementara menggunakan FFmpeg `filtergraph`:
   ```bash
   ffmpeg \
     -i temp-slide-01.mp4 -i temp-slide-02.mp4 \
     -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=12.0[vout];[0:a][1:a]acrossfade=d=0.5[aout]" \
     -map "[vout]" -map "[aout]" output.mp4
   ```
2. Global audio tracks (BGM) di-mix di atas hasil crossfade dengan filter `amix`.

---

## 6. Status integrasi & aturan isolasi

### 6.1 Dua model yang hidup (periksa sebelum menambah kode slide)

| Model | Lokasi | Status |
|---|---|---|
| **Editor live** — `clips: ClipEntry[]` + `slideMode: "record" \| "video" \| "motion"` | `src/components/video-editor/VideoEditor.tsx` | ✅ Dipakai UI hari ini (preview, timeline, save, ekspor native) |
| **Registry/deck** — `SlideModule` + `ProjectV2Data.slides` + `SlideDeckContext` | `src/core/slides/*`, `src/slides/*`, `src/components/deck/*` | ⚠️ Sudah diuji unit-test, tetapi **belum di-mount di UI mana pun**: `SlideDeckBar` dan `SlideWorkspaceHost` tidak dirender, sehingga `multiSlideExporter` → `window.electronAPI.stitchProjectSlides` (→ `globalStitcher`) hanya tercapai lewat `MultiSlideExportDialog` |

Jangan asumsikan ekspor multi-slide bisa dicapai dari editor tanpa memasang `SlideDeckBar` terlebih dahulu.

### 6.2 Aturan isolasi antar slide (kontrak)

1. **Sumber audio per slide.** Path sumber (dan sidecar mic/system yang ditemukan dengan cara menempelkan `.mic.wav` / `.system.wav` di path itu) hanya boleh diambil dari slide yang sedang aktif — `resolveSlideAudioSourcePath` (`src/components/video-editor/slideAudioIsolation.ts`). Slide tanpa media sendiri (motion, video kosong) tidak pernah mewarisi path slide sebelumnya.
2. **State editor → clip.** `audioRegions` disimpan di editor selama slide terbuka dan harus di-fold ke clip miliknya saat menyimpan (`foldActiveAudioRegionsIntoClips`); saat memuat, data clip menang dan data top-level legacy hanya diadopsi bila project punya satu slide (`resolveLoadedSlideAudioRegions`).
3. **Transisi diekstrak per pasangan**, bukan posisional: `transitions[i]` = batas `slides[i] → slides[i+1]` (`multiSlideExporter`).
4. **Audio per slide di-probe** sebelum membangun filtergraph; kegagalan probe berarti *silent* (`aevalsrc`), bukan mengasumsikan stream audio ada (`globalStitcher`).
5. **Chunk kosong = gagal cepat** dengan pesan jelas (`slideChunkExporter`), agar berkas media milik slide lain tidak pernah berdiri sebagai hasil slide ini.

### 6.3 Gap yang diketahui

- `motionSlideModule.exportChunk` masih stub (mengembalikan `""`) — ekspor multi-slide yang memuat motion slide akan berhenti dengan pesan jelas sampai *Headless Frame Capture* (bagian 4, `src/slides/motion/README.md`) diimplementasikan.
- `recordSlideModule.exportChunk` mengembalikan berkas rekaman mentah, jadi efek slide record (zoom, cursor, anotasi) belum ter-render pada jalur ekspor ini.
- Tipe transisi `zoom-in` tidak punya padanan FFmpeg `xfade` dan didegradasi ke `crossfade`.

---

## 5. Struktur Direktori Baru Codebase

### A. Renderer Process (`src/`)
```
src/
├── core/
│   ├── slides/                     # Abstraksi inti Slide Engine
│   │   ├── types.ts                # Kontrak SlideModule, SlideData, Transition
│   │   ├── registry.ts             # Registrasi modul
│   │   ├── SlideDeckContext.tsx    # Global State (slides, activeSlide, transitions)
│   │   └── SlideWorkspaceHost.tsx  # Dynamic component mounting
│   └── project/
│       ├── projectPackage.ts       # Pack/unpack folder .captr
│       └── backwardCompat.ts       # Migrasi v1 monolitik -> v2 slide
│
├── slides/                         # FOLDER KHUSUS PER TIPE SLIDE (Domain Modules)
│   ├── record/                     # Modul Slide Record (Screen Studio style)
│   │   ├── components/             # Viewport canvas, auto-zoom controls, backdrop
│   │   ├── hooks/                  # useRecordSlideData, useCursorSmoothing
│   │   ├── render/                 # RecordSlideRenderer (offscreen canvas loop)
│   │   ├── index.ts                # Export SlideModule implementasi
│   │   └── schema.ts               # Zod validation schema
│   │
│   ├── video/                      # Modul Slide Video (CapCut / Filmora style)
│   │   ├── components/             # Multi-track timeline, playhead, media pool
│   │   ├── tracks/                 # VideoTrack, AudioTrack, OverlayTrack
│   │   ├── render/                 # NleSlideRenderer (multi-layer blend)
│   │   ├── index.ts                # Export SlideModule implementasi
│   │   └── schema.ts               # Zod validation schema
│   │
│   ├── keyframe/                   # (Future) Modul Keyframing
│   └── remotion/                   # (Future) Modul Remotion React Video
│
├── components/
│   ├── deck/                       # Slide Deck Bar (Thumbnail list, reorder, [+] add)
│   │   ├── SlideDeckBar.tsx
│   │   ├── SlideThumbnailCard.tsx
│   │   └── TransitionPickerModal.tsx
│   └── ui/                         # Shared UI Primitives (Button, Slider, Modal)
```

### B. Electron Main Process (`electron/`)
```
electron/
├── ipc/
│   ├── project/
│   │   └── packageHandler.ts       # Baca/tulis sub-folder .captr di disk
│   ├── export/
│   │   ├── slideExportSession.ts   # Stream writer per slide
│   │   └── globalStitcher.ts       # FFmpeg multi-input xfade pipeline
│   └── slides/
│       ├── recordCapture.ts        # WGC / ScreenCaptureKit hooks
│       └── videoMediaProbe.ts      # Metadata extractor untuk media B-roll
```
