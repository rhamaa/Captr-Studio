# Roadmap Produk dan Rekayasa Captr Studio

Dokumen ini memetakan tahapan rilis, fitur yang telah diimplementasikan, serta backlog pengembangan aktif untuk **Captr Studio** per **10 Oktober 2026** (versi package: `1.4.0-beta.1`).

---

## 1. Visi Produk

Captr Studio memadukan:
1. **Dynamic Screen Experience (ala Screen Studio & RapidDemo):** Perekaman layar dengan kurva kursor kinetik, efek zoom cerdas, webcam Picture-in-Picture, dan wallpaper dinamis.
2. **Direct Video Editing (ala CapCut & Filmora):** Timeline multi-trek, transisi antar klip, animasi teks/shape inline, voiceover privat, dan multi-output Artboard.
3. **Autonomous AI & Code Motion Graphics:** Integrasi AI CLI Agent via MCP Server dan engine Hyperframe berbasis HTML/Canvas.

---

## 2. Status Milestone (Per 10 Oktober 2026)

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

---

## 3. Rencana Tahapan Pengembangan (Urutan TODO)

### Tahap 1: Fondasi Kepemilikan (Selesai pada 10 Oktober 2026)
- [x] Pemisahan Assets global vs Story Media privat.
- [x] Elemen inline Teks/Shape tanpa file media sintetis.
- [x] Template desain reusable dan normalisasi V3 lama.
- [x] API resolusi sumber terpadu dan proteksi transaksi bundle `.captr`.
- [ ] *Pending:* Pengujian regresi native interaksi desktop.

### Tahap 2: Finishing Dasar Story Editor (Prioritas Aktif)
- [ ] **Editor Caption Final & Burn-In Story:** Editor segmen teks/kata dengan undo/redo dan pembakaran subtitle ke frame ekspor MP4 Story.
- [ ] **Real Audio Waveform:** Ekstraksi peak amplitudo riil dari audio sumber untuk visualisasi gelombang suara di timeline.
- [ ] **Filmstrip Thumbnail Video:** Thumbnail frame video berkala di sepanjang klip timeline untuk mempermudah pencarian visual.

### Tahap 3: Workflow Editing Cepat
- [ ] **Clipboard Klip & Atribut:** Copy/paste klip, pemindahan efek/transform dari satu klip ke klip lain.
- [ ] **Grup Klip & Compound Story:** Menggabungkan beberapa klip menjadi satu kesatuan yang dapat dipindah bersama.
- [ ] **Link / Unlink Audio-Video:** Memisahkan atau menyatukan trek audio dari klip video rekaman.
- [ ] **Ripple Trim & Insert/Overwrite Mode:** Mode pengeditan timeline magnetik tingkat lanjut.
- [ ] **Audio Automation & Crossfades:** Kurva fade-in, fade-out, dan crossfade halus antar klip audio.

### Tahap 4: Visual Polish & Grading
- [ ] **Crop, Mask & Blend Mode:** Fitur masking (rectangle, circle, linear) dan blending per placement.
- [ ] **Color Adjustment & LUTs:** Pengaturan brightness, contrast, saturation, suhu warna, dan filter LUT.
- [ ] **Graph Editor Keyframe:** Kurva kurva Bezier visual untuk timing animasi yang sangat presisi.

### Tahap 5: Fitur Lanjutan (Advanced)
- [ ] **Speed Curves & Retiming:** Kurva kecepatan variabel (ramp-up / slow-motion) dan freeze frame.
- [ ] **Motion Tracking:** Pelacakan otomatis titik objek untuk menempelkan stiker/teks.
- [ ] **Proxy Media:** Pembuatan file proxy resolusi rendah untuk pengeditan 4K yang sangat lancar di mesin spesifikasi sedang.

---

## 4. Rujukan Terkait
- [Root Roadmap Detail (ROADMAP.md)](../../ROADMAP.md)
- [Status Fitur & Batas Dukungan](../product/status.md)
- [Laporan Verifikasi Pengujian](verification.md)
