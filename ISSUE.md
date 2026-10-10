# Issue Log & Regression Checklist

**Fokus berikutnya — 10 Oktober 2026:** [Issue #12: kepemilikan Assets global dan elemen lokal Story](#12-pemisahan-assets-global-elemen-story-dan-komposisi-record-10-oktober-2026). Keputusan produk disepakati; implementasi dan QA belum dimulai. Timeline pengerjaan tercatat di [ROADMAP.md](ROADMAP.md), kondisi pengembangan di [CHANGELOG.md](CHANGELOG.md).


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

## Hyperframe Chatbot Thread UI, Instant Live Code Update & Snapshot Versioning (6 Oktober 2026)

- **Chatbot Conversation Thread (`HyperframeEditor.tsx`):**
  - Redesign panel agent Hyperframe menjadi tampilan thread percakapan modern layaknya UI chatbot (ChatGPT/Claude/Copilot).
  - Postingan pengguna (*user bubble*) menampilkan teks prompt, chip aset ter-tag (`@asset`), target agent, dan timestamp.
  - Respon asisten AI (*assistant card*) menampilkan status eksekusi real-time (*Streaming*, *Applied*, *Error*), ringkasan versi yang dibuat, serta tombol aksi cepat untuk mengaktifkan versi tersebut pada canvas.
  - Monospace terminal stream logs kini dibuat *collapsible* per pesan (`Terminal Stream (X lines)` + Caret toggle), auto-expand saat streaming berjalan agar pengguna dapat memantau log proses CLI tanpa memakan ruang layar permanen setelah selesai.
- **Instant Live Code & Stage Preview Update:**
  - Begitu agen CLI selesai menghasilkan kode HTML, output langsung memperbarui state `codeDraft` dan `hyperframe.htmlContent` seketika tanpa perlu tindakan manual.
  - Iframe stage canvas langsung memuat ulang preview (`srcDoc = preprocessHyperframeHtml(...)`) sehingga perubahan visual langsung terlihat di stage.
- **Sistem Versioning Snapshot Sebelum Save (`HyperframeVersionSnapshot`):**
  - Struktur snapshot versi (`v1`, `v2`, `v3`, dst.) disematkan pada skema `HyperframeComposition` (`src/core/story/storyTypes.ts`).
  - *Version Ribbon Strip* di bagian atas panel menampilkan pil untuk setiap versi (`v1 Initial Draft`, `v2 Showcase`, dll.) beserta indikator versi aktif.
  - Pengguna dapat melompat maju-mundur antar versi (`handleSwitchVersion`) sebelum memutuskan menyimpan project: canvas dan editor kode langsung berganti ke versi yang dipilih.
  - Banner mengambang (*Historical Version Notice*) otomatis tampil di atas viewport canvas saat melihat versi terdahulu, dengan tombol *Back to Latest* untuk kembali cepat ke versi mutakhir.
- **Status Pengujian & Build:**
  - 7/7 tests lolos di `src/components/hyperframe/HyperframeEditor.test.tsx` (100% green).
  - `npx tsc --noEmit` lolos 0 errors.
  - `graft build` terbarui (4.925 nodes, 11.927 edges).

## Hyperframe MP4 Video Export & Offscreen Chromium Rendering Pipeline (7 Oktober 2026)

- **Offscreen Chromium Frame Stepper & Exporter Engine (`hyperframeExportEngine.ts`):**
  - Membuat engine rendering offscreen berbasis Electron `BrowserWindow` (`offscreen: true`) yang memuat komposisi HTML Hyperframe tanpa menampilkan jendela fisik.
  - Mengendalikan timeline GSAP dan elemen media frame-per-frame secara presisi (`window.seekFrame(timeSec)` dan deteksi event `seeked` pada seluruh elemen `<video>`), mencegah stuttering dan frame drop.
  - Menangkap buffer frame mentah 32-bit BGRA secara native di proses utama Electron (`webContents.capturePage({ width, height })`), mengeliminasi overhead transfer IPC dari renderer ke main process.
- **Hardware-Accelerated Encoding & Audio Muxing via FFmpeg:**
  - Streaming buffer bitmap mentah langsung ke `stdin` proses FFmpeg (`-f rawvideo -pix_fmt bgra`).
  - Auto-resolusi hardware encoder tercepat (`h264_nvenc`, `h264_qsv`, `h264_amf`, `h264_videotoolbox`, atau fallback `libx264`).
  - Muxing otomatis companion audio (`*.mic.wav` / `*.sys.wav`) ke dalam berkas akhir MP4 dengan `-c:v copy -c:a aac -b:a 192k` tanpa desinkronisasi suara.
- **Export Modal UI & Integrasi Header (`HyperframeExportModal.tsx`, `HyperframeEditor.tsx`):**
  - Tombol **Export MP4** disematkan di top header `HyperframeEditor`.
  - Dialog modal interaktif menyediakan pilihan preset:
    - Resolusi: Native 100% (1920×1080 / 1080×1920 / 1:1), 4K Ultra HD, 720p.
    - Framerate: 60 fps (Smooth Motion, recommended) atau 30 fps (Standard Web).
    - Kualitas: Balanced (12 Mbps), High Quality (24 Mbps), Fast (6 Mbps).
    - Audio Toggle: Opsi menyertakan companion audio track atau video bisu (*mute*).
    - File destination picker via native `showSaveDialog`.
  - Tampilan progress bar animasi real-time dengan status per frame (`Rendering frame X of Y`, persentase, dan indikator stage).
  - Tampilan sukses dengan tombol *Open in Folder* untuk langsung melihat file video hasil export di file explorer.
- **Status Pengujian & Build:**
  - 12/12 unit tests lulus (100% green) di `hyperframeExportEngine.test.ts`, `HyperframeExportModal.test.tsx`, dan `HyperframeEditor.test.tsx`.
  - `npx tsc --noEmit` lolos dengan 0 errors.
  - `graft build` terbarui (4.946 nodes, 11.973 edges).

## Tldraw Infinite Canvas Whiteboard Integration (7 Oktober 2026)

**Status:** Selesai dan terverifikasi penuh (7 Oktober 2026).

**Tujuan & Ringkasan:**
Mengintegrasikan infinite canvas whiteboard menggunakan `@tldraw/tldraw` ke dalam Repurpose Hub Captr Studio, memungkinkan brainstorming visual bebas (catatan teks/sticky notes, panah konektor, bentuk geometris, bingkai, sketsa tangan bebas) berdampingan langsung dengan video artboard (Story) dan Hyperframe code-driven cards interaktif secara live.

**Kontrak Desain & Implementasi:**
1. **Offline & Air-Gapped Asset Bundling (`tldrawAssets.ts`):**
   - Menghubungkan asset URLs tldraw ke bundel lokal offline (`@tldraw/assets/urls`) tanpa dependensi jaringan ke unpkg atau CDN publik (`getTldrawOfflineAssetUrls()`).
   - Mencegah kegagalan rendering icon/font/translation pada mesin terisolasi tanpa internet.
2. **Studio Dark Theme Styling (`whiteboardTheme.css`):**
   - Mengintegrasikan styling tldraw dengan tema dark slate Captr Studio (`#15171C`, `#1C1F26`, aksen `#6FA8FF`, dan seleksi `#A879F5`).
3. **Custom Tldraw Shapes & Pointer Event Isolation (`ArtboardCardShapeUtil`, `HyperframeCardShapeUtil`):**
   - Kartu artboard Story dan Hyperframe dirender sebagai custom tldraw box shape (`artboard-card` dan `hyperframe-card`).
   - Pointer events pada kontrol pemutaran video, scrubber timecode, framing pan/zoom, dan tombol aksi diisolasi penuh (`stopPropagation()`), sehingga manipulasi video tidak memicu seleksi kotak tldraw atau pergeseran canvas yang tidak disengaja.
   - Guardrail `activePlayingId`: hanya satu kartu video/audio decode yang aktif berputar dalam satu waktu untuk mencegah overhead hardware.
4. **V3 Persistence Contract & Round-trip Compatibility:**
   - Menyimpan seluruh status canvas dan anotasi ke field opsional `TimelineProject.whiteboardSnapshot` di dalam berkas authoritative `.captr` (`project.json`).
   - Sepenuhnya backward-compatible dengan project V3 yang belum memiliki snapshot. Proyek baru/lama tanpa snapshot otomatis menata artboard dalam layout kisi bersih (`calculateInitialCardPositions`).
   - Validasi ketat pada `validateTimelineProject`: snapshot harus berupa objek valid, tidak mengganggu pipeline ekspor video maupun metadata timeline.
   - Sinkronisasi dua arah otomatis (`syncProjectCardsToCanvas`): penambahan atau penghapusan kartu artboard/hyperframe langsung menyelaraskan shape di canvas tldraw.
5. **Status Pengujian & Verifikasi:**
   - Unit tests offline assets, schema validation, custom shapes, whiteboard sync, dan e2e persistence bundle (`tldrawAssets.test.ts`, `whiteboardSnapshot.test.ts`, `customShapes.test.ts`, `whiteboardSync.test.ts`, `whiteboardIntegration.test.ts`) lolos 100%.
   - Seluruh test suite Repurpose (`8/8` test files, `19/19` tests) lolos tanpa regresi.
   - `npx tsc --noEmit` lolos dengan 0 errors.

## Seamless AI Agent CLI Integration, Local MCP Server & Speculative Timeline Preview (9 Oktober 2026)

**Status:** Selesai dan terverifikasi penuh (9 Oktober 2026).

**Tujuan & Ringkasan:**
Mentransformasikan integrasi AI Agent CLI (`agy`, `claude`, `opencode`) yang sebelumnya kaku (modal pop-up tertutup, one-shot prompt, edit raw JSON file mentah) menjadi integrasi terpadu yang seamless:
1. **In-Context Copilot Dock / Sidebar (`CopilotSidebar.tsx`):**
   - Menggantikan modal pop-up dengan panel samping terintegrasi di `ProjectEditor.tsx`.
   - Non-blocking: Pengguna bebas scrub playhead timeline, play/pause video, klik clip, dan melihat whiteboard secara simultan selagi agen memproses.
   - Context-aware: Panel otomatis menampilkan playhead saat ini, klip yang sedang dipilih, artboard aktif, dan status koneksi MCP Server.
2. **Local Captr MCP Server & Structured Editing Tools (`mcpServer.ts`, `agentTools.ts`):**
   - Menyediakan server Model Context Protocol (MCP) lokal berbasis HTTP SSE & JSON-RPC di proses Electron.
   - Menyediakan toolset terstruktur:
     - `get_project_context`: Mengembalikan ringkasan proyek lengkap termasuk trek, klip, durasi, paket rekaman, transkrip kata, telemetri kursor, artboards, dan catatan whiteboard.
     - `propose_edit_plan`: Mengirimkan rencana editing sebelum mengeksekusi.
     - `split_clip`: Memotong klip pada timestamp tertentu (mendukung format mikrodetik maupun detik).
     - `trim_clip`: Mengatur ulang in/out boundaries klip.
     - `remove_silence`: Menghapus jeda hening tersinkronisasi lintas semua trek yang tidak dikunci.
     - `add_broll_or_overlay`: Menambahkan B-Roll atau teks overlay.
     - `preview_speculative_edits`: Menghasilkan ghost preview diff di timeline.
     - `commit_edits`: Menerapkan perubahan langsung ke `ProjectController.execute` dengan riwayat Undo/Redo penuh.
3. **Speculative Ghost Preview Timeline (`ProjectTimeline.tsx`, `projectEditor.css`):**
   - Menampilkan klip rancangan spekulatif sebagai klip semi-transparan bergaris putus-putus (*ghost clips*) di timeline sebelum di-commit.
   - Mendukung penambahan track baru dari spekulasi (`✨ Draft Track`) dan ekspansi durasi visual timeline otomatis.
   - UI menyediakan banner konfirmasi dengan tombol **Accept Changes** (masuk ke Undo stack) dan **Reject**.
4. **Dual Connection Mode (UI Runner + External Terminal MCP Connect):**
   - UI Copilot Sidebar dapat menjalankan agen CLI lokal secara otomatis (`agy`, `claude`).
   - Agen eksternal di terminal mana pun (VSCode/Windows Terminal) dapat terhubung ke Captr Studio yang sedang berjalan via endpoint SSE MCP (`http://127.0.0.1:39420/sse`).
5. **Status Pengujian & Build:**
   - 39/39 targeted agent tests lolos 100% di `agentTools.test.ts`, `mcpServer.test.ts`, `CopilotSidebar.test.tsx`, `ProjectTimeline.test.tsx`, `ProjectEditor.test.tsx`, `agentRunner.test.ts`, dan `agentDetector.test.ts`.
   - `npx tsc --noEmit` bersih tanpa error (exit code 0).
   - `graft build` diperbarui (5.044 nodes, 12.229 edges).

## 8. Integrasi Terminal Interaktif & Konfigurasi Terminal Level Project .captr V3 (9 Oktober 2026)

**Status:** Selesai dan terverifikasi (9 Oktober 2026).

**Kebutuhan & Tantangan:**
- Integrasi agen CLI AI (`agy`, `claude`, `codex`, dll.) membutuhkan lingkungan terminal nyata yang langsung membuka direktori kerja proyek `.captr` aktif lengkap dengan environment variable context proyek dan MCP Server.
- Pengaturan terminal harus dapat dikonfigurasi per-proyek (level `.captr`), disimpan secara authoritatif di `project.json` tanpa merusak kompatibilitas mundur schema V3.

**Solusi & Arsitektur yang Diterapkan:**
1. **Interactive Terminal Service (`electron/ipc/terminal/terminalService.ts`):**
   - Menggunakan streaming multi-session process spawns (`powershell`, `cmd`, `bash`) yang terhubung langsung ke frontend `@xterm/xterm` via IPC tanpa ketergantungan toolchain compiler C++ native yang berat (`node-pty`).
   - Menyiapkan direktori workspace proyek `.captr` dengan sidecar `.mcp.json` otomatis sehingga CLI tools langsung mengenali endpoint local Captr MCP server.
   - Menginjeksi environment variables: `CAPTR_PROJECT_PATH`, `CAPTR_PROJECT_ID`, `CAPTR_WORKSPACE_DIR`, `CAPTR_MCP_PORT`, `CAPTR_MCP_URL`, `CAPTR_MCP_SSE`, serta custom env yang ditentukan di proyek.
   - Mendukung peluncuran eksternal ke Windows Terminal (`wt.exe` / `powershell.exe`) dan membuka workspace di VS Code / Cursor via tombol di toolbar.
2. **Konfigurasi Terminal di Level Project Schema V3 (`ProjectTerminalConfig`):**
   - Menambahkan `ProjectTerminalConfig` opsional di `src/core/timeline/types.ts`: `preferredShell` (`default`, `powershell`, `cmd`, `bash`), `startupCommand` (perintah otomatis saat shell dimulai), dan `customEnv` (key-value custom env vars).
   - Validasi ketat di `src/core/timeline/validation.ts`.
   - Command undoable `updateProjectTerminalConfig` di `src/core/timeline/commands.ts`.
3. **Project Terminal Config UI & Drawer (`ProjectTerminal.tsx`, `ProjectTerminalConfigDialog.tsx`, `StoryEditor.tsx`):**
   - Tombol **Project Settings** di toolbar terminal membuka modal pengaturan khusus untuk menyimpan preferensi terminal ke file `.captr` yang sedang dibuka.
   - Drawer Terminal terintegrasi di `StoryEditor.tsx` yang dapat di-toggle melalui footer bar button atau shortcut keyboard `Ctrl + \`` / `Cmd + \``.
   - Tab **Terminal / Dev** tetap tersedia di `AppSettingsDialog.tsx` untuk konfigurasi preferensi global.
4. **Verifikasi:**
   - Unit tests untuk `terminalService.test.ts`, `ProjectTerminal.test.tsx`, `ProjectTerminalConfigDialog.test.tsx`, dan `StoryEditor.test.tsx` lulus 100%.
   - `tsc --noEmit` lolos tanpa error.

## 9. Optimalisasi & Penambahan Fitur Video Editor Pro (NLE) pada Story Editor (9 Oktober 2026)

**Status:** Selesai dan terverifikasi (9 Oktober 2026).

**Kebutuhan & Tantangan:**
- Story Editor membutuhkan fungsionalitas dan alur kerja standar Non-Linear Editor (NLE) profesional yang cepat dan intuitif, setara dengan editor video modern.
- Kontrol kanvas, aspect ratio, frame stepping, timecode SMPTE, pembagian timeline cerdas, dan kontrol transform clip harus terintegrasi rapi dengan arsitektur timeline V3 dan sistem undo/redo.

**Fitur yang Diimplementasikan:**
1. **Pro Transport & Playback Control Bar (`StoryEditor.tsx`):**
   - **SMPTE Timecode Display:** Mengubah tampilan detik mentah menjadi format timecode profesional `MM:SS:FF` berbasis framerate proyek aktif (`formatTimecode`).
   - **Frame-by-Frame Stepping:** Tombol step mundur (`<`) dan step maju (`>`) tepat 1 frame kalkulasi mikrodetik (`1,000,000 / fps`).
   - **Jump to Start / End:** Tombol navigasi instan ke awal (0s) atau akhir timeline.
   - **Loop Playback:** Toggle loop berulang saat memutar preview (`L`).
   - **Rule-of-Thirds & Social Safe Zones Overlay:** Overlay grid panduan 3x3 dan batas aman social video (TikTok/Reels/Shorts) untuk memastikan framing subjek tidak tertutup UI platform.
   - **Fullscreen Preview:** Toggle preview layar penuh dengan shortcut `F` atau `Escape`.
2. **Contextual Canvas Story Inspector (`CanvasProjectInspector.tsx`):**
   - Menggantikan tampilan kosong ("Select a clip to edit") dengan Canvas Inspector saat tidak ada clip yang dipilih.
   - Preset aspect ratio 1-klik: **16:9 Landscape** (1920×1080), **9:16 Vertical** (1080×1920), **1:1 Square** (1080×1080), **4:5 Portrait** (1080×1350), **21:9 Ultrawide** (2560×1080).
   - Pengaturan resolusi kustom (Lebar, Tinggi) dan framerate (24, 30, 60 fps).
   - Kartu statistik cerita: Total durasi, jumlah clip, jumlah video track, dan audio track.
   - Aksi cepat track: Tambah Video Track dan Tambah Audio Track langsung dari inspector.
3. **Clip Transform & Audio Controls (`ProjectInspector.tsx`):**
   - Tombol **Reset Transform** (mengembalikan X: 0, Y: 0, Scale: 1, Rotation: 0, Opacity: 1).
   - Tombol **Center Clip** (memusatkan koordinat clip ke pusat kanvas X: 0, Y: 0).
   - Tombol **Instant Mute Toggle** di samping slider volume clip.
   - Preset kecepatan playback yang diperluas: 0.25x hingga 2x.
4. **Smart Split Timeline Toolbar (`TimelineToolbar.tsx` & `ProjectTimeline.tsx`):**
   - Fitur smart split: Tombol Split dapat aktif meskipun tidak ada klip yang dipilih secara manual, selama terdapat klip di bawah playhead pada trek aktif yang tidak terkunci.
   - Tombol **Toggle Clip Enable/Mute** (`Eye` icon) langsung di toolbar timeline.
5. **NLE Keyboard Shortcuts Global:**
   - `Space`: Play / Pause.
   - `ArrowLeft` / `ArrowRight`: Step mundur / maju 1 frame.
   - `Shift + ArrowLeft` / `Shift + ArrowRight`: Step mundur / maju 1 detik.
   - `Home` / `End`: Lompat ke awal / akhir timeline.
   - `S` / `C`: Split clip di posisi playhead.
   - `Delete` / `Backspace`: Hapus clip terpilih.
   - `Shift + Delete`: Ripple delete clip terpilih.
   - `Ctrl + D`: Duplicate clip terpilih.
   - `F`: Toggle Fullscreen preview.
   - `L`: Toggle Loop playback.
6. **Commands Timeline Baru (`src/core/timeline/commands.ts`):**
   - `updateProjectCanvas(project, canvas)`: Memperbarui dimensi dan fps dengan validasi schema ketat.
   - `resetClipTransform(project, clipId)`: Mereset transformasi visual ke default.
   - `toggleClipEnabled(project, clipId)`: Mengaktifkan/menonaktifkan klip di timeline.
7. **Pengujian & Verifikasi:**
   - 39/39 tests lolos di `commands.test.ts`, `CanvasProjectInspector.test.tsx`, `ProjectInspector.test.tsx`, `ProjectTimeline.test.tsx`, dan `StoryEditor.test.tsx`.
   - `npx tsc --noEmit` lolos tanpa error.

## 10. Preview Workspace Zoom/Pan & Direct On-Canvas Drag-and-Drop Manipulasi Koordinat (9 Oktober 2026)

**Status:** Selesai dan terverifikasi (9 Oktober 2026).

**Kebutuhan & Tantangan:**
- Pengguna membutuhkan kemampuan zoom in dan zoom out pada area workspace preview video untuk melihat detail framing kanvas secara dekat maupun gambaran utuh.
- Aset-aset overlay (teks, shape, gambar, video, rekaman) harus dapat digeser dan diposisikan langsung di kanvas preview (direct manipulation drag-and-drop koordinat).
- Rasio aspek (16:9, 9:16, 1:1, 4:5, 21:9) harus tetap terkunci secara tegas sesuai kontrak awal story tanpa terdistorsi saat di-zoom atau di-pan.

**Solusi & Fitur yang Diimplementasikan:**
1. **Preview Workspace Zoom & Pan Controls (`StoryEditor.tsx`, `projectEditor.css`):**
   - **Preset Zoom & Selector:** Tombol Zoom Out (`-`), Dropdown Zoom (`Fit (Auto)`, `25%`, `50%`, `75%`, `100%`, `125%`, `150%`, `200%`, `300%`), Tombol Zoom In (`+`), dan tombol reset kembali ke `Fit`.
   - **Interactive Wheel Zoom:** Menahan `Ctrl` / `Cmd` sambil scroll mouse wheel di atas area preview melakukan zoom in/out secara interaktif dan dinamis.
   - **Pan Workspace Gesture:** Ketika dalam mode zoom (`previewZoom !== "fit"`), menahan tombol tengah mouse (middle click) atau `Shift + Left Click` memungkinkan pengguna melakukan panning bebas ke seluruh penjuru kanvas dengan kursor `grab` / `grabbing`.
   - **Strict Aspect Ratio Guarantee:** Kontainer preview dibungkus dengan `.project-preview-zoom-wrapper` dengan properti CSS eksplisit `aspectRatio: ${width} / ${height}` dan letterboxing/pillarboxing otomatis sehingga rasio gambar tidak pernah melar atau menyusut tidak proporsional.
2. **Direct On-Canvas Drag-and-Drop & Transform Gizmo (`CanvasTransformGizmo.tsx`):**
   - **Single-Gesture Instant Select & Drag:** Mengklik klip visual mana pun di kanvas preview (teks overlay, shape, gambar, video) langsung memilih klip tersebut dan seketika memulai translasi pergeseran koordinat dalam satu kali klik-dan-tarik halus tanpa jeda.
   - **Window-based Pointer Tracking (60 FPS):** Menggunakan event listener level window dengan penangkapan delta akurat yang dinormalisasi terhadap faktor skala kanvas (`scaleFactorX`, `scaleFactorY`), menjaga kursor terkunci tepat di bawah titik objek terlepas dari zoom preview atau resolusi layar.
   - **Real-time Coordinates HUD Tooltip:** Tooltip mengambang muncul di atas objek yang sedang digeser menampilkan nilai koordinat kanvas aktif secara live (`X: +120px  Y: -45px`).
   - **8-Point Resize Handles & Rotation Stem:** Tetap dapat mengubah ukuran skala dan memutar sudut rotasi objek visual langsung di atas kanvas.
   - **Undo/Redo Integrity:** Posisi pergeseran dikomit saat `pointerup` melalui command `updateClip` ke `ProjectController.execute`, menjaga riwayat undo/redo tetap bersih.
3. **Drop Asset dari Library Langsung ke Atas Kanvas:**
   - Menyeret kartu aset dari Asset Library dan menjatuhkannya (drop) langsung ke atas kanvas preview otomatis menghitung posisi pointer menjadi koordinat kanvas lokal dan menempatkan aset pada playhead aktif (`handleDropAssetOnCanvas` via `placeAsset` dengan parameter `transform: { x, y }`).
4. **Pengujian & Verifikasi:**
   - 44/44 unit tests lolos 100% (`CanvasTransformGizmo.test.tsx`, `StoryEditor.test.tsx`, `CanvasProjectInspector.test.tsx`, `ProjectInspector.test.tsx`, `ProjectTimeline.test.tsx`, `commands.test.ts`).
## 11. Perbaikan Infinite Re-render Loop & Freeze Interaksi pada Story Editor (9 Oktober 2026)

**Status:** Selesai dan terverifikasi (9 Oktober 2026).

**Gejala Masalah:**
- Pada saat aplikasi dijalankan (`npm run dev`), tampilan Story Editor tidak dapat ditekan dan seluruh interaksi terhenti (UI freeze).
- Console Electron menampilkan error:
  ```
  Warning: Cannot update a component (`ProjectEditor`) while rendering a different component (`CanvasTransformGizmo`).
  Warning: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect...
      at CanvasTransformGizmo (CanvasTransformGizmo.tsx:27:3)
  ```

**Akar Masalah:**
1. `ResizeObserver` mengamati `overlayRef.current` (elemen root gizmo itu sendiri) dan memanggil `setOverlayRect(rect)` dengan instans `new DOMRect` tanpa memeriksa apakah dimensi sebenarnya berubah. Render ulang elemen anak memicu callback observer kembali secara instan sehingga terjadi cascading update loop.
2. Hook `useEffect` sinkronisasi `activeTransform` bergantung pada referensi objek `selectedBounds` yang selalu dialokasikan baru pada setiap siklus evaluasi oleh `getActiveVisualClipsBounds`, memanggil `structuredClone` dan men-trigger `setActiveTransform` secara tanpa henti.
3. Callback `onUpdateClipTransform` dipanggil di dalam fungsi updater state `setActiveTransform((current) => ...)`, yang mengeksekusi mutasi state controller/`ProjectEditor` secara ilegal di tengah proses internal state React.

**Solusi & Perbaikan:**
1. **Stabilisasi Pengamatan Ukuran Kanvas:** Mengamati kontainer viewport induk (`.project-preview-viewport`) atau kanvas pratinjau yang stabil, menjadwalkan pembacaan melalui `requestAnimationFrame`, dan membandingkan toleransi `width`/`height`/`left`/`top` sebelum memanggil `setOverlayRect` (bailout ketika dimensi tidak berubah).
2. **Sinkronisasi Transform Stabil:** Menggunakan `activeTransformRef` untuk referensi sinkron tanpa jeda, serta fungsi murni `updateActiveTransform` yang memvalidasi kesamaan nilai properti `x`, `y`, `scale`, `rotation`, dan `opacity` sebelum mengizinkan React re-render. Dependensi effect diarahkan ke `[selectedClipId, project]`.
3. **Pemberhentian Efek Samping di Dalam setState:** Menghilangkan pemanggilan `onUpdateClipTransform` dari dalam updater `setActiveTransform`; pemanggilan histori dikirim secara murni pada `handleWindowPointerUp` menggunakan `activeTransformRef.current`.
4. **Perlindungan Interaksi Panning Workspace:** Menambahkan penjaga `e.shiftKey` pada pointer handler gizmo agar gesture panning kanvas workspace tetap dapat ditangkap oleh container stage.
5. **Pencegahan Seleksi Redundan:** Memastikan `StoryEditor` hanya memanggil `controller.select` jika klip yang diklik berbeda dari seleksi aktif.

**Pengujian & Verifikasi:**
- 11/11 unit tests lolos di `CanvasTransformGizmo.test.tsx` (termasuk regression test non-recursive render) dan `StoryEditor.test.tsx`.
- `npx tsc --noEmit` lolos bersih (exit code 0).

## 12. Pemisahan Assets global, elemen Story, dan komposisi Record (10 Oktober 2026)

**Status:** Open / Planned. Pembagian kepemilikan disepakati pengguna pada 10 Oktober 2026; belum ada perubahan schema, UI, renderer, atau bundler untuk issue ini.

**Prioritas:** Fondasi sebelum pengembangan fitur finishing Story Editor setara CapCut Desktop.

**Masalah saat ini:** Menambahkan Text atau Shape pada Story membuat entri di Assets global. Elemen desain khusus suatu Story terlihat sebagai sumber bersama project dan mengisi library media yang seharusnya berisi media reusable.

**Akar masalah yang teridentifikasi:**

- `addTextOverlay` (`src/core/timeline/commands.ts:154`) membuat `MediaAsset` dengan `kind: "text"` dan memasukkannya ke `project.assets`.
- `createAndPlaceShape` (`src/core/timeline/shapeCommands.ts:14`) mendaftarkan definisi shape melalui `registerMedia` sebelum membuat placement.
- `updateArtboardProject` (`src/core/timeline/repurposeCommands.ts:449`) menyimpan timeline Artboard secara independen, tetapi menyalin seluruh `updatedView.assets`, packages, dan compositions kembali ke project induk. Belum ada batas kepemilikan media privat Story.
- `StoryEditor` sudah menerima project view Artboard aktif serta project induk; library media dan komposisi Record tetap berbagi penyimpanan induk. Fondasi ini harus dipertahankan dengan isolasi kepemilikan yang eksplisit.

**Hierarki dan kontrak target:**

- Satu project `.captr` memiliki Assets global dan Artboard. Story adalah subproject logis milik Artboard, menyusun video final dari placement Record, B-roll, teks, musik, subtitle, dan elemen desain.
- Record Editor mengedit komposisi rekaman pada placement yang dibuka dari Story. Recording package/source/sidecar tetap bersama; komposisi placement harus dapat diedit independen, termasuk antar-Artboard.
- Urutan evaluasi: source media → komposisi Record → efek placement Story → compositing Story/Artboard → export. Waktu Story dipetakan melalui trim/rate placement dan time map Record ke source; cursor, webcam, audio, dan subtitle mengikuti pemetaan tersebut.
- Scope edit selalu Story/Artboard aktif. Perubahan lokal tidak boleh mengubah Story lain. Preview dan export menggunakan evaluasi yang sama.

**Pembagian kepemilikan yang disepakati:**

| Jenis | Level | Aturan |
| --- | --- | --- |
| Recording package: screen, webcam, mic, system audio, cursor telemetry | Assets global | Source bersama; komposisi dan placement independen. Finalisasi Screen Record tetap Assets-only. |
| Video/B-roll, gambar/logo/GIF/stiker berbasis file, musik/SFX/audio impor | Assets global | Source reusable; trim, timing, transform, volume, dan efek dimiliki placement Story. |
| Text, judul, lower third, callout | Elemen Story | Konten/style lokal, langsung menjadi elemen/clip; tidak membuat source Asset sintetis. |
| Rectangle, ellipse, line, arrow, shape desain | Elemen Story | Definisi/style lokal; tidak tampil di Assets global. |
| Caption/subtitle final | Story | Teks final, timing, segmentasi, posisi, dan style lokal. Transkrip source tetap boleh menjadi metadata media global. |
| Background warna/gradient | Story | Pengaturan komposisi; background gambar merujuk source media. |
| Transition, keyframe, animation, mask, crop, color adjustment | Story/placement | Instruksi editing, bukan item library media. |
| Group/compound clip | Story | Struktur komposisi lokal; implementasi fitur menyusul. |
| Voiceover/TTS yang dibuat khusus dalam Story | Media privat Story secara default | Source file beridentitas; dapat dipublikasikan ke Assets global melalui aksi eksplisit. Scope privat belum diimplementasikan. |
| Zoom, cursor, webcam layout, efek rekaman | Komposisi Record per placement | Diedit melalui Record Editor; source package tetap utuh. |
| Preset reusable untuk teks/shape/animasi | Templates | Library preset terpisah dari Assets media; penerapan menghasilkan elemen lokal independen. |

**Target UI:** Assets menampilkan media global; Story Media menampilkan media privat Story aktif; Text/Shapes adalah alat pembuat elemen; Templates adalah library preset reusable. Pembagian ini merupakan target, bukan kondisi aplikasi sekarang.

**TODO implementasi, dalam urutan pengerjaan:**

- [ ] Tulis dan review spec schema/kepemilikan: satu representasi authoritative untuk elemen lokal dan media privat, serta relasi Story–Artboard–placement Record. Sinkronisasi representasi Story/Artboard tidak boleh menghilangkan metadata.
- [ ] Audit seluruh consumer asset lookup, command, validator, evaluator, renderer, inspector, library, AI/MCP, bundle, dan konversi sebelum mengubah model; petakan caller melalui graft.
- [ ] Tambahkan model/validasi elemen lokal Text/Shape dan media privat Story. Clip media tetap merujuk source; clip desain tidak membutuhkan Asset global sintetis.
- [ ] Ubah command tambah/edit/duplikasi/hapus Text dan Shape agar scope-nya Story aktif, dengan undo/redo dan dirty revisions yang benar.
- [ ] Ubah project view dan update Artboard agar elemen/media privat tidak tersalin ke Assets global; media reusable dan Recording package tetap tersimpan di induk.
- [ ] Pastikan duplikasi Artboard/Story dan copy antar-Story menghasilkan ID elemen/placement/komposisi baru yang independen; source media global tetap dipakai bersama.
- [ ] Tambahkan UI Assets, Story Media, Text/Shapes, dan Templates sesuai pembagian kepemilikan. Media privat hanya dipublikasikan ke global lewat aksi eksplisit dengan referensi yang tetap valid.
- [ ] Terapkan scope privat untuk voiceover/TTS Story tanpa mengubah kontrak finalisasi Screen Record Assets-only; pertahankan guard capture, navigasi, stale completion, dan cleanup.
- [ ] Perbarui preview/export untuk mengevaluasi elemen lokal dan source privat; pertahankan pemetaan waktu bertingkat serta komposisi Record tanpa flatten.
- [ ] Perbarui save/autosave/load/bundling agar seluruh media global dan privat, termasuk yang belum ditempatkan, tersimpan dalam satu `.captr`. `project.json` authoritative; source/sidecar di `assets/<assetId>/`; tidak membuat `slides/` atau `slide.json` baru.
- [ ] Tambahkan jalur kompatibilitas V3 lama: Text/Shape global yang sudah dipakai diterjemahkan menjadi elemen lokal independen per Story sambil mempertahankan konten, styling placement, timing, keyframe, dan transisi. Tentukan perlakuan entri lama yang belum dipakai agar tidak hilang diam-diam; load tidak menulis ulang bundle asli.
- [ ] Perbarui kontrak `AGENTS.md` dan checklist shape V3 saat migrasi diterapkan; kontrak asset `shapeDefinition` sekarang tetap mencatat implementasi lama sampai perubahan tersebut selesai.
- [ ] Jalankan tes domain/UI/bundle yang relevan, TypeScript, dan QA native berikut; catat hasil aktual serta refresh graft setelah perubahan kode besar.

**Acceptance / checklist regresi:**

- [ ] Tambah Text/Shape di Story A: hanya ada di A, tidak muncul di Assets global dan Story B; edit serta undo/redo tetap lokal.
- [ ] Copy/duplicate ke Story B: ID dan konten edit independen; perubahan B tidak mengubah A.
- [ ] Media global yang sama ditempatkan di A/B: source tetap bersama, trim/rate/transform/efek dan komposisi Record independen.
- [ ] Media privat hanya terlihat/dapat diakses melalui Story pemilik; publikasi eksplisit ke global mempertahankan file dan referensi placement.
- [ ] Hapus clip tidak menghapus source media global/privat. Seluruh library, termasuk media tanpa placement, lolos save/reopen.
- [ ] Bundle V3 lama dengan Text/Shape global tetap terbuka dengan tampilan yang sama, termasuk referensi lintas-Artboard dan entri tanpa placement; file asli tidak berubah saat load.
- [ ] Record berulang pada project aktif → Ctrl+S tanpa Save As; import video/gambar/audio, Assets-only save/reopen, dan placement Record ganda dengan edit independen tetap lulus.
- [ ] Save As/New menjaga identitas/path; konversi Record V1/V2 tetap eksplisit ke salinan baru, metadata tidak didukung ditolak utuh, Video/Motion legacy tetap ditolak.
- [ ] Preview/export parity untuk teks/shape, subtitle final, media privat, efek Story di atas komposisi Record, serta seek/split/trim/rate bertingkat.

**Catatan kondisi sekarang dan pekerjaan lanjutan:** Waveform Story masih sintetis; marker keyframe masih indikator; subtitle preview berada di luar canvas yang diekspor. `StoryComposition.subtitles` sudah tersedia sebagai metadata, tetapi alur Story/Artboard dan renderer/export belum menggunakannya secara lengkap. Finishing dasar, workflow editing cepat, visual polish, dan fitur advanced dijadwalkan setelah batas kepemilikan ini selesai; rincian urutan di [ROADMAP.md](ROADMAP.md).

**Verifikasi 10 Oktober 2026:** Pembacaan graph/source dan pencatatan keputusan saja. Implementasi, migrasi, tes fitur baru, dan QA native issue ini belum dijalankan. Hasil tes issue sebelumnya tidak dianggap verifikasi issue #12.


