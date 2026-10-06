# Issue Log & Regression Checklist


## 1. Keyframing engine pada timeline overlay (Text Overlay & Gambar)

**Status:** Selesai dan terverifikasi (3 Oktober 2026).

**Masalah:** Sebelumnya engine keyframing hanya tersedia/diarahkan pada video recording composition clips, dan belum mendukung komponen overlay visual seperti Text Overlay dan aset Gambar pada timeline.

**Penyelesaian & Kontrak:**
- [x] Mendukung `keyframes?: PropertyKeyframe[]` pada `TimelineClip` (properti: `position`, `scale`, `rotation`, `opacity`) dengan waktu relatif terhadap clip (`timeMs`).
- [x] Validasi ketat format, boundary, dan easing curves (`linear`, `ease-in`, `ease-out`, `ease-in-out`, `spring-bounce`, `cubic-bezier`) pada `validateTimelineProject`.
- [x] Engine interpolasi `sampleClipTransform` pada `src/core/timeline/clipTransform.ts` terintegrasi langsung ke `evaluateProject` (`ProjectVisual.transform`) dan `ProjectFrameRenderer`, memastikan sinkronisasi preview canvas dan ekspor video MP4.
- [x] UI `ProjectInspector` menyediakan panel pengaturan keyframe untuk klip overlay teks dan gambar di playhead aktif: penambahan keyframe per-properti (`position`, `scale`, `rotation`, `opacity`), pengaturan easing, serta penghapusan keyframe.
- [x] Penanda visual diamond keyframe pada klip timeline di `TimelineClipItem`.
- [x] Verifikasi unit & integrasi lengkap pada `src/core/timeline/clipKeyframes.test.ts`.

## 2. Audio record pada "Video Record" sering hilang / tidak ter-record


## 3. Menambahkan Record slide meminta project baru

**Status:** perbaikan kode diterapkan pada 27 September 2026; verifikasi alur penuh masih pending.

**Gejala:** menambahkan rekaman kedua ke project yang sudah ada dapat membuat aplikasi meminta menyimpan project baru. Deck juga berisiko terganti ketika referensi video aktif kosong meskipun slide lain sudah ada.

**Akar masalah yang sudah ditemukan:**

- Finalisasi Recorder HUD/native dapat menghapus `currentProjectPath`, sehingga penyimpanan berikutnya kehilangan target `.captr` aktif.
- Jalur capture Windows berjalan melalui `stop-native-screen-recording` dan `mux-native-windows-recording`; jalur ini tidak melewati finalizer macOS yang sebelumnya mengonsumsi flag `preserveProjectPath`. Handler sesi harus mengonsumsi flag tertunda sendiri sebelum memutuskan untuk menghapus path project.
- Kondisi pembuatan Record slide menganggap `videoSourcePath` kosong berarti deck kosong, meskipun daftar slide sudah berisi slide.
- Aset sudah dipisah ke folder slide, tetapi metadata per slide belum memiliki manifest di folder tersebut.

**Kontrak project dan checklist regresi:**

- [x] Rekaman baru ditambahkan selama deck sudah memiliki slide; referensi video aktif bukan penentu apakah deck kosong.
- [x] Konteks `preserveProjectPath` dari Recorder HUD dikonsumsi oleh handler sesi di semua platform; jalur macOS menunda reset path sampai handler sesi. Rekaman project baru tetap tidak memakai path lama.
- [x] Ctrl+S menyimpan kembali ke bundle aktif saat path Electron sempat ter-reset, dengan memverifikasi `projectId` dari `.captr` yang dikirim UI sebelum mengizinkan overwrite.
- [x] Satu project disimpan dalam satu file `.captr`. Setiap slide memiliki folder `slides/<slideId>/` berisi `slide.json` dengan metadata slide dan referensi path bundle-relative, serta aset slide tersebut.
- [x] Verifikasi alur: buka project `.captr`, tambahkan setidaknya dua Record slide, simpan tanpa dialog Save As, tutup lalu buka kembali file yang sama, dan pastikan semua slide serta asetnya utuh.
- [x] Verifikasi khusus Windows: simpan project sebagai `Test 2.captr`, tambahkan Record slide baru, tekan Ctrl+S, pastikan tidak muncul Save As dan file yang sama diperbarui.
- [x] Video/Motion slide dipensiunkan pada 1 Oktober 2026. Bundle lama dengan salah satu jenis tersebut ditolak sebelum state/path/aset aktif berubah; tes bundle nyata memverifikasi file asli tidak berubah.
- [x] Verifikasi UI: membuka bundle lama Video/Motion menampilkan pesan untuk memakai versi Captr sebelumnya, lalu Ctrl+S tetap menyimpan project Record aktif.
- [x] Pastikan Save As eksplisit dan pembuatan project baru tetap membuat file baru.

