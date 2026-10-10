# Story Editor

Story Editor menyusun video final milik Artboard dari recording, media impor, B-roll, Text/Shape, musik, dan narasi. Source reusable tetap dimiliki project; instruksi editing dimiliki Story atau placement.

## Permukaan editor

| Bagian | Fungsi |
| --- | --- |
| Assets / Story Media / Templates | Memilih source global, source privat, atau preset desain |
| Text / Shapes | Membuat elemen inline pada Story aktif |
| Preview stage | Melihat frame komposisi, memilih dan menggeser objek dengan gizmo |
| Inspector | Mengubah properti clip, transform, keyframe, animasi, dan transisi |
| Canvas Inspector | Mengatur output canvas/fps dan melihat statistik saat tidak memilih clip |
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

Caption metadata sudah dipertahankan, tetapi editor caption final dan burn-in Story belum selesai. Waveform masih sintetis, filmstrip belum tersedia. Clipboard/attributes, group, link/unlink, insert/overwrite, audio automation, mask/color, graph keyframe, speed curve, tracking, dan proxies mengikuti [roadmap](../project/roadmap.md).

Fondasi ownership dan dua perbaikan migrasi terakhir telah lolos review; [verifikasi](../project/verification.md) membedakan tes otomatis dengan QA native yang masih pending.

