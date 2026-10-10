# 📐 Spesifikasi Arsitektur: Modular Story & Hyperframe Container V4

Dokumen ini menetapkan spesifikasi arsitektur masa depan untuk **Captr Studio**, yang mentransformasi berkas proyek `.captr` dari model flat menjadi **Modular Multi-Story & Programmatic Hyperframe Production Studio**.

---

## 🌟 1. Visi & Tujuan Arsitektur

Saat ini, satu file `.captr` menyimpan aset dan komposisi di dalam `project.json`. Dengan berkembangnya kebutuhan kreator untuk membuat **banyak video berbeda (berbagai topik, format, dan durasi) dari sesi rekaman yang sama**, arsitektur V4 memisahkan setiap video ke dalam entitas mandiri yang disebut **Story** dan **Hyperframe Composition**.

### Prinsip Utama:
1. **Shared Asset Pool**: Seluruh rekaman mentah (layar, webcam, mikrofon), musik, transkrip Whisper, dan grafis disimpan terpusat di `assets/<assetId>/` dan dibagi bersama ke semua Story tanpa duplikasi berkas.
2. **Modular Story Composition**: Setiap video independen memiliki berkas konfigurasinya sendiri di sub-folder `Story/story-[id].json`.
3. **Code-Driven Hyperframe Sub-Project**: Video yang digerakkan oleh kode dan AI Agent disimpan di sub-folder `hyperframe/hyperframe-[id].html`.
4. **Transparent Auto-Migration**: Proyek lama berbasis V3 otomatis dinormalisasi tanpa merusak data atau alur pengguna.

---

## 📂 2. Struktur Kontainer Berkas `.captr` V4

Berkas `.captr` adalah sebuah zip archive (atau folder terstruktur) dengan hierarki sebagai berikut:

```
my-production.captr
├── project.json                       <-- Manifest global & shared assets registry
├── assets/                            <-- Pustaka aset terbagi (Shared Assets)
│   ├── asset_screen_01/
│   │   ├── source.mp4
│   │   ├── audio.wav
│   │   ├── transcript.json            <-- Whisper word-level timestamps
│   │   └── thumbnail.jpg
│   ├── asset_webcam_01/
│   │   └── source.mp4
│   └── asset_bgm_01/
│       └── source.mp3
│
├── Story/                             <-- Sub-Project Timeline Stories
│   ├── story-main-tutorial.json       <-- Story 1: Video Utama 16:9 Landscape
│   ├── story-main-tutorial.thumb.jpg
│   ├── story-tiktok-hook.json         <-- Story 2: Cuplikan Hook 9:16 Shorts
│   ├── story-tiktok-hook.thumb.jpg
│   ├── story-qa-recap.json            <-- Story 3: Video Tanya Jawab 1:1 Square
│   └── story-qa-recap.thumb.jpg
│
└── hyperframe/                        <-- Code-Driven Motion Graphics Compositions
    ├── hyperframe-kinetic-intro.html  <-- Animasi HTML5/CSS/GSAP entry point
    ├── hyperframe-kinetic-intro.json  <-- Declarative spec & AI Agent graph
    ├── hyperframe-stat-counter.html
    └── hyperframe-stat-counter.json
```

---

## 📜 3. Spesifikasi Skema Data

### A. Manifest Global (`project.json`)
`project.json` bertindak sebagai indeks authoritative tingkat atas:
```json
{
  "version": 4,
  "projectId": "captr_proj_8f91a2",
  "title": "Claude Code Masterclass",
  "createdAt": "2026-10-06T10:00:00.000Z",
  "updatedAt": "2026-10-06T11:00:00.000Z",
  "defaultStoryId": "story-main-tutorial",
  "stories": [
    {
      "id": "story-main-tutorial",
      "name": "Full Walkthrough (16:9)",
      "file": "Story/story-main-tutorial.json",
      "aspectRatio": "16:9",
      "durationUs": 600000000
    },
    {
      "id": "story-tiktok-hook",
      "name": "Quick Tips Hook (9:16)",
      "file": "Story/story-tiktok-hook.json",
      "aspectRatio": "9:16",
      "durationUs": 45000000
    }
  ],
  "hyperframes": [
    {
      "id": "hyperframe-kinetic-intro",
      "name": "Kinetic Typography Intro",
      "entryHtml": "hyperframe/hyperframe-kinetic-intro.html",
      "specJson": "hyperframe/hyperframe-kinetic-intro.json",
      "targetStoryId": "story-tiktok-hook"
    }
  ],
  "assets": [ /* Shared MediaAsset[] */ ],
  "packages": [ /* Shared RecordingPackage[] */ ],
  "compositions": [ /* Shared RecordComposition[] */ ]
}
```

---