**Kontrak V3 — Project Assets tanpa Slides (1 Oktober 2026):** kontrak deck/`slides/` di atas adalah histori V1/V2. Project baru memiliki Assets dan timeline independen; finalisasi Record hanya mendaftarkan satu paket source/sidecar/settings ke library.

- [x] Domain V3 mendeduplikasi capture ID; registration menghasilkan nol placement, dan dua placement mempunyai komposisi independen.
- [x] Bundle V3 menyimpan seluruh library di `assets/<assetId>/`, termasuk Record yang belum masuk timeline; `project.json` authoritative, komposisi terpisah, tanpa tulisan `slides/`/`slide.json` baru pada jalur V3.
- [x] Text overlay disimpan sebagai asset metadata tanpa file media; setiap placement membawa salinan teks/style sendiri dan dievaluasi lewat renderer project bersama untuk preview/export.
- [x] Load memvalidasi semua media sebelum memasang workspace; sumber hilang tidak mengganti project aktif. Save gagal mempertahankan bytes bundle dan path aktif.
- [x] Pemulihan target Ctrl+S memverifikasi identitas, termasuk path yang sudah trusted.
- [x] Konverter Record V1/V2 mengutamakan slides canonical, membuat identitas baru, menjaga trim/settings/audio; transitions/extensions dan audio loop/fades yang belum didukung ditolak utuh, tanpa mutasi input.
- [x] Finalisasi Record hanya masuk Assets; stale completion/import tidak masuk project baru. Tes juga memastikan event duplikat tidak mengembalikan aset yang sudah dihapus.
- [x] Native QA: Record dua kali pada `.captr` aktif, Ctrl+S tanpa Save As, buka ulang Assets tanpa timeline dan semua sidecar utuh.
- [x] Native QA: tempatkan Record dua kali, split/trim/rate/edit independen; import video/gambar/audio, preview/export parity, Ctrl+S/reopen.
- [x] Native QA: Save As dan New Project mempertahankan perbedaan path/identitas; konversi eksplisit memakai file baru dan bundle asli tidak berubah.

**Audio Recorder Project Editor (5 Oktober 2026):**

- [x] Audio Recorder menangkap mikrofon saja, di luar Screen Record, dan mengunci posisi klip ke playhead saat rekaman dimulai.
- [x] Take yang selesai didaftarkan sebagai audio Asset terpisah lalu ditempatkan di track audio; undo placement mempertahankan Asset dan redo memulihkan clip ID yang sama.
- [x] Perpindahan Home/New/Open dan penutupan window menawarkan Finish and keep, Discard and continue, atau Stay; take lama tidak dapat masuk ke project baru dan file sementara dibersihkan lewat IPC terbatas.
- [x] Bundle/reopen V3 mempertahankan file audio Asset di `assets/<assetId>/`, termasuk Asset yang tidak ditempatkan, dan clip audio tetap merujuk ke Asset yang benar.
- [ ] Native QA Audio Recorder: record/discard, rekam sambil preview berjalan, playhead anchor, track audio penuh, undo/redo, save/reopen, dan pilihan Finish/Discard/Stay untuk Home/Open/New/window close.

