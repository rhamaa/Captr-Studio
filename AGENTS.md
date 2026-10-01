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
4. Satu file `.captr` per project V3; `project.json` indeks authoritative, sumber dan sidecar di `assets/<assetId>/`, komposisi terpisah. Semua aset library termasuk yang belum ditempatkan harus tersimpan. Jangan menulis `slides/` atau `slide.json` baru.
5. Perbarui `ISSUE.md` saat kontrak berubah. Verifikasi Ctrl+S setelah Record berulang, import video/gambar/audio, Assets-only save/reopen, dan placement Record ganda dengan edit independen. Konversi V1/V2 Record harus eksplisit ke salinan dengan identitas/path baru; metadata tidak didukung menolak keseluruhan tanpa mengubah file asli. Video/Motion legacy tetap ditolak.
