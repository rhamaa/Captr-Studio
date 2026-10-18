# AI Custom Harness dan Context-Aware Editing Engine

Captr Studio menyediakan arsitektur integrasi AI yang dirancang khusus untuk alur kerja video editing: **Custom Harness UI** berbasis Spotlight (`Ctrl+K`), **Surface Awareness** yang mendalam, dan **MCP (Model Context Protocol) Server** lokal untuk runner eksternal.

Seluruh operasi AI bekerja dengan prinsip **arsitektur non-redundant**: AI membaca konfigurasi konteks dari file `.captr`, lalu mengubah metadata project di memori via `ProjectController.execute` secara atomik dan memiliki riwayat *undo/redo*, tanpa memanipulasi file media asli atau merender proxy video sintetis.

---

## 1. Antarmuka Pengguna: Custom Harness UI

### Floating Command Bar (`Ctrl+K` / `Cmd+K`)
Command palette melayang bergaya Spotlight yang dapat dipanggil dari mana saja di dalam editor:
- **Active Surface Badge:** Menampilkan lokasi kerja pengguna secara presisi (contoh: `Record Editor • Framing & Appearance`, `Story Timeline • 2 clips selected`, `Caption Editor`, atau `Artboard Canvas`).
- **Contextual Action Pills:** Tombol aksi cepat cerdas yang beradaptasi secara dinamis dengan surface yang aktif:
  - Di *Record Editor*: `Auto-Zoom to Clicks`, `Style: Brutalism`, `Style: Claymorphism`, `Style: Glassmorphism`, dsb.
  - Di *Story Timeline*: `Remove Silence`, `Apply Dynamic Cuts`, dsb.
  - Di *Caption Editor*: `Fix Typos & Timing`, `Generate Captions`, dsb.
  - Di *Artboard Canvas*: `Repurpose 9:16 Shorts`, `Batch Layout`, dsb.
- **Natural Language Input:** Pengguna dapat mengetikkan instruksi khusus dalam bahasa alami.
- **Navigasi Keyboard Penuh:** Gunakan panah `↑`/`↓` untuk memilih pill, `Enter` untuk mengeksekusi, dan `Esc` untuk menutup.

### Speculative Ghost Preview Drawer
Ketika AI mengajukan draf rencana pengeditan:
- Kotak melayang muncul di pojok kanan bawah menampilkan ringkasan perbedaan (jumlah klip ditambah, dihapus, atau diubah, serta perubahan durasi timeline).
- Garis waktu merender **Ghost Clips** spekulatif sehingga pengguna dapat langsung meninjau hasil editing sebelum berkomitmen.
- **Accept Changes (`Enter`):** Mengesahkan draf ke dalam project utama via satu transaksi undoable command.
- **Discard (`Esc`):** Menolak draf dan mengembalikan kanvas ke state sebelumnya tanpa jejak.

---

## 2. Surface Awareness Real-Time

Aplikasi secara proaktif menyinkronkan state navigasi UI ke layer MCP dan core harness (`ActiveSurface`):
1. **`record-editor`**: Mendeteksi asset recording aktif, tab aktif (`appearance`, `scene`, `cursor`, `layout`), dan konfigurasi framing.
2. **`story-editor`**: Mendeteksi klip yang sedang dipilih, posisi playhead, dan trek timeline aktif.
3. **`caption-editor`**: Mendeteksi segmen subtitle aktif dan kata-kata transkrip.
4. **`artboard`**: Mendeteksi kanvas multi-aspek yang sedang difokuskan (16:9, 9:16, 1:1, 4:5).
5. **`voiceover`**: Mendeteksi sesi perekaman suara dan trek audio narasi.
6. **`home`**: Mendeteksi kondisi saat pengguna berada di layar depan / belum membuka project.

---

## 3. Integrasi CLI Runner & Terminal Eksternal

Captr Studio memisahkan layer reasoning AI dari UI aplikasi:
- **Terminal Runner:** Mengakses LLM/Agent menggunakan tool CLI pilihan pengguna di terminal lokal (`agy` / Antigravity, `opencode`, `hermes`, `cursor`, `claude`, atau custom CLI).
- **Local MCP Server:** Menjalankan server MCP lokal pada port terkonfigurasi (default: `4040`).
- **Graceful Closed-Project Handling:** Jika agent eksternal memanggil `get_project_context` saat project belum dibuka, MCP server merespons dengan JSON terstruktur `{ isProjectOpen: false, activeView: "home", availableActions: [...] }` tanpa crash.

---

## 4. Konfigurasi Hierarkis

1. **Global App Preferences (`AppSettingsDialog` > AI Harness & Models):**
   - **Preferred Runner:** Memilih runner utama (`agy`, `opencode`, `hermes`, `cursor`, `custom`).
   - **Custom CLI Path:** Path absolut executable jika menggunakan runner kustom.
   - **Default Model:** Model LLM default (misal: `gemini-1.5-pro`, `claude-3-5-sonnet`, `gpt-4o`).
   - **MCP Server Port:** Port listener local MCP server.
   - **Ghost Preview:** Toggle untuk mengaktifkan/menonaktifkan pratinjau spekulatif sebelum commit.
2. **Project-Level Override (`project.json` di dalam `.captr`):**
   - Konfigurasi `aiConfig` opsional di tingkat project untuk menentukan model override atau persona instruksi khusus project tersebut.

---

## 5. Batas Desain & Keamanan

- Semua mutasi project harus mematuhi validasi V3 schema dan melewati `ProjectController.execute`.
- AI tidak diperkenankan menghapus atau menimpa aset media mentah di direktori `assets/<assetId>/`.
- Timeline preview dan proses export video MP4 mengevaluasi state project yang sama, menjamin hasil *What You See Is What You Get*.