**Instruksi berikutnya:** pertahankan preservasi path native/browser/Windows dan pemeriksaan identitas. Jangan menentukan project kosong dari source aktif. Aset milik library, penghapusan clip tidak menghapus source; seluruh library harus ikut save meskipun timeline kosong. Perbarui checklist ini dan `AGENTS.md` saat kontrak berubah.

**Verifikasi engine V3 (1 Oktober 2026):** bundle nyata menguji seluruh library dan sidecar, atomic save/load serta konversi sebagai copy. Uji browser memakai screen/webcam MP4 dan mic/system WAV nyata: completion duplikat menghasilkan satu Asset tanpa clip, seek acak dan rate 0.5×/2× mempertahankan frame efek pada source time yang sama, offset mic 500 ms terukur tepat. MP4 dari frame hasil edit dan mixer yang sama memiliki selisih rata-rata preview/export 1.51 dari 255 per channel, sesuai kompresi H.264. Tidak ada error console.

**Verifikasi integrasi & siklus V3 (3 Oktober 2026):** implementasi test suite `electron/ipc/register/project/v3LifecycleVerification.test.ts` memverifikasi seluruh skenario lifecycle V3: multi-record berurutan pada bundle aktif `Test 2.captr` mempertahankan path dan lolos in-place Ctrl+S tanpa Save As; sidecar screen, webcam, mic, system audio, dan cursor utuh di `assets/<assetId>/` saat dibuka ulang; penempatan ganda dengan trim/rate/split independen dan import media lolos validasi bundler; penolakan aman bundle legacy Video/Motion mempertahankan active project path; serta konversi copy dan New Project menjaga perbedaan identitas secara ketat. Seluruh 91 tests project di Vitest dan pemeriksaan linter Biome lulus tanpa error.

## Project Home dan penamaan file (4 Oktober 2026)

- Startup normal membuka Home tanpa proyek aktif. New/Open masuk editor setelah validasi; intent Explorer dan pemulihan capture tetap memiliki identitas proyeknya.
- Nama terlihat mengikuti basename file `.captr`, termasuk ekstensi; title internal tanpa ekstensi. Undo/redo tidak mengubah nama file yang sudah committed.
- Rename mempertahankan projectId dan folder, publikasi eksklusif menolak tabrakan, recovery journal melindungi file yang berubah di luar aplikasi. Save As membuat projectId baru dan mempertahankan file asli.
- Back to Home: Save/Discard/Cancel, deactivation hanya setelah guard berhasil. Capture/finalisasi, import, export dan transaksi file memblokir perpindahan.
- Rekaman tambahan tetap Assets-only; seluruh sumber/sidecar termasuk asset tanpa placement tersimpan dalam V3. Dua placement memakai sumber bersama dengan komposisi independen.
- Verifikasi otomatis/browser tercatat di `docs/verification/2026-10-04-project-home-and-naming.md`. QA native Windows (Explorer, file lock, case-only/Unicode, capture berulang dan relaunch recovery) belum dijalankan.
- Final review: listing/recovery library memakai antrean yang sama dengan transaksi file; recovery tidak boleh menyentuh Rename aktif. Rename yang sudah terverifikasi commit tetap berhasil bila cleanup gagal, dengan warning dan journal yang dapat dipulihkan.
- Preparation/finalisasi rekaman memiliki lease di proses utama sampai selesai; completion dengan projectId yang sudah ditinggalkan ditolak. Capture baru tidak boleh mulai selama antrean file masih berjalan.
- Open/Home membekukan edit selama menunggu hasil. Rename/Save As menunggu import/probe media selesai agar aset yang sedang diproses tidak hilang akibat pergantian identitas.

## Transisi visual dan shape V3 (5 Oktober 2026)

