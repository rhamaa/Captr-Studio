# Format Proyek `.captr` V3

Dokumen ini mendefinisikan spesifikasi format kontainer file proyek `.captr` pada **Captr Studio V3** (versi `1.4.0-beta.1`).

---

## 1. Ikhtisar Format

File `.captr` adalah kontainer **ZIP bundle** mandiri (*self-contained archive*) yang menyimpan seluruh media rekaman mentah, audio impor, metadata pengeditan, urutan Artboard/Story, dan sidecar dalam satu file fisik.

### Prinsip Utama:
1. **Satu File Per Project:** Tidak ada dependensi ke folder eksternal yang dapat terputus (*broken links*).
2. **Store Level 0 (`store: true`):** Media video dan audio yang sudah terkompresi disimpan tanpa kompresi ganda (*no re-compression overhead*), membuat operasi Simpan (Save/Autosave) berlangsung sangat cepat mendekati batas bandwidth disk.
3. **Indeks Authoritative Tunggal (`project.json`):** Seluruh hierarki kepemilikan, trek, aset, dan konfigurasi project diatur secara mutlak oleh `project.json`.
4. **Non-Destruktif:** Media asli tidak pernah dipotong secara permanen. Semua pemotongan, zoom, dan styling disimpan sebagai instruksi metadata timeline.

---

## 2. Struktur Direktori Fisik di Dalam Bundle

```text
NamaProject.captr (ZIP Bundle)
├── project.json                        <-- INDEKS AUTHORITATIVE KANONIKAL
├── thumbnail.png                       <-- Pratinjau cover project (opsional)
│
├── assets/                             <-- Folder Pool Media Fisik
│   ├── <assetId_1>/                    <-- Aset rekaman layar (Screen Record)
│   │   ├── asset.json                  <-- Metadata media kanonikal
│   │   ├── package.json                <-- Manifest multi-stream rekaman
│   │   ├── 0-screen.mp4                <-- Video rekaman layar mentah
│   │   ├── 1-webcam.mp4                <-- Video kamera web (jika ada)
│   │   ├── transcript.json             <-- Sidecar transkripsi kata & timestamp
│   │   ├── captions.vtt                <-- Sidecar format WebVTT
│   │   └── telemetry.json              <-- Data telemetri kursor mouse
│   │
│   ├── <assetId_2>/                    <-- Aset video impor atau B-roll
│   │   ├── asset.json
│   │   └── source.mp4
│   │
│   └── <assetId_3>/                    <-- Aset audio voiceover privat Story
│       ├── asset.json
│       └── take.wav
│
├── compositions/                       <-- Komposisi Record Per-Placement
│   ├── <compositionId_A>.json          <-- Konfigurasi kamera, zoom, PiP untuk Placement A
│   └── <compositionId_B>.json          <-- Konfigurasi kamera, zoom, PiP untuk Placement B
│
└── Story/                              <-- Proyeksi Turunan Story (Read-Only Mirror)
    ├── storyManifest.json              <-- Daftar manifest proyeksi Story
    ├── 001-default.json                <-- Proyeksi Story root/default
    └── 002-tiktok-portrait.json        <-- Proyeksi Story Artboard
```

---

## 3. Komponen Utama Bundle

### A. `project.json` (Authoritative)
Merupakan kebenaran tunggal (*single source of truth*) yang memuat:
- `id`, `title`, `version` (V3), `createdAt`, `updatedAt`.
- `canvas`: Dimensi kanvas default (`width`, `height`, `fps`, `background`).
- `assets`: Daftar `MediaAsset` global (video, gambar, audio, recording packages).
- `localAssets?`: Daftar `MediaAsset` privat milik Story default/root.
- `tracks`: Urutan trek visual dan audio untuk Story default/root.
- `repurposeBoard`:
  - `artboards[]`: Daftar output Artboard dengan nama, kanvas, `tracks` mandiri, dan `localAssets` privat.
  - `whiteboardSnapshot?`: Data infinite canvas tldraw (posisi shape, note, card).
- `designTemplates?`: Koleksi template preset teks dan shape.
- `clipTransitions?`: Hubungan transisi antar klip bersebelahan.
- `hyperframes?`: Komposisi motion graphics berbasis kode.

### B. `assets/<assetId>/`
Menyimpan file media fisik dan sidecar pendukung:
- Baik aset global maupun aset privat Story disimpan di folder `assets/<assetId>/` dengan penamaan ID unik non-kolisi.
- Aset yang belum ditempatkan ke timeline (*unplaced assets*) **tetap wajib disimpan** di dalam bundle saat Save.

### C. `compositions/<compositionId>.json`
Instruksi visual untuk klip rekaman layar:
- Smart zoom keyframes dan bounding boxes.
- Tata letak webcam Picture-in-Picture (posisi, bentuk, border).
- Background wallpaper, padding kanvas, dan shadow.
- Telemetri kursor (smoothing, click ripple, ukuran).
- Mengizinkan satu recording package memiliki banyak komposisi berbeda tanpa menduplikasi file MP4 fisik.

### D. `Story/*.json` (Projections)
- Folder `Story/` dan file manifest-nya adalah **proyeksi turunan** untuk interoperabilitas dan rendering eksternal.
- Proyeksi di-generate ulang secara bersih saat proses staging sebelum ZIP ditulis.
- Proyeksi **tidak boleh menimpa** data kanonikal di `project.json` saat pemuatan (*load*).
- Penamaan file proyeksi menggunakan ordinal terbatas bebas kolisi (`001-*.json`, `002-*.json`) berdasarkan urutan manifest.

---

## 4. Transaksi Penyimpanan & Keamanan Data (Atomic Save)

Untuk mencegah kerusakan data (*data corruption*) jika terjadi crash atau listrik padam saat menyimpan:
1. **Staging Directory:** Seluruh file disiapkan di folder sementara staging di disk.
2. **Atomic Write:** ZIP dibundel ke file temporer (`.captr.tmp`).
3. **Safe Swap / Replace:** File temporer digantikan ke file target utama secara atomik setelah verifikasi penulisan berhasil.
4. **Verifikasi Identitas Ctrl+S:** Pintasan Ctrl+S hanya mengizinkan penyimpanan jika `projectId` data aktif cocok dengan `projectId` bundle di disk, mencegah overwrite tidak sengaja ke file project lain.

---

## 5. Rujukan Terkait
- [Arsitektur Kepemilikan Media (Ownership)](ownership.md)
- [Lifecycle Project: Save, Rename, Save As](../features/project-lifecycle.md)
- [Dokumentasi Format Awal (Arsip)](../about%20captr%20extention.md)
