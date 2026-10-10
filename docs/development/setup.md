# Panduan Setup Lingkungan Pengembangan (Developer Setup)

Dokumen ini memandu pengembang untuk menyiapkan, menjalankan, menguji, dan membangun **Captr Studio** di lingkungan lokal.

---

## 1. Prasyarat Sistem

Sebelum memulai, pastikan sistem Anda telah terpasang perangkat lunak berikut:

- **Sistem Operasi**: Windows 10/11 (64-bit), macOS 12+ (Apple Silicon / Intel), atau Linux (Ubuntu 22.04+).
- **Node.js**: Versi `v18.18.0` atau `v20.x` (LTS direkomendasikan).
- **npm**: Versi `9.x` atau lebih baru (termasuk bersama Node.js).
- **Git**: Versi `2.35+` untuk version control.
- **FFmpeg**: Terpasang di sistem PATH atau runtime pendukung untuk encoding video native dan ekstraksi audio.
- **PowerShell / Bash**: Terminal modern dengan izin eksekusi skrip lokal.

---

## 2. Instalasi Proyek

Jalankan perintah berikut di terminal Anda:

```bash
# 1. Kloning repositori
git clone https://github.com/captr-studio/captr-studio.git
cd "Captr Studio"

# 2. Beralih ke branch kerja aktif
git checkout Experiment

# 3. Pasang seluruh dependensi proyek
npm install
```

> [!NOTE]
> Proyek menggunakan arsitektur hybrid **Electron + Vite + React + TypeScript**. Dependensi mencakup komponen UI, bundler Zip (`archiver`), engine whiteboard (`@tldraw/tldraw`), terminal (`@xterm/xterm`), dan test runner (`vitest`).

---

## 3. Alur Kerja Navigasi Repositori: Graft Context Graph

Repositori Captr Studio diindeks secara berkala menggunakan **Graft** (`graft/`), sebuah graph konteks kode deterministik yang memetakan file, fungsi, kelas, dan rentang baris presisi.

Sesuai aturan kerja di `AGENTS.md` dan `GEMINI.md`:
- **Cari pemahaman atau fungsi:**
  ```bash
  graft ask "<pertanyaan atau nama simbol>" --source
  ```
- **Pencarian menyeluruh:**
  ```bash
  graft grep "<nama_simbol_atau_string>"
  ```
- **Cek relasi pemanggil (callers):**
  ```bash
  graft callers <NamaFungsi>
  ```
- **Perbarui graph setelah perubahan kode besar:**
  ```bash
  npx graft build
  ```

---

## 4. Menjalankan Mode Pengembangan (Dev Server)

Untuk menjalankan server Vite dan aplikasi Electron dalam mode live reload:

```bash
npm run dev
```

Saat perintah ini dijalankan:
1. Vite mengompilasi bundel renderer web di `http://localhost:5173/`.
2. Electron mengompilasi script utama (`dist-electron/main.cjs`) dan preload (`dist-electron/preload.mjs`).
3. Server media lokal HTTP dijalankan pada port acak lokal (`http://127.0.0.1:<port>`) untuk melayani pemutaran video dan sidecar audio secara streaming.
4. Jendela aplikasi desktop akan terbuka secara otomatis.

---

## 5. Menjalankan Pengujian (Testing)

Proyek mengandalkan **Vitest** untuk pengujian unit dan integrasi:

```bash
# Menjalankan seluruh test suite secara headless
npx vitest run

# Menjalankan test suite tertentu yang spesifik (misal: Story commands)
npx vitest run src/core/timeline/storyCommands.test.ts

# Menjalankan test suite dengan mode watch
npx vitest src/core/timeline/
```

### Verifikasi Typecheck & Linter
Pastikan tidak ada kesalahan kompilasi TypeScript sebelum membuat commit:

```bash
# Typecheck TypeScript tanpa output berkas
npx tsc --noEmit

# Pemeriksaan linter menggunakan Biome
npx @biomejs/biome check src electron
```

---

## 6. Membangun Paket Produksi (Production Build)

Untuk menguji build final installer aplikasi desktop:

```bash
# Mengompilasi renderer dan proses utama Electron
npm run build

# Menghasilkan installer executable (Windows .exe / macOS .dmg)
npm run package
```

Hasil kompilasi dan distribusi paket installer akan tersimpan di direktori `release/` atau `dist/`.

---

## 7. Pemecahan Masalah Umum (Troubleshooting Dev)

- **Port Conflict pada Media Server:**
  Captr Studio secara otomatis memilih port dinamis yang bebas. Jika terjadi bentrokan port, matikan proses Electron yang menggantung di Task Manager (`electron.exe`).
- **Pemberitahuan Insecure Content Security Policy (CSP):**
  Peringatan CSP di konsol renderer hanya muncul selama mode `dev` untuk mendukung Hot Module Replacement (HMR) Vite. Peringatan ini otomatis nonaktif saat aplikasi dipaketkan ke produksi.
- **Eksekusi PowerShell Ditolak di Windows:**
  Jika muncul error `execution of scripts is disabled on this system`, buka PowerShell as Administrator dan jalankan:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

---

## 8. Rujukan Terkait
- [Pedoman Berkontribusi (Contributing Guide)](contributing.md)
- [Spesifikasi API Ekstensi](extensions-api.md)
- [Log Isu & Cek Regresi](../project/issues/README.md)
- [Arsitektur Format .captr V3](../architecture/project-format.md)
