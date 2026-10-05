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