- `project.json` V3 menyimpan relasi `clipTransitions` dan animasi masuk/keluar pada clip; field transisi bersifat opsional agar project V3 lama tanpa efek visual tetap bisa dibuka.
- Shape rectangle, ellipse, line, dan arrow adalah asset metadata `shapeDefinition` tanpa file media raster. Style yang diedit pada placement tersimpan di `shapeStyleOverride` clip.
- Relasi transisi menghubungkan dua clip visual yang bersebelahan pada track yang sama. Durasi project tidak berubah; sampling memakai source handle sesuai rate clip, dan transisi ditolak atau dibatasi bila handle tidak cukup. Operasi timeline membersihkan relasi yang tidak lagi valid dan undo memulihkannya.
- Preview dan export menggunakan evaluasi/render frame yang sama. Recording package serta komposisinya tetap utuh dan tidak diratakan sebelum transisi.
- Tes bundle memverifikasi round-trip metadata transisi, animasi, shape, style placement, serta pembukaan project V3 lama tanpa field efek. QA desktop native untuk tambah/edit/duplikasi shape, playback, save/reopen, dan parity preview/export masih pending.

## UX pemisahan track media dan audio (5 Oktober 2026)

- Timeline menampilkan layer visual di atas grup Audio; urutan tampilan visual mengikuti z-order evaluator V3, sementara urutan data project tetap menjadi sumber render.
- Drop otomatis mengikuti jenis aset/clip ke grup yang benar meski dilepas di baris grup lain. Track kompatibel baru dibuat hanya bila rentang waktu beririsan pada baris tujuan; interval yang bersentuhan tetap berbagi track.
- Tes fokus timeline lulus: drop 8/8, tampilan `ProjectTimeline` 5/5, dan `tsc --noEmit` lulus. Suite penuh: 1.148/1.164 lulus; 16 gagal di 8 suite lain (`useProjectController`, `mediaLayerTiming`, `audioEncoder`, `frameRenderer`, `modernFrameRenderer`, `streamingDecoder`, `templateWallpaperSave`, `v3LifecycleVerification`). QA native drag/drop belum dijalankan.

## Sub-Editor ke-3: Multi-Artboard Repurposer & Slice Studio (5 Oktober 2026)

- `repurposeBoard?: RepurposeBoardSettings` tersimpan opsional di `project.json` V3 (backward-compatible; project V3 tanpa repurposeBoard tetap valid dan tidak terpengaruh).
- Multi-artboard canvas sub-editor terpasang docked di bawah `ProjectEditorPanel` (`project-repurpose-subeditor`), dapat dibuka dari topbar (`Repurpose`) dan preview stage panel (`Multi-Artboard Slices`).
- Evaluasi frame master tunggal via `ProjectPreview` (`onRenderedCanvas`) menghindari duplikasi beban decode/render timeline; artboard (9:16 Shorts, 1:1 Square, 4:5 Portrait, 16:9 Landscape) merender frame turunan via framing crop/pan/zoom offset.
- Slicing mini-timeline bar di bagian bawah mendukung razor cut pada playhead (`S`/`C` atau tombol split), penamaan cuplikan, time range badge, penghapusan slice, dan playhead scrubber indicator.
- Batch Export Dialog (`RepurposeBatchExportDialog`) terintegrasi penuh ke `TimelineProjectExporter` dan desktop encoder native: mengekspor kombinasi artboards × slices menjadi MP4 terpisah dengan nama terstruktur (`[Project]_[Slice]_[Aspect].mp4`), progress bar individual + overall, pembatalan aman, dan pemilihan folder output.
- Tes terverifikasi: 186 unit tests lulus 100% (`repurposeCommands.test.ts`, `repurposeFraming.test.ts`, `RepurposeBatchExportDialog.test.tsx`, `timelineProjectExporter.test.ts`, `ProjectEditorPanel.test.tsx`, `ProjectEditor.test.tsx`, dsb.). `graft build` dan `tsc --noEmit` 0 errors.

## Inverted Multi-Artboard Flow & Independent Sequence Editor (5 Oktober 2026)