### B. Skema Individual Story (`Story/story-[id].json`)
Setiap berkas Story mengorkestrasikan satu video mandiri secara menyeluruh:
```json
{
  "id": "story-tiktok-hook",
  "name": "Quick Tips Hook (9:16)",
  "aspectRatio": "9:16",
  "canvas": {
    "width": 1080,
    "height": 1920,
    "fps": 60,
    "background": "#0f172a"
  },
  "framing": {
    "scale": 1.25,
    "offsetX": 0.05,
    "offsetY": -0.1,
    "fitMode": "cover"
  },
  "tracks": [
    {
      "id": "track_v1_aroll",
      "name": "Primary Video (A-Roll)",
      "kind": "visual",
      "clips": [
        {
          "id": "clip_raw_01",
          "assetId": "asset_screen_01",
          "startUs": 0,
          "sourceInUs": 12000000,
          "sourceOutUs": 57000000,
          "rate": 1.0,
          "transform": { "x": 0, "y": 0, "scale": 1, "rotation": 0, "opacity": 1 }
        }
      ]
    },
    {
      "id": "track_v2_broll",
      "name": "Hyperframe Overlay (B-Roll)",
      "kind": "visual",
      "clips": [
        {
          "id": "clip_hyperframe_01",
          "assetId": "asset_broll_rendered_01",
          "startUs": 15000000,
          "sourceInUs": 0,
          "sourceOutUs": 4500000,
          "rate": 1.0,
          "transform": { "x": 0, "y": -200, "scale": 0.95, "rotation": 0, "opacity": 1 }
        }
      ]
    },
    {
      "id": "track_a1_voice",
      "name": "Presenter Voiceover",
      "kind": "audio",
      "clips": [ /* Audio clips */ ]
    }
  ],
  "clipTransitions": [ /* ClipTransition[] */ ],
  "subtitles": {
    "enabled": true,
    "style": "karaoke-pop",
    "primaryColor": "#FFE600"
  }
}
```

---

### C. Skema Komposisi Hyperframe (`hyperframe/hyperframe-[id].html`)
Sebuah berkas HTML mandiri yang memanfaatkan library GSAP dan Web Canvas untuk animasi motion graphics yang pixel-perfect:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; background: transparent; overflow: hidden; font-family: system-ui, sans-serif; }
    .card {
      position: absolute; width: 800px; height: 350px;
      left: 140px; top: 785px;
      background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(20px);
      border: 2px solid rgba(56, 189, 248, 0.5); border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      color: #ffffff; opacity: 0; transform: scale(0.85);
    }
    .badge { background: #38bdf8; color: #000; font-weight: 800; padding: 6px 16px; border-radius: 999px; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
</head>
<body>
  <div id="scene-root">
    <div class="card" id="feature-card">
      <span class="badge">CLAUDE CODE MODS</span>
      <h1 style="font-size: 48px; margin: 16px 0 0 0;">Zero Setup Terminal Agent</h1>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.to("#feature-card", { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" })
      .to("#feature-card", { opacity: 0, scale: 0.95, duration: 0.3, delay: 3.5 });
    
    // Antarmuka Driver Headless Renderer
    window.seekFrame = function(timeInSeconds) {
      tl.seek(timeInSeconds);
    };
  </script>
</body>
</html>
```

---

## 🤖 4. Alur Kerja Otonom dengan AI Agent

Dengan struktur modular ini, AI Agent (`agy`, `claude`, `cursor`, `gemini`) dapat diperintahkan melakukan orkestrasi lengkap:

```
User Prompt:
"@ScreenRecord tolong buatkan Story baru bernama 'Shorts Viral'. 
Ambil momen di detik 00:30 sampai 01:15, potong jeda heningnya, 
reframe ke 9:16, dan buatkan animasi Hyperframe kinetic title card di awal!"
```

### Eksekusi Otonom AI:
1. Agent membaca `assets/asset_screen/transcript.json` untuk menemukan segmen topik yang diminta.
2. Agent membuat berkas `Story/story-shorts-viral.json` berisi track klip 9:16.
3. Agent meng-generate berkas `hyperframe/hyperframe-shorts-intro.html` lengkap dengan teks judul dan animasi GSAP.
4. Agent mendaftarkan Story dan Hyperframe baru ke dalam `project.json`.
5. Captr Studio me-reload tampilan Artboard Hub dan menampilkan video baru tersebut siap preview dan ekspor!

---

## 🔄 5. Strategi Migrasi Kompatibilitas Mundur

Ketika Captr Studio membuka berkas `.captr` versi V3 atau lebih lama:
1. **Deteksi Versi**: Sistem memeriksa apakah folder `Story/` ada di dalam arsip `.captr`.
2. **Auto-Fork Transparan**: Jika belum ada, sistem membaca `project.tracks` dan `repurposeBoard.artboards`, lalu secara otomatis mengekstraknya menjadi:
   - `Story/story-default.json` (untuk sequence utama)
   - `Story/story-[artboardName].json` (untuk masing-masing artboard yang memiliki sequence sendiri)
3. **Penyimpanan Atomik**: Saat pengguna menekan `Ctrl+S`, seluruh berkas disimpan dengan format V4 tanpa mengubah identitas unik `projectId` atau path berkas asli.
