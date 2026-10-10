<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->

## Regression checklist untuk Record slide dan project `.captr`

Sebelum mengubah pembuatan slide Record, Recorder HUD, finalisasi rekaman, project save/autosave, atau bundling `.captr`:

1. Baca issue log dan checklist **“Menambahkan Record slide meminta project baru”** di `ISSUE.md`.
2. Rekaman tambahan masuk ke Assets project aktif saja, tanpa penempatan timeline otomatis. `videoSourcePath` kosong atau tidak ada clip terpilih bukan penentu project baru.
3. Pastikan `currentProjectPath` tetap terjaga sepanjang Recorder HUD dan finalisasi native/browser bila rekaman berasal dari project aktif. Jangan mengasumsikan jalur Windows melewati finalizer macOS: handler sesi harus mengonsumsi konteks `preserveProjectPath` tertunda sebelum memutuskan reset path. Jika state Electron dan renderer berbeda, Ctrl+S hanya boleh memulihkan path dari bundle yang `projectId`-nya sama dengan data yang akan disimpan. Alur project baru harus tetap dapat meminta lokasi save baru.
4. Satu file `.captr` per project V3; `project.json` indeks authoritative, sumber dan sidecar di `assets/<assetId>/`, komposisi terpisah. Semua Assets global, root-private, dan private milik setiap Artboard termasuk yang belum ditempatkan harus tersimpan; Story/manifest adalah proyeksi dari owner canonical setelah path staging/resolution. Jangan menulis `slides/` atau `slide.json` baru.
5. Perbarui `ISSUE.md` saat kontrak berubah. Verifikasi Ctrl+S setelah Record berulang, import video/gambar/audio, Assets-only save/reopen, dan placement Record ganda dengan edit independen. Konversi V1/V2 Record harus eksplisit ke salinan dengan identitas/path baru; metadata tidak didukung menolak keseluruhan tanpa mengubah file asli. Video/Motion legacy tetap ditolak.

## V3 visual effects dan shape

- `project.json` authoritative menyimpan relasi `clipTransitions` dan animasi komponen per placement; field transisi opsional harus tetap backward-compatible dengan project V3 yang tidak memilikinya.
- Text dan Shape rectangle, ellipse, line, arrow dimiliki clip Story melalui `content`; tepat satu dari `content` atau `assetId`. Definisi Shape di `content.shapeDefinition`, teks di `content.text`, dan styling override per placement tetap pada clip. Tidak membuat Asset/file media sintetis.
- Root tracks dan explicit tracks/localAssets Artboard authoritative; Story/manifest/file `Story/` diproyeksikan ulang. Assets global hanya video/image/audio/recording; tiap library private hanya video/image/audio. Templates menyalin desain secara independen.
- Normalisasi V3 lama pada clone: desain yang dipakai menjadi inline, desain tak terpakai menjadi Templates; sumber asli tidak ditulis ulang. Handle Shape legacy dipad/grow hanya bila perlu dengan visible clock tetap. Extent inline baru 5.000.000 µs; trim mempertahankannya, extension eksplisit undoable.
- Command Story memakai scope/projectId/generation/revision yang tertangkap; voiceover memakai context immutable saat begin. Screen Record tetap global Assets-only. Source/package Record bersama, composition milik placement independen.
- Transisi menghubungkan clip visual bersebelahan pada track yang sama, menjaga durasi timeline, dan mengambil source handle sesuai playback rate. Jika edit membuat pasangan tidak valid, bersihkan relasi secara undoable; durasi di luar handle ditolak.
- Preview dan export harus menggunakan evaluasi visual yang sama. Jangan meratakan Recording package atau mengubah jalur simpan/capture saat menambah efek.
- Catat status QA native dan cakupan tes terbaru di `ISSUE.md`.

## Home dan nama project

Home tidak memiliki projectId aktif atau target save tersembunyi. Startup hanya melewati Home untuk intent Open/capture yang terverifikasi. Filename `.captr` authoritative untuk nama terlihat; title internal tanpa ekstensi. Rename mempertahankan identitas/folder, Save As membuat salinan dengan identitas baru dan mempertahankan asli. Undo/redo mempertahankan nama/identitas committed. Switch Home/New/Open harus menjaga dirty revisions dan menolak capture/finalisasi/export/file operation aktif. Tetap ikuti seluruh kontrak recording V3 di atas.

Listing/recovery library, load dan transaksi file berbagi antrean; jangan menjalankan recovery terhadap Rename aktif. Preparation/finalisasi capture harus memiliki lease proses utama dan menolak completion dari project yang sudah ditinggalkan. Freeze edit selama navigasi asynchronous; Rename/Save As harus menunggu import/probe selesai. Rename yang sudah commit terverifikasi mengembalikan sukses dengan warning bila hanya cleanup gagal.
