# Dokumentasi Resmi Captr Studio

Selamat datang di portal dokumentasi arsitektur, panduan teknis, dan manual pengembang untuk **Captr Studio** (v1.4.0-beta.1).

---

## 1. Navigasi Cepat Portal Dokumentasi

```
docs/
├── product/          # Visi produk, cakupan fitur, dan glosarium
├── features/         # Dokumentasi mendalam 12 fitur utama aplikasi
├── guides/           # Panduan pengguna, alur kerja, pintasan, dan troubleshooting
├── architecture/     # Spesifikasi teknis arsitektur V3, format .captr, dan evaluasi
├── development/      # Panduan setup lokal, kontribusi, dan API host ekstensi
├── reference/        # Spesifikasi teknis referensi (Hyperframe rules, format)
└── project/          # Roadmap, pelacakan isu regresi, dan laporan verifikasi tes
```

---

## 2. Katalog Dokumentasi

### 🌟 Produk & Gambaran Umum
- [Gambaran Umum Produk](product/overview.md) — Visi Captr Studio sebagai studio video all-in-one dari rekaman layar hingga repurposing multi-platform.
- [Status Fitur & Batas Dukungan](product/status.md) — Matriks status kesiapan fitur: fondasi yang telah diuji vs fitur finishing backlog.
- [Glosarium Istilah](product/glossary.md) — Definisi istilah standar: Artboard, Story, Placement, Composition, Hyperframe, MCP, dan format `.captr`.

### 🎬 Fitur Utama Aplikasi
- [Perekaman Layar (Recording)](features/recording.md) — Capture native layar, webcam, mikrofon, audio sistem, dan telemetri kursor.
- [Record Editor](features/record-editor.md) — Penyesuaian zoom dinamis, penghalusan kursor, layout webcam, dan framing adaptif.
- [Story Editor](features/story-editor.md) — Editor NLE non-linear dengan timecode SMPTE, frame stepping, split cerdas, dan transform on-canvas.
- [Artboards & Whiteboard Repurposer](features/artboards-whiteboard.md) — Hub multi-format (16:9, 9:16, 1:1, 4:5) dengan canvas tldraw offline mandiri.
- [AI Copilot & Terminal Dev](features/ai-copilot.md) — In-context Copilot Sidebar, Captr MCP Server, speculative ghost diff, dan project terminal.
- [Hyperframe Motion Graphics](features/hyperframe.md) — Komposisi visual berbasis HTML5/CSS/GSAP untuk kinetic typography dan B-roll.
- [Captions & Transkripsi](features/captions-transcription.md) — Integrasi model Whisper STT lokal untuk transkripsi dan karaoke pop captions.
- [Voiceover & Audio Mixer](features/voiceover-audio.md) — Perekaman mikrofon mandiri yang terikat ke Story Media privat serta manajemen audio track.
- [Assets & Templates Library](features/assets-templates.md) — Pustaka media global vs media privat Story, serta koleksi template teks/shape.
- [Ekspor Video & Rendering](features/export.md) — Pipeline evaluasi WebGL/Chromium offscreen dan encoding FFmpeg MP4.
- [Siklus Hidup Proyek & Home](features/project-lifecycle.md) — Navigasi Project Home, penamaan berbasis file, aturan Save As, dan atomic dirty state.
- [Sistem Ekstensi](features/extensions.md) — Host ekstensi renderer dengan izin akses terbatas (*permission-gated*).
- [Ringkasan Seluruh Fitur](features/README.md) — Indeks ikhtisar seluruh modul dan kapabilitas.

### 📖 Panduan Pengguna (Guides)
- [Panduan Memulai Cepat (Getting Started)](guides/getting-started.md) — Langkah awal membuat proyek, merekam, menyunting, dan mengekspor video.
- [Alur Kerja Record ke Story](guides/record-to-story.md) — Memindahkan rekaman mentah ke Story Editor dengan komposisi mandiri.
- [Panduan Repurposing Konten](guides/repurpose.md) — Mengubah satu master video menjadi format YouTube Shorts, Instagram, dan LinkedIn.
- [Daftar Pintasan Keyboard (Shortcuts)](guides/shortcuts.md) — Daftar lengkap tombol shortcut untuk navigasi dan editing cepat.
- [Panduan Pemecahan Masalah (Troubleshooting)](guides/troubleshooting.md) — Solusi kendala umum, file lock, port re-basing, dan pemulihan data.

### 📐 Arsitektur Sistem
- [Model Kepemilikan Aset & Story V3](architecture/ownership.md) — Fondasi pemisahan kepemilikan aset global, Story privat, dan elemen inline Text/Shape.
- [Format Proyek .captr V3](architecture/project-format.md) — Spesifikasi arsip ZIP Store Level 0, `project.json` authoritative, dan layout direktori.
- [Integrasi Agen AI & MCP Server](architecture/agent-mcp.md) — Protokol Model Context Protocol, streaming SSE, edit tools, dan terminal context.
- [Waktu, Clock & Evaluator Rendering](architecture/timing-rendering.md) — Pemetaan waktu bertingkat 3-layer, durasi inline 5 detik, dan paritas evaluasi.

### 🛠️ Pengembangan (Developer Guides)
- [Panduan Setup Lingkungan Dev](development/setup.md) — Instalasi dependensi, eksekusi dev server, perintah vitest, dan graft workflow.
- [Pedoman Berkontribusi (Contributing Guide)](development/contributing.md) — Aturan percabangan, checklist regresi sebelum commit, dan kode etik.
- [Referensi API Ekstensi](development/extensions-api.md) — Spesifikasi manifes, render hooks, efek kursor, query status, dan panel UI.

### 📋 Referensi & Pelacakan Proyek
- [Aturan & Spesifikasi Hyperframe](reference/hyperframe-rules.md) — Kontrak wajib frame-stepper deterministik `#root`, GSAP paused, dan `window.seekFrame`.
- [Indeks Log Isu & Cek Regresi](project/issues/README.md) — Ringkasan isu historis #1 hingga #12 dan kontrak regresi kritis.
- [Roadmap & Milestone Rilis](project/roadmap.md) — Target milestone Fase 1 hingga Fase 5 dan backlog finishing Story Editor.
- [Laporan Verifikasi Pengujian](project/verification.md) — Bukti kelulusan 224 pengujian pada 15 suite terkait kepemilikan aset V3.

---

## 3. Aturan Regresi Kritis untuk Pengembang

Sebelum membuat perubahan pada modul penyuntingan atau penyimpanan, selalu verifikasi 4 pilar arsitektur Captr Studio:
1. **Preservasi Path Proyek**: Perekaman baru pada proyek aktif tidak boleh mereset `currentProjectPath` atau memicu *Save As*.
2. **Authoritative `project.json`**: Arsip `.captr` V3 menyimpan seluruh metadata di `project.json`. Direktori `slides/` tidak boleh ditulis kembali.
3. **Integritas XOR Klip Story**: Setiap klip visual wajib memiliki tepat satu dari `assetId` atau `content` (tanpa membuat aset global palsu untuk teks/shape).
4. **Isolasi Artboard**: Perubahan timeline dan media privat pada satu Artboard tidak boleh memutasi Artboard lain.

---
*Dokumentasi ini diselaraskan dengan basis kode branch `Experiment` per 10 Oktober 2026.*