- **Workflow Inversion:** Membalik alur kerja utama di `ProjectEditor` sehingga saat membuka/membuat project, tampilan default langsung mendarat pada **Multi-Artboard Hub** (`RepurposeBoardEditor`).
- **Double-Click & Edit Gesture:** Double-click pada kartu artboard (atau tombol *Edit* di header kartu) membuka **Individual Project Editor** khusus untuk ukuran/format tersebut.
- **Independent Sequence per Artboard:**
  - `RepurposeArtboard` diperluas dengan field sequence opsional: `tracks?: TimelineTrack[]` dan `clipTransitions?: ClipTransition[]`.
  - Jika belum diedit, artboard mewarisi sequence root (`project.tracks`). Begitu diedit secara individual, modifikasi timeline tersimpan pada sequence mandiri artboard (`updateArtboardProject`) tanpa merusak susunan artboard lainnya.
  - Seluruh artboard tetap berbagi pustaka aset (`assets`, `packages`, `compositions`) yang sama di root project.
- **Navigasi Balik:** Header individual editor menyediakan tombol `← Artboards` (dengan shortcut `Esc`) serta badge format aktif (misal `Shorts (9:16)`). Menekan `Esc` dari timeline editor langsung kembali ke Multi-Artboard Hub.
- **Multi-Sequence Batch Exporter:** `TimelineProjectExporter` dan `RepurposeBatchExportDialog` mendeteksi keberadaan sequence unik artboard; jika ada, exporter langsung merender sequence individu resolusi target tanpa pemotongan master.
- **Status Pengujian:** 28/28 tests pada suite repurpose & editor lulus (100% green), `tsc --noEmit` 0 errors, Biome linter bersih.

## Dynamic Aspect Ratio di Record Editor / Clip Effects Preview (5 Oktober 2026)

- **Ukuran Preview Adaptif:** Monitor preview rekaman di `RecordingCompositionEditor` kini secara dinamis menyesuaikan aspek rasio yang sedang aktif (16:9 Landscape, 9:16 Shorts/Reels/TikTok, 1:1 Square, 4:5 Portrait, 4:3, 16:10, dsb.). Stage canvas dibungkus container `.recording-preview-stage` dengan CSS `aspect-ratio: ${previewCanvas.width} / ${previewCanvas.height}` sehingga bounding stage memeluk proporsi visual secara presisi.
- **Inheritance dari Active Artboard:** Saat Record Editor / Clip Effects dibuka dari artboard individual tertentu di `ProjectEditor` (misalnya artboard 9:16 Shorts 1080x1920), Record Editor otomatis mewarisi rasio dan dimensi canvas artboard tersebut tanpa default paksa ke 16:9.
- **Interactive Aspect Ratio Selector:** Header Record Editor dilengkapi dengan selector aspek rasio interaktif (`<select className="recording-aspect-select">`) yang tersinkronisasi dua arah dengan `SettingsPanel` dan metadata komposisi rekaman.
- **Auto-Reframe Cerdas:** Tombol *Suggest Zooms* secara otomatis mendeteksi rasio target (aspek rasio vertikal/persegi dengan ratio < 1.1) untuk menerapkan algoritma `buildAutoReframeSuggestions` (safe-zone reframing dengan zoom in ~1.5x terpusat pada kursor dan action) alih-alih interaction-zoom landscape standar.
- **Backward-Compatible Schema:** `aspectRatio?: AspectRatio` disimpan secara opsional di `RecordingEffectSettings` (`project.json` V3) tanpa merusak schema rekaman atau proyek versi sebelumnya.
- **Status Pengujian:**
  - 10/10 tests lulus di `src/recording/editor/RecordingCompositionEditor.test.tsx` (termasuk verifikasi canvas 9:16 dan 1:1).
  - 56/56 tests lulus pada agregat suite recording, editor, repurpose, timeline, dan exporter.
  - `npx tsc --noEmit` lolos 0 errors, Biome check lolos.

## Artboard Home, Docked Asset Library & Individual Video Preview (5 Oktober 2026)

