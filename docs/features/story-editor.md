# Story Editor

Story Editor menyusun video final milik Artboard dari recording, media impor, B-roll, Text/Shape, musik, dan narasi. Source reusable tetap dimiliki project; instruksi editing dimiliki Story atau placement.

## Permukaan editor

| Bagian | Fungsi |
| --- | --- |
| Assets | Satu panel media untuk source global dan source privat Story |
| Text / Shapes / Templates | Tool rail membuat overlay inline atau menyalin preset desain |
| Preview stage | Melihat frame komposisi, memilih dan menggeser objek dengan gizmo |
| Inspector | Mengubah properti clip, transform, keyframe, animasi, dan transisi |
| Canvas Inspector | Melihat dimensi output Artboard dan statistik saat tidak memilih clip |
| Timeline | Menyusun track visual/audio, timing clip, cut, rate, dan transisi |
| Copilot / Terminal | Menjalankan workflow agent dan tool project |

## Editing yang tersedia

Timeline menyediakan split, trim, move, duplicate, delete/ripple delete, snapping, pemilihan track, dan enable/mute sesuai jenis command. Visual dan audio ditempatkan di kelompok track yang sesuai.

Preview menyediakan frame stepping, jump start/end, loop, fullscreen, grid/safe-zone guides, serta zoom/pan workspace. Preview zoom memengaruhi area kerja, bukan rasio canvas output. Gizmo mengubah posisi/skala/rotasi placement melalui riwayat command.

Text dan Shape tidak menambah item media global. Konten inline dan styling dapat diedit, di-trim, di-split, serta dipulihkan melalui undo/redo. Preset Template menghasilkan salinan lokal independen.

## Scope dan history

Perubahan dikirim untuk Story/Artboard aktif. Owner yang hilang tidak dialihkan ke root. Root project tetap memiliki riwayat command bersama sehingga publication, placement, dan perubahan composition dapat di-undo dengan konsisten.

Proposal AI membawa identitas context dan revision. Hasil yang dibuat untuk Story/revision lama tidak boleh menimpa edit lebih baru.

## Source extent desain

Text/Shape baru memiliki logical source extent lima detik. Trim memperpendek bagian terlihat tanpa membuang extent; extension eksplisit dapat memperbesar extent secara undoable. Transisi memakai finite source handles sehingga tidak menganggap desain punya durasi tanpa batas.

## Fitur finishing berikutnya

Per 17 Oktober 2026:

- **Captions** di footer membuka editor caption final: generate dari transkrip atau tambah manual, edit teks/kata/timing/style, undo/redo, dan burn-in MP4 melalui Canvas yang sama dengan preview. Cue hasil generate memakai source clock per placement; cue manual memakai waktu Story.
- Audio timeline menggunakan peak sumber asli; video/Record memakai filmstrip dengan sampel mengikuti source clock. Loading atau kegagalan decode ditampilkan tanpa waveform sintetis.
- Toolbar menyediakan Copy/Paste, Copy/Paste attributes, Group/Ungroup, Link/Unlink dan Detach audio. `Ctrl/Cmd+C/V` menyalin klip, `Ctrl/Cmd+Shift+C/V` menyalin atribut, `Ctrl/Cmd+G` membuat grup dan `Ctrl/Cmd+Shift+G` melepas grup. Clipboard dibersihkan saat berganti Story/project.
- Grup/link menghubungkan seleksi dan gerak placement; ini tidak membuat nested compound Story. Detach audio mempertahankan source/package Record dan membuat komposisi placement independen. Gain/fade diterapkan pada playback dan export bersama.
- Inspector media menyediakan crop per sisi, mask rectangle/ellipse dengan inset, brightness/contrast/saturation, serta reset. Dimensi output tetap mengikuti Artboard. Keyframe memakai kontrol nilai dan graph Bezier yang dapat di-drag atau digeser memakai tombol panah; satu drag adalah satu langkah undo.

Insert/overwrite, ripple trim lanjutan, automation audio, nested compound Story, blend/LUT, speed curve, tracking dan proxy masih mengikuti [roadmap](../project/roadmap.md).

Fondasi ownership dan dua perbaikan migrasi terakhir telah lolos review; [verifikasi](../project/verification.md) membedakan tes otomatis dengan QA native yang masih pending.

