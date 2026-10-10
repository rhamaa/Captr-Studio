# Indeks Log Isu & Cek Regresi (Issue Tracker)

Dokumen ini merupakan panduan dan ringkasan terstruktur dari seluruh riwayat isu kritis, perbaikan arsitektur, dan kontrak regresi yang tercatat pada [ISSUE.md](../../../ISSUE.md) Captr Studio.

> [!IMPORTANT]
> Sebelum melakukan modifikasi pada modul **Recording**, **Record Editor**, **Story Editor**, **Project Save/Autosave**, atau format berkas **.captr V3**, pengembang **wajib** meninjau daftar cek regresi di bawah ini untuk mencegah terulangnya bug historis.

---

## 1. Daftar Isu & Solusi Arsitektural

| No | Tanggal | Topik Utama | Status | Rangkuman Solusi & Kontrak |
|---|---|---|---|---|
| **#1** | 3 Okt 2026 | Keyframing Engine Overlay Timeline | Selesai & Terverifikasi | Properti `keyframes?: PropertyKeyframe[]` pada `TimelineClip` (posisi, skala, rotasi, opasitas). Evaluasi matematis via `sampleClipTransform` terintegrasi ke preview canvas dan MP4 export. Diamond marker di timeline UI. |
| **#2** | 27 Sep 2026 | Audio Recording Sering Hilang | Selesai | Pemisahan audio mik (`*.mic.wav`) dan sistem (`*.sys.wav`) ke sidecar independen dengan sinkronisasi offset clock milidetik. |
| **#3** | 27 Sep / 1 Okt 2026 | Rekaman Tambahan Meminta Project Baru (Regresi Path) | Selesai & Terverifikasi | Penghapusan asumsi `videoSourcePath` kosong. Handler sesi mengonsumsi `preserveProjectPath`. Kontrak V3: Satu file `.captr`, rekaman baru masuk Assets-only tanpa auto-placement di timeline. Ctrl+S mempertahankan path aktif via verifikasi `projectId`. |
| **#4** | 4 Okt 2026 | Project Home & Penamaan File | Selesai & Terverifikasi | Startup membuka Home tanpa project aktif. Nama proyek terikat erat dengan basename berkas `.captr`. Rename mempertahankan `projectId` dan folder; Save As membuat salinan dengan `projectId` baru. Guard perpindahan Home memblokir transaksi file/capture aktif. |
| **#5** | 5 Okt 2026 | Transisi Visual & Shape V3 | Selesai & Terverifikasi | Shape rectangle, ellipse, line, arrow disimpan inline pada `clip.content.shapeDefinition` tanpa Asset sintetis. Relasi `clipTransitions` menghubungkan dua klip bersebelahan pada trek yang sama dengan kalkulasi source handle valid. |
| **#6** | 5 Okt 2026 | UX Pemisahan Trek Media & Audio | Selesai & Terverifikasi | Timeline memisahkan grup Visual dan Audio secara tegas. Logika drag-and-drop mendeteksi tipe aset dan menempatkannya pada baris yang sesuai secara otomatis. |
| **#7** | 5–7 Okt 2026 | Multi-Artboard Repurposer, Whiteboard Tldraw & Hyperframe | Selesai & Terverifikasi | Hub Artboard multi-rasio (16:9, 9:16, 1:1, 4:5), sequence mandiri per artboard (`tracks`, `clipTransitions`), canvas whiteboard `@tldraw/tldraw` offline terisolasi, dan MP4 batch export. |
| **#8** | 9 Okt 2026 | Integrasi Terminal Interaktif & MCP Server | Selesai & Terverifikasi | Terminal `@xterm/xterm` tertanam di level project `.captr` (`ProjectTerminalConfig`), injeksi env vars `CAPTR_*`, auto-generate `.mcp.json` untuk agen CLI (`agy`, `claude`, `opencode`). |
| **#9** | 9 Okt 2026 | Fitur Video Editor Pro (NLE) pada Story Editor | Selesai & Terverifikasi | SMPTE timecode `MM:SS:FF`, frame stepping (`<`, `>`), safe zones TikTok/Reels, smart split, fullscreen preview, Canvas Story Inspector, dan kontrol transform clip. |
| **#10** | 9 Okt 2026 | Workspace Zoom/Pan & Direct On-Canvas Drag-and-Drop | Selesai & Terverifikasi | Zoom preview (Fit s/d 300%) dan panning canvas (Middle Click / Shift+Drag). Direct manipulation transform gizmo (single-click instant select & translate), snap koordinat, dan drop aset langsung ke kanvas. |
| **#11** | 9 Okt 2026 | Freeze Interaksi & Infinite Re-render Loop di Story Editor | Selesai & Terverifikasi | Stabilisasi `CanvasTransformGizmo`: penghentian circular `ResizeObserver` pada DOMRect baru, penghapusan callback `onUpdateClipTransform` dari dalam fungsi updater `setState`, dan isolasi gesture drag vs pan. |
| **#12** | 10 Okt 2026 | Pemisahan Assets Global, Elemen Story & Komposisi Record | Fondasi Selesai (Acceptance 10/10) | Dekoupling kepemilikan aset V3: Elemen Teks dan Shape berstatus inline murni pada Story Clip (XOR `assetId` vs `content`). Media privat Story (voiceover lokal) terisolasi. Rekaman layar tetap global Assets-only. Komposisi Record independen per placement. Normalisasi V3 legacy tanpa mutasi file asli. |

