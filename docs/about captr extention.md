# Arsitektur Format File Proyek `.captr` (Captr Studio V3)

Dokumen ini menjelaskan struktur internal, prinsip penyimpanan data, dan mekanisme pemisahan komposisi video pada format proyek berekstensi `.captr` di **Captr Studio V3**.

---

## 1. Apa Itu File `.captr`?

File berformat `.captr` adalah sebuah **arsip kontainer tunggal (ZIP bundle)** yang menyimpan seluruh aset media, rekaman multi-stream, dan metadata pengeditan dari sebuah proyek video.

### Karakteristik Utama:
* **Self-Contained:** Seluruh video rekaman, audio mikrofon, musik latar, gambar, dan kursor mouse dibundel ke dalam satu file. Proyek dapat dipindahkan ke komputer lain tanpa risiko *missing assets* / jalur file terputus.
* **Kecepatan Tinggi (Store Level 0):** File media yang sudah terkompresi (seperti `.mp4`, `.webm`, `.m4a`, `.png`) disimpan tanpa kompresi ulang (`store: true`), sehingga proses simpan (*Save*) dan *Autosave* berjalan sangat cepat (nyaris secepat operasi I/O disk lokal).
* **Non-Destruktif:** File rekaman asli tidak pernah diubah atau dipotong secara permanen. Semua pemotongan (*trimming*), perbesaran (*zoom*), dan tata letak (*layout*) disimpan sebagai instruksi metadata.
* **Indeks Authoritative Tunggal:** Seluruh referensi proyek diatur oleh satu file indeks utama bernama `project.json`.

---

## 2. Struktur Fisik Direktori di Dalam Bundle `.captr`

Saat sebuah proyek `.captr` dibuka atau diekstrak di balik layar, susunan filenya adalah sebagai berikut:

```text
NamaProyek.captr (ZIP Bundle)
├── project.json                      <-- Indeks authoritative (metadata, artboards, timeline, tracks)
├── thumbnail.png                     <-- Gambar pratinjau (cover) proyek
│
├── assets/                           <-- Pool Aset Bersama (Shared Media Pool)
│   ├── <assetId_1>/                  <-- Folder aset individual
│   │   ├── asset.json                <-- Metadata media (dimensi, durasi asli, tipe)
│   │   ├── package.json              <-- Metadata multi-stream (jika berasal dari Record HUD)
│   │   ├── 0-screen.mp4              <-- File rekaman video layar mentah
│   │   ├── 1-webcam.mp4              <-- File rekaman kamera mentah
│   │   └── telemetry.json            <-- Koordinat kursor mouse asli
│   └── <assetId_2>/
│       ├── asset.json
│       └── 0-bg_music.mp3            <-- File audio eksternal yang diimpor
│
└── compositions/                     <-- Konfigurasi visual internal rekaman per klip
    ├── <compositionId_A>.json        <-- Pengaturan kamera, wallpaper, & zoom untuk Klip A
    └── <compositionId_B>.json        <-- Pengaturan kamera, wallpaper, & zoom untuk Klip B
```

---

## 3. Konsep Multi-Artboard & Multi-Video Composition

Captr Studio V3 memungkinkan Anda memproduksi **beberapa video sekaligus dengan rasio dan konteks berbeda** dalam satu proyek `.captr` yang sama (misalnya: versi YouTube 16:9, versi Shorts 9:16, dan versi Feed 1:1).

Untuk mendukung fleksibilitas ini secara bersih, Captr Studio memisahkan dua level komposisi:

