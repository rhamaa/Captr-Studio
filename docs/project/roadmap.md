# Roadmap Produk dan Rekayasa Captr Studio

Dokumen ini memetakan tahapan rilis, fitur yang telah diimplementasikan, serta backlog pengembangan aktif untuk **Captr Studio** per **18 Oktober 2026** (versi package: `1.4.0-beta.3`).

---

## 1. Visi Produk

Captr Studio memadukan:
1. **Dynamic Screen Experience (ala Screen Studio & RapidDemo):** Perekaman layar dengan kurva kursor kinetik, efek zoom cerdas, webcam Picture-in-Picture, dan wallpaper dinamis.
2. **Direct Video Editing (ala CapCut & Filmora):** Timeline multi-trek, transisi antar klip, animasi teks/shape inline, voiceover privat, dan multi-output Artboard.
3. **Autonomous AI & Code Motion Graphics:** Integrasi AI CLI Agent via MCP Server dan engine Hyperframe berbasis HTML/Canvas.

---

## 2. Status Milestone (Per 18 Oktober 2026)

| Tanggal | Fitur / Milestone | Status | Bukti / Catatan |
| --- | --- | --- | --- |
| **1 Okt 2026** | Retirasi slide legacy & V3 Project Assets tanpa slide | Selesai & Terverifikasi | Penyimpanan V3 mandiri di `assets/<assetId>/`. |
| **4 Okt 2026** | Project Home & File Naming, Audio Recorder | Selesai & Terverifikasi | Alur New/Open/Save/Rename aman tanpa projectId bocor. |
| **5 Okt 2026** | Visual Transitions & Inline Shapes | Selesai & Terverifikasi | Transisi visual berdekatan dan interpolasi keyframe. |
| **6 Okt 2026** | Multi-Artboard Repurpose & AI CLI Bridge | Selesai & Terverifikasi | Pilihan rasio 9:16, 1:1, 16:9, 4:5 dan bridge CLI `agy`. |
| **7 Okt 2026** | Tldraw Infinite Canvas Whiteboard & Hyperframe MP4 | Selesai & Terverifikasi | Whiteboard offline lokal dan renderer offscreen Chromium. |
| **9 Okt 2026** | Story Editor NLE Shortcuts, Zoom/Pan & Gizmo | Selesai & Terverifikasi | Pintasan frame step, zoom stage, dan drag-and-drop koordinat. |
| **9 Okt 2026** | Fix CanvasTransformGizmo Infinite Render Loop | Selesai & Terverifikasi | Stabilisasi ResizeObserver dan transform sync (Issue #11). |
| **10 Okt 2026** | Story Asset Ownership Foundation (Issue #12) | Selesai (Unreleased) | 224 tes lolos di 15 suite (`8c2fe68`), review disetujui. |
| **17 Okt 2026** | Lima tahap Story finishing | Implementasi tersedia; QA native pending | Stabilisasi, caption final, waveform/filmstrip, editing cepat, crop/mask/grading/Bezier. Bukti terbaru di [verifikasi](verification.md). |
| **18 Okt 2026** | Record Editor Polish & Frame Appearance Studio (`1.4.0-beta.3`) | Selesai & Terverifikasi | Outward border expansion, visual presets, zoom wheel & pan stage, AI surface toggle. |

---

## 3. Rencana Tahapan Pengembangan (Urutan TODO)

### Tahap 1: Fondasi Kepemilikan (Selesai pada 10 Oktober 2026)
- [x] Pemisahan Assets global vs Story Media privat.
- [x] Elemen inline Teks/Shape tanpa file media sintetis.
- [x] Template desain reusable dan normalisasi V3 lama.
- [x] API resolusi sumber terpadu dan proteksi transaksi bundle `.captr`.
- [ ] *Pending:* Pengujian regresi native interaksi desktop.

### Tahap 2: Finishing Dasar Story Editor (Terimplementasi)
- [x] **Editor Caption Final & Burn-In Story:** Edit teks segmen/kata, timing segmen, style dan posisi; undo/redo dan renderer preview/export bersama.
- [x] **Real Audio Waveform:** Peak sumber audio, termasuk stream package Record dengan clock komposisi.
- [x] **Filmstrip Thumbnail Video:** Sampel frame video/Record mengikuti trim/rate, dengan cache dan decoder terbatas.

### Tahap 3: Workflow Editing Cepat
- [x] **Clipboard Klip & Atribut:** Copy/paste dalam Story aktif; salinan Record memiliki komposisi independen.
- [x] **Grup dan Link Klip:** Seleksi dan gerak bersama secara atomik, termasuk proteksi track terkunci.
- [x] **Detach Audio:** Placement audio independen tanpa meratakan package Record atau menggandakan playback.
- [x] **Fade Audio:** Fade-in/out per placement dipakai playback/export.
- [ ] **Compound Story:** Sequence bersarang belum dibuat.
- [ ] **Ripple Trim & Insert/Overwrite Mode:** Mode pengeditan timeline magnetik tingkat lanjut.
- [ ] **Audio Automation & Crossfades:** Automation bebas dan crossfade antar klip.

### Tahap 4: Visual Polish & Grading
- [x] **Crop dan Mask Dasar:** Crop empat sisi, mask rectangle/ellipse dan inset per placement.
- [x] **Color Adjustment Dasar:** Brightness, contrast dan saturation per placement.
- [x] **Graph Editor Keyframe:** Dua handle cubic-Bezier dengan kontrol pointer dan keyboard.
- [ ] **Visual Lanjutan:** Feather, blend mode, mask bebas, suhu warna dan LUT.

### Tahap 5: Fitur Lanjutan (Advanced)
- [ ] **Speed Curves & Retiming:** Kurva kecepatan variabel (ramp-up / slow-motion) dan freeze frame.
- [ ] **Motion Tracking:** Pelacakan otomatis titik objek untuk menempelkan stiker/teks.
- [ ] **Proxy Media:** Pembuatan file proxy resolusi rendah untuk pengeditan 4K yang sangat lancar di mesin spesifikasi sedang.

---

## 4. Rujukan Terkait
- [Root Roadmap Detail (ROADMAP.md)](../../ROADMAP.md)
- [Status Fitur & Batas Dukungan](../product/status.md)
- [Laporan Verifikasi Pengujian](verification.md)
