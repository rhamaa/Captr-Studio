# Pedoman Berkontribusi (Contributing Guide)

Terima kasih atas ketertarikan Anda untuk berkontribusi pada pengembangan **Captr Studio**! Dokumen ini menguraikan standar arsitektur, kebijakan branch, aturan pengujian regresi, dan alur kerja pembuatan kontribusi kode.

---

## 1. Kebijakan Percabangan (Branching Model)

- **`main`**: Branch produksi yang stabil. Semua kode di `main` harus lolos build, verifikasi otomatis penuh, dan uji coba native desktop.
- **`Experiment`**: Branch aktif untuk pengembangan fitur baru, refaktor arsitektur, dan iterasi purwarupa sistemik. Seluruh fondasi model kepemilikan aset Story V3 saat ini berada di branch ini.
- **Feature / Bugfix Branches**: Cabangkan dari `Experiment` (atau `main` untuk hotfix) dengan pola penamaan:
  - `feat/nama-fitur`
  - `fix/nama-bug`
  - `docs/pembaruan-dokumentasi`
  - `refactor/komponen-inti`

---

## 2. Kontrak Arsitektur yang Tidak Boleh Dilanggar

Setiap kontributor wajib mematuhi aturan absolut yang tercantum pada [AGENTS.md](../../AGENTS.md) dan [ISSUE.md](../../ISSUE.md):

### A. Kontrak Penyimpanan & Format .captr V3
1. **Satu Proyek, Satu Berkas `.captr`**:
   - Berkas `.captr` adalah arsip ZIP Store Level 0 (tanpa kompresi ganda pada media terkompresi).
   - `project.json` di root zip adalah satu-satunya indeks authoritative.
   - Sumber media dan berkas sidecar tersimpan di `assets/<assetId>/`.
   - **Dilarang** menulis folder `slides/` atau berkas `slide.json` baru pada seluruh alur V3.
2. **Preservasi Path Proyek pada Perekaman Layar**:
   - Penambahan rekaman baru pada proyek aktif **tidak boleh** memicu dialog *Save As* atau mereset `currentProjectPath`.
   - Rekaman baru hanya didaftarkan ke `project.assets` sebagai item global tanpa penempatan otomatis di timeline.
   - Perintah Ctrl+S hanya boleh menimpa berkas jika `projectId` dari payload cocok dengan `projectId` berkas `.captr` yang aktif.

### B. Kepemilikan Elemen Story & Media Privat
1. **Aturan XOR Konten Klip**:
   - Setiap `TimelineClip` visual harus memiliki tepat satu dari `assetId` (untuk media file eksternal/privat) atau `content` (untuk teks/shape inline).
   - **Dilarang** membuat `MediaAsset` tiruan di library media untuk teks atau bentuk vektor geometri.
2. **Isolasi Artboard & Multi-Story**:
   - Seluruh mutasi timeline, klip, transisi, dan media privat pada satu Artboard harus terisolasi pada `localAssets` dan trek Artboard tersebut.
   - Duplikasi Artboard wajib menghasilkan ID baru untuk klip dan komposisi lokal, namun tetap berbagi sumber media global yang sama.
3. **Normalisasi Mundur yang Non-Destruktif**:
   - Berkas `.captr` V3 versi lama yang masih memuat teks/shape di level global dinormalisasi menjadi elemen inline saat dimuat ke memori (klon runtime).
   - Berkas asli pada disk **tidak boleh** dimutasi secara otomatis sampai pengguna menekan Save/Ctrl+S secara eksplisit.

### C. Keamanan Re-Render React & Interaksi Kanvas
1. **Tidak Ada Efek Samping di Fase Render**:
   - Jangan pernah memanggil fungsi mutasi controller (`controller.execute`) atau updater state induk di dalam siklus render komponen React atau di dalam fungsi callback `setState((prev) => ...)`.
2. **Peredaman ResizeObserver**:
   - Pengamatan ukuran elemen DOM kanvas/gizmo wajib menggunakan `requestAnimationFrame` dan memeriksa toleransi batas geometri sebelum memperbarui state dimensi.

---

## 3. Alur Kerja Pengembangan (Workflow)

### Langkah 1: Eksplorasi dengan Graft Context Graph
Sebelum membuka berkas sumber atau melakukan perubahan luas, gunakan Graft untuk memetakan definisi dan relasi kode:

```bash
# Temukan konteks fungsi atau tipe
graft ask "<nama_fungsi_atau_pertanyaan>" --source

# Analisis pemanggil fungsi (blast radius)
graft callers <NamaFungsi>
```

### Langkah 2: Siklus Test-Driven Development (TDD)
1. Tulis atau perbarui unit test yang mendefinisikan perilaku baru (Red).
2. Terapkan kode implementasi seminimal dan sebersih mungkin (Green).
3. Lakukan refaktor kode dengan menjaga seluruh pengujian tetap hijau (Refactor).

### Langkah 3: Validasi Menyeluruh Sebelum Commit
Jalankan rangkaian pemeriksaan otomatis lokal:

```bash
# 1. Pastikan seluruh pengujian unit lulus 100%
npx vitest run

# 2. Pastikan tidak ada kesalahan kompilasi TypeScript
npx tsc --noEmit

# 3. Jalankan linter Biome
npx @biomejs/biome check src electron

# 4. Perbarui graph konteks Graft jika terdapat penambahan berkas/fungsi baru
npx graft build
```

---

## 4. Standar Pesan Commit (Conventional Commits)

Gunakan format pesan commit yang terstruktur dan deskriptif:

- `feat: tambah kontrol looping pada transport Story Editor`
- `fix: atasi infinite re-render loop pada CanvasTransformGizmo`
- `refactor: pisahkan media privat Story dari global asset library`
- `docs: lengkapi panduan setup dan indeks issue regresi`
- `test: tambahkan verifikasi round-trip inline shape pada format .captr`

---

## 5. Daftar Cek Sebelum Mengajukan Pull Request (PR)

- [ ] Seluruh unit test lokal lolos (`npx vitest run`).
- [ ] TypeScript typecheck lolos dengan 0 errors (`npx tsc --noEmit`).
- [ ] Kontrak regresi `ISSUE.md` dan `AGENTS.md` terpenuhi.
- [ ] Tidak ada berkas debug sementara atau direktori temporer yang ikut ter-commit.
- [ ] Dokumentasi Markdown di bawah `docs/` telah diperbarui jika ada perubahan antarmuka atau arsitektur publik.
- [ ] `graft build` telah dijalankan untuk memperbarui indeks repo graph.

---

## 6. Rujukan Terkait
- [Panduan Setup Lingkungan Pengembang](setup.md)
- [Spesifikasi API Ekstensi](extensions-api.md)
- [Indeks Log Isu & Regresi](../project/issues/README.md)
- [Arsitektur Kepemilikan Aset](../architecture/ownership.md)
