# Rencana Pengembangan: Slide-Based Multi-Workspace (Captr Studio)

Rencana aksi bertahap (phased implementation plan) untuk implementasi arsitektur slide baru tanpa merusak stabilitas aplikasi yang berjalan saat ini.

---

## Ringkasan Roadmap & Milestone

```
[Phase 1] ──> [Phase 2] ──> [Phase 3] ──> [Phase 4] ──> [Phase 5] ──> [Phase 6]
Core Data     Slide Deck    Modularisasi   Pembuatan     Global Render   Future Slides
& .captr      Bar & Host    RecordSlide    VideoSlide    & Transisi      (Keyframe & Remotion)
```

---

## Phase 1: Core Data Model & Container `.captr`
**Tujuan**: Fondasi data layer multi-slide dan container penyimpanan modular.

- [ ] **1.1. Definisikan Interface & Registry Core**
  - Buat `src/core/slides/types.ts`: `SlideType`, `SlideData`, `SlideModule`, `SlideTransition`.
  - Buat `src/core/slides/registry.ts`: Singleton `SlideRegistry` dengan registrasi modul dinamis.
- [ ] **1.2. Refactor Paket Penyimpanan `.captr` (Electron IPC)**
  - Buat `electron/ipc/project/packageHandler.ts` untuk membaca dan menulis format direktori/bundle `.captr`:
    - Root `project.json`
    - Subfolder `slides/{slide_id}/` beserta aset raw media & `slide.json`.
- [ ] **1.3. Adapter Backward Compatibility (v1 ke v2)**
  - Buat converter otomatis di [projectPersistence.ts](file:///d:/Projects/Captr%20Studio/src/components/video-editor/projectPersistence.ts):
    - Jika project lama (`v1` monolitik) dibuka, otomatis dibungkus menjadi single slide ber-tipe `record` di dalam array `slides[0]`.

---

## Phase 2: Slide Deck Navigator UI & Adaptive Workspace
**Tujuan**: Pengalaman visual multi-slide di frontend.

- [ ] **2.1. SlideDeckContext & State Management**
  - Buat `src/core/slides/SlideDeckContext.tsx`:
    - State: `slides[]`, `activeSlideId`, `transitions[]`.
    - Action: `addSlide(type)`, `deleteSlide(id)`, `reorderSlides(newOrder)`, `setTransition(from, to, type)`.
- [ ] **2.2. Komponen Slide Deck Bar**
  - Buat `src/components/deck/SlideDeckBar.tsx` di bagian bawah layar:
    - Thumbnail card tiap slide.
    - Drag-and-drop reordering.
    - Tombol `[+] Add Slide` (dropdown pilih tipe: Record / Video).
    - Tombol pemilih transisi di antara 2 slide.
- [ ] **2.3. Dynamic Workspace Host**
  - Buat `src/core/slides/SlideWorkspaceHost.tsx`:
    - Mengambil instance `SlideModule` dari `SlideRegistry` sesuai `activeSlide.type`.
    - Me-mount `module.WorkspaceComponent` secara isolatif dengan passing data slide aktif.

---

## Phase 3: Modularisasi `RecordSlide` (Screen Studio Mode)
**Tujuan**: Isolasi fitur Screen Studio yang sudah ada ke dalam modul slide pertama.

- [ ] **3.1. Reorganisasi Kode ke `src/slides/record/`**
  - Pindahkan fungsionalitas viewport, zoom, spring smoothing, dan wallpaper ke `src/slides/record/components/`.
  - Pindahkan data schema auto-zoom & layout ke `src/slides/record/schema.ts`.
- [ ] **3.2. Implementasi Kontrak `SlideModule` untuk Record**
  - Buat `src/slides/record/index.ts`:
    - Export object `recordSlideModule: SlideModule<RecordSlideMeta>`.
    - Daftarkan ke `slideRegistry`.
- [ ] **3.3. Isolasi Aset Media Rekaman**
  - Simpan output file rekaman layar (`.mp4`, `.system.wav`, `.mic.wav`) langsung ke sub-folder slide `slides/slide_xx_rec/`.

---

## Phase 4: Pembuatan Modul `VideoSlide` (CapCut / Filmora NLE Mode)
**Tujuan**: Menyediakan workspace pengeditan multi-track konvensional untuk slide bertipe video.

- [ ] **4.1. Data Schema NLE**
  - Buat `src/slides/video/schema.ts`:
    - Schema track: `VideoTrack`, `AudioTrack`, `TextOverlayTrack`.
    - Schema clip: `sourceUrl`, `startTrimMs`, `endTrimMs`, `speedMultiplier`, `volume`.
- [ ] **4.2. Workspace UI NLE**
  - Buat `src/slides/video/components/VideoSlideWorkspace.tsx`:
    - Media Pool: Import B-roll video, suara, gambar.
    - Multi-Track Timeline: Drag & drop klip pada track berbeda, razor split tool, volume rubber-banding.
    - Preview Player: Compositor multi-layer real-time (video latar + video overlay + teks).
- [ ] **4.3. Implementasi Kontrak `SlideModule` untuk Video**
  - Buat `src/slides/video/index.ts` dan daftarkan ke `slideRegistry`.

---

## Phase 5: Global Render Stitcher & Transition Engine
**Tujuan**: Merender semua slide beserta transisinya menjadi satu file video utuh.

- [ ] **5.1. Per-Slide Chunk Exporter**
  - Setiap slide mengekspor frame-frame dirinya sendiri menjadi temp video MP4 via WebCodecs.
- [ ] **5.2. FFmpeg Transition Stitcher (Electron IPC)**
  - Buat `electron/ipc/export/globalStitcher.ts`:
    - Menghasilkan filtergraph FFmpeg dinamis untuk `xfade` (video) dan `acrossfade` (audio).
    - Menerapkan transisi (crossfade, wipe, slide, zoom) antar slide berdasarkan konfigurasi `transitions[]`.
    - Menambahkan global BGM dengan filter `amix`.
- [ ] **5.3. Export Progress UI**
  - Dialog progress terpadu:
    - Step 1: Render Slide 1/N
    - Step 2: Render Slide 2/N ...
    - Step 3: Stitching & Applying Transitions (FFmpeg)
    - Output final disimpan ke tujuan user.

---

## Phase 6 (Future Extensions): Keyframing & Remotion
**Tujuan**: Membuka kapabilitas video baru secara plug-and-play.

- [ ] **Keyframing Slide (`keyframe`)**: Canvas animasi dengan grafik kurva bezier untuk teks & ikon gerak.
- [ ] **Remotion Slide (`remotion`)**: Embed React composition code untuk animasi terprogram.

---

## Strategi Backward Compatibility & Testing
1. **Zero Regression**: File `.json` atau workspace lama harus otomatis dibuka tanpa prompt error (otomatis dikonversi ke schema single-slide Record).
2. **Sidecar Integrity**: File audio sidecar `.system.wav` dan `.mic.wav` dipindahkan rapi ke dalam folder slide masing-masing.
3. **Automated Smoke Tests**:
   - `scripts/smoke-slide-package.mjs`: Test simpan dan muat file bundle `.captr`.
   - `scripts/smoke-slide-export.mjs`: Test export 2 slide berbeda dengan transisi fade.