- **Artboard Sebagai Halaman Utama Project:** Multi-Artboard Hub difungsikan penuh sebagai halaman beranda authoritative project `.captr`. Transport controls global terpusat dan timeline slicing bar dihilangkan dari canvas view.
- **Docked Project Asset Library:** Panel pustaka aset (`AssetLibrary`) disematkan di sebelah kiri canvas (`repurpose-assets-sidebar`) dengan tombol collapse/expand. Pengguna dapat melihat seluruh aset project (`assets`, `packages`), melakukan import video/gambar/audio, recording layar/webcam, dan audio recording langsung di halaman utama project.
- **Default Artboard Kosong:** `createDefaultRepurposeBoard` kini menginisialisasi `artboards: []` secara default. Halaman menampilkan empty state dengan tombol pilihan rasio instan (9:16, 1:1, 16:9, 4:5, 4:3).
- **Multiple Video & Inline Renaming:** Pengguna dapat memproduksi lebih dari satu video dengan aspek rasio yang sama atau berbeda dari satu source asset project. Judul setiap card video dapat di-rename langsung (inline `<input>` saat klik pensil atau double click judul) dan disimpan via `renameRepurposeArtboard`.
- **Individual Preview Playback per Card:** Setiap card video pada artboard memiliki pemutaran preview independen (`localPlaying`, `localPlayheadUs`), tombol Play/Pause lokal di footer card, display timecode mandiri, dan interactive mini scrubber bar. Memutar satu card secara otomatis mem-pause card lain sehingga audio tidak bentrok.
- **Status Pengujian:** 25/25 tests lulus (100% green) di suite repurpose, commands, dan editor. `npx tsc --noEmit` lolos 0 errors.

## AI Assistant, Offline Whisper STT, Karaoke Subtitles & Hyperframe B-Roll (6 Oktober 2026)

- **AI Autonomous Video Editor Assistant & CLI Bridge (`electron/agentService.ts`):**
  - Bridge terhubung langsung ke eksekutor CLI: Antigravity (`agy`), Claude Code (`claude`), Cursor (`cursor`), Gemini CLI (`gemini`), Ollama (`ollama`), OpenCode (`opencode`), dan Aider (`aider`).
  - Auto-detection lokasi binary lintas `PATH` dan user profile directories.
  - Penataan flag otomatis (`--dangerously-skip-permissions`, `-y`) sebelum prompt argument `-p` agar eksekusi CLI berjalan otomatis tanpa interupsi prompt manual.
  - Streaming stdout/stderr real-time ke jendela UI dengan penanganan pembatalan proses atomik (`agent:cancel`).
- **Context-Aware `@Asset` Tagging:**
  - Input prompt modal AI Assistant mendukung trigger `@` untuk menyematkan metadata spesifik aset (ID, resolusi, durasi, path absolut, dan sidecar audio/subtitles) ke dalam context LLM.
- **Offline Whisper Speech-to-Text & Karaoke Subtitles:**
  - Integrasi runtime native `whisper.cpp` GGML dengan downloader model 1-klik (`tiny`, `base`, `small`, `medium`) dan indikator persentase unduhan.
  - Penandaan waktu kata-per-kata presisi milidetik disimpan dalam berkas sidecar `transcript.json`.
  - Komponen `SubtitleOverlay` interaktif dengan 4 gaya visual (*Karaoke Word Pop*, *Classic*, *Cinematic Box*, *Neon Glow*), penyesuaian bounding box on-canvas, dan sinkronisasi otomatis saat klip dipotong (*ripple cut*).
- **Hyperframe B-Roll Motion Graphics Engine:**
  - Kompilasi grafis berbasis kode HTML5/CSS3/Canvas untuk kinetic typography, kartu kutipan, counter angka, dan efek visual berlapis.
  - Penempatan otomatis pada track B-Roll mandiri di atas video utama dengan relasi layering yang non-destruktif.
- **Status Pengujian & Build:**
  - Seluruh 21/21 vitest tests pada suite AI Assistant & Whisper lulus (100% green).
  - `npx tsc --noEmit` lulus dengan 0 errors. Biome check bersih.

## Hyperframe HTML5 Video & Audio Media Pipeline, Port Re-basing & Official Skills (6 Oktober 2026)

- **Official HyperFrames Skills Added:**
  - Terpasang 21 skills resmi HeyGen HyperFrames di `.agents/skills/` via `npx skills add heygen-com/hyperframes` (`hyperframes`, `hyperframes-core`, `hyperframes-animation`, `hyperframes-audio`, `media-use`, `embedded-captions`, dll.).