```
┌─────────────────────────────────────────────────────────────┐
│                      PROJECT (.captr)                       │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              repurposeBoard.artboards               │   │
│   │      (Wadah Video & Timeline Tingkat Global)        │   │
│   │                                                     │   │
│   │  • Video 1: "Shorts TikTok" (Rasio 9:16)            │   │
│   │  • Video 2: "Feed Instagram" (Rasio 1:1)            │   │
│   │  • Video 3: "YouTube Landscape" (Rasio 16:9)        │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│             Masing-masing artboard memuat                   │
│             klip dengan compositionId mandiri:              │
│                              │                              │
│   ┌──────────────────────────▼──────────────────────────┐   │
│   │                   compositions/                     │   │
│   │         (Kostum & Layout Visual Internal Klip)       │   │
│   │                                                     │   │
│   │  • compositionId_A (Webcam di atas, zoom 1.8x)      │   │
│   │  • compositionId_B (Webcam kanan bawah, tanpa zoom) │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### A. Level Output Video: `RepurposeArtboard` (di `project.json`)
Menentukan identitas video secara keseluruhan:
* **Judul & Rasio:** Nama video (`name`), rasio aspek (`aspectRatio`), dan resolusi kanvas (`width` × `height`).
* **Kamera Kanvas Global:** Framing zoom dan offset kanvas (`framing.scale`, `offsetX`, `offsetY`).
* **Urutan Timeline Independen (`tracks`):** Susunan potongan durasi klip (`sourceInUs`, `sourceOutUs`), urutan penempatan klip (`startUs`), kecepatan putar (`rate`), dan lapisan layer audio/visual tersendiri untuk video tersebut.

### B. Level Visual Klip: `RecordComposition` (di `compositions/<id>.json`)
Menentukan bagaimana rekaman layar + webcam "dibungkus" di dalam klip tersebut:
* **Webcam Picture-in-Picture (PiP):** Posisi (X, Y), ukuran/skala, bentuk (lingkaran / rounded rectangle), atau disembunyikan.
* **Frame & Wallpaper:** Background di balik rekaman layar (gradient, warna, wallpaper), sudut melengkung (*border radius*), dan bayangan (*drop shadow*).
* **Smart Zoom Regions:** Titik-titik waktu detik mana rekaman otomatis memperbesar (*zoom-in*) mendekati kursor dan kapan kembali normal (*zoom-out*).
* **Mouse Telemetry & Cursor:** Ukuran pointer mouse, kelembutan pergerakan (*smoothing*), dan efek riak klik (*click ripple*).
* **Crop Area:** Memotong sebagian jendela aplikasi tertentu.

---

## 4. Alur Kerja Zero-Duplication (Satu Rekaman untuk Banyak Video)

Salah satu keunggulan utama arsitektur Captr V3 adalah **Zero-Duplication Asset Pool**:

1. **Satu Sumber File Fisik di Disk (`packageId`):**
   * Rekaman layar 4K berukuran 1 GB hanya disimpan **satu kali** di dalam folder `assets/<assetId>/`.
2. **Banyak Variasi Tampilan (`compositionId`):**
   * Dari 1 rekaman yang sama, Anda dapat membuat:
     * **Klip di Video 1 (Shorts 9:16):** Menggunakan `compositionId_A`. Webcam diposisikan di atas agar tidak tertutup tombol Like TikTok, layarnya di-zoom ke teks input form, dan background berwarna neon ungu.
     * **Klip di Video 2 (YouTube 16:9):** Menggunakan `compositionId_B`. Webcam diposisikan di pojok kanan bawah, tanpa zoom (full display 1.0x), dan background abu-abu gelap.
3. **Isolasi Penuh Antar Video:**
   * Mengubah posisi webcam atau menambah zoom di Video 1 **tidak akan memengaruhi** tampilan di Video 2.
   * Saat sebuah video card diduplikasi atau difork di Artboard Hub, sistem secara otomatis meregenerasi `compositionId` baru sehingga pengeditan pada salinan tersebut 100% independen.

---

## 5. Contoh Struktur Skema Data

### Potongan `project.json`:
```json
{
  "version": 3,
  "projectId": "proj-98213",
  "title": "Tutorial Onboarding",
  "canvas": { "width": 1920, "height": 1080, "fps": 60 },
  "assets": [
    {
      "id": "asset-rec-1",
      "kind": "recording",
      "packageId": "pkg-1",
      "name": "Screen & Camera Capture",
      "durationUs": 60000000
    }
  ],
  "packages": [
    {
      "id": "pkg-1",
      "durationUs": 60000000,
      "screen": { "path": "assets/asset-rec-1/0-screen.mp4" },
      "webcam": { "path": "assets/asset-rec-1/1-webcam.mp4" }
    }
  ],
  "repurposeBoard": {
    "artboards": [
      {
        "id": "artboard-tiktok",
        "name": "Shorts TikTok",
        "aspectRatio": "9:16",
        "width": 1080,
        "height": 1920,
        "framing": { "scale": 1.25, "offsetX": 0, "offsetY": 0, "fitMode": "cover" },
        "tracks": [
          {
            "id": "track-v1",
            "kind": "visual",
            "clips": [
              {
                "id": "clip-1",
                "assetId": "asset-rec-1",
                "compositionId": "comp-tiktok-1",
                "startUs": 0,
                "sourceInUs": 5000000,
                "sourceOutUs": 25000000,
                "rate": 1.0
              }
            ]
          }
        ]
      },
      {
        "id": "artboard-youtube",
        "name": "YouTube Full",
        "aspectRatio": "16:9",
        "width": 1920,
        "height": 1080,
        "framing": { "scale": 1.0, "offsetX": 0, "offsetY": 0, "fitMode": "contain" },
        "tracks": [
          {
            "id": "track-v2",
            "kind": "visual",
            "clips": [
              {
                "id": "clip-2",
                "assetId": "asset-rec-1",
                "compositionId": "comp-youtube-1",
                "startUs": 0,
                "sourceInUs": 0,
                "sourceOutUs": 60000000,
                "rate": 1.0
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Potongan `compositions/comp-tiktok-1.json`:
```json
{
  "id": "comp-tiktok-1",
  "packageId": "pkg-1",
  "revision": 1,
  "durationUs": 20000000,
  "settings": {
    "wallpaper": "linear-gradient(135deg, #6366f1, #a855f7)",
    "borderRadius": 16,
    "shadowIntensity": 0.45,
    "webcam": {
      "visible": true,
      "shape": "circle",
      "position": "top-center",
      "size": 220
    },
    "showCursor": true,
    "cursorSmoothing": 0.8,
    "zoomRegions": [
      {
        "id": "zoom-1",
        "startMs": 2000,
        "endMs": 7000,
        "depth": 2,
        "focus": { "cx": 0.5, "cy": 0.3 }
      }
    ]
  }
}
```

---

## 6. Ringkasan & Aturan Integritas V3

1. **Satu Project = Satu File `.captr`**: Tidak ada file eksternal yang tercecer; seluruh aset perpustakaan (*library*) tetap tersimpan di dalam bundle meskipun klipnya belum ditaruh di timeline.
2. **Tidak Menulis `slides/` atau `slide.json` Baru**: Struktur format V1/V2 warisan (*legacy slides*) telah digantikan sepenuhnya oleh arsitektur timeline multi-track dan multi-artboard V3.
3. **Independensi committed**: Mengganti nama video (*Rename*), menggandakan video (*Duplicate*), atau mengekspor sebagian video (*Batch Export*) dapat dilakukan langsung dari Artboard Hub secara cepat dan terisolasi.