---

## 2. Checklist Wajib Sebelum Mengubah Kode Inti

### A. Rekaman Layar & Penyimpanan Proyek (Issue #3)
1. **Tidak Ada Placement Otomatis:** Rekaman baru hanya didaftarkan ke `project.assets` sebagai item global yang belum ditempatkan. Timeline tidak boleh dimutasi otomatis saat capture selesai.
2. **Preservasi Path Windows & macOS:** Jalur perekaman native Windows (`stop-native-screen-recording` dan `mux-native-windows-recording`) harus mengonsumsi flag `preserveProjectPath` sebelum memutuskan reset path.
3. **Verifikasi Identitas Ctrl+S:** Handler Ctrl+S wajib memverifikasi bahwa `projectId` payload sama dengan `projectId` berkas `.captr` aktif sebelum menimpa berkas pada disk.
4. **Bundle Authoritative:** File `project.json` di root zip adalah satu-satunya indeks authoritative. Direktori `slides/` dan berkas `slide.json` sudah dipensiunkan penuh dan dilarang dibuat kembali.

### B. Kepemilikan Elemen Story & Media Privat (Issue #12)
1. **Integritas XOR Konten:** Setiap `TimelineClip` visual wajib memenuhi aturan XOR eksklusif: memiliki tepat satu dari `assetId` (untuk media file) atau `content` (untuk teks/shape inline). Dilarang membuat `MediaAsset` tiruan untuk teks atau bentuk vektor.
2. **Isolasi Artboard:** Perubahan timeline pada satu Story/Artboard tidak boleh memutasi Artboard lain. Media privat (`localAssets`) hanya terlihat pada Story pemiliknya.
3. **Normalisasi Legacy yang Aman:** Saat membuka berkas `.captr` V3 lama yang memuat teks/shape di library global, konversi menjadi inline clip dilakukan saat kloning runtime dalam memori; berkas sumber pada disk tidak boleh dimutasi tanpa aksi save eksplisit dari pengguna.

### C. Keamanan Interaksi React & Gizmo Kanvas (Issue #11)
1. **Tidak Ada Efek Samping di Render:** Dilarang memanggil `controller.execute()` atau updater state induk dari dalam siklus render atau updater lokal `setState((prev) => ...)`.
2. **Peredaman ResizeObserver:** Saat mengamati kontainer kanvas, gunakan `requestAnimationFrame` dan periksa selisih nilai geometri (`Math.abs(delta) > 1`) sebelum memperbarui state dimensi untuk mencegah infinite loop.

---

## 3. Rujukan Dokumen Lengkap
- [Log Isu Lengkap & Catatan QA Native (ISSUE.md)](../../../ISSUE.md)
- [Arsitektur Kepemilikan Aset & Story](../../architecture/ownership.md)
- [Format Proyek .captr V3](../../architecture/project-format.md)
- [Laporan Verifikasi Pengujian](../../project/verification.md)
- [Roadmap Rilis](../../project/roadmap.md)