- **Dynamic Ephemeral Port Re-basing & Fuzzy Prefix Matching (`preprocessHyperframeHtml`):**
  - Mengatasi issue video layar & webcam hitam (`ERR_CONNECTION_REFUSED`): Electron media server menggunakan port dinamis acak di setiap start. HTML hyperframe yang menyimpan port lama kini otomatis di-rebase ke port aktif live via `buildProjectMediaUrlMap`.
  - Prefix stripping fuzzy match menangani perbedaan prefiks file saat unbundling `.captr` (misal `0-0-0-0-recording-...` vs `0-0-0-0-0-recording-...`).
- **Companion Audio Auto-Injection & Chromium Autoplay Policy:**
  - Mengatasi issue audio rekaman tidak terdengar: video screen recording Captr Studio tidak membawa audio mik di dalam stream video MP4, melainkan file terpisah `*.mic.wav`.
  - `preprocessHyperframeHtml` secara otomatis menginjeksi companion `<audio id="__captr_companion_mic" src="${micUrl}">` jika belum ditulis dalam template.
  - Ditambahkan switch Electron `autoplay-policy: no-user-gesture-required` di `electron/main.ts` agar audio pada sandboxed iframe dapat langsung diputar tanpa gestur klik terpisah.
- **Dynamic Timeline Duration Synchronization:**
  - Mengatasi timeline mentok di 5 detik: saat aset rekaman di-tag (`@asset`), durasi hyperframe (`durationUs`) secara otomatis mengadopsi durasi media sebenarnya (misal 40.9 detik).
  - Skrip sinkronisasi host diinjeksi ke dalam iframe untuk memblokir `requestAnimationFrame` loop mandiri saat dikendalikan scrubber timeline host (`arguments.length >= 3`).
- **Status Pengujian & Build:**
  - 8/8 tests lulus di suite Hyperframe (`HyperframeEditor.test.tsx`, `HyperframePromptInput.test.tsx`, `HyperframePreview.test.tsx`).
  - 6/6 tests lulus di `electron/ipc/agent/hyperframeAgentRunner.test.ts`.
  - `npx tsc --noEmit` lulus dengan 0 errors.
  - `graft build` terbarui (4.921 nodes, 11.920 edges).

## Konsolidasi 21 Skill HyperFrames ke Master Context `HYPERFRAME_RULES.md` (6 Oktober 2026)

- **Master Specification Terpadu (`src/components/hyperframe/templates/HYPERFRAME_RULES.md`):**
  - Mengompilasikan best practices dari seluruh 21 skill resmi HeyGen HyperFrames ke dalam dokumen komprehensif 634 baris yang disesuaikan khusus untuk arsitektur Captr Studio.
  - Memuat 7 bab mendalam: Core Architecture (`#root`, paused GSAP timeline, `window.seekFrame`, `window.getDuration`), Captr Media Pipeline (video live, companion `<audio id="voiceover">`, loopback URLs `http://127.0.0.1:...`, kursor `cursor_telemetry.json`, subtitle `transcript.json`), Layout Patterns (macOS browser mockup, PiP webcam, split screen), Kinetic Typography & Badges, Captr Pastel Design System, 2 Resep Kode Siap Salin (Software Demo Walkthrough & Kinetic Typo Launch), serta Checklist Kualitas.
- **Injeksi Konteks Otomatis ke Semua Agen CLI (`hyperframeAgentRunner.ts`):**
  - Berkas `HYPERFRAME_RULES.md` otomatis disalin ke dalam direktori kerja sementara (`workspaceDir/HYPERFRAME_RULES.md`) setiap kali agent dijalankan.
  - Prompt CLI (`-p`) dan berkas instruksi `TASK.md` memuat arahan wajib agar agen membaca `HYPERFRAME_RULES.md` sebelum menyunting atau menulis kode.
  - Kompatibel 100% lintas CLI agent (`claude`, `agy`, `gemini`, `cursor`, `ollama`, `opencode`, `aider`, dll.) tanpa risiko melanggar batas panjang argumen command-line Windows (`lpCommandLine`).

