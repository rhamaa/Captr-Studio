# Assets, Story Media, dan Templates

Library memisahkan source media reusable, source privat, dan preset desain. Placement di timeline adalah pemakaian source; ia bukan salinan file source.

| Jenis | Pemilik | Contoh |
| --- | --- | --- |
| Assets global | Project | Recording package, video/B-roll, gambar/logo, musik/SFX/audio impor |
| Story Media | Root/default Story atau satu Artboard | Voiceover yang direkam khusus dalam Story; private video/image/audio dari API scoped |
| Inline Text/Shape | Clip Story | Judul, callout, rectangle, ellipse, line, arrow |
| Templates | Library preset project | Preset Text/Shape yang membuat instance lokal |
| Efek/keyframe/transisi | Placement/sequence | Instruksi editing; bukan source library |

## Import dan placement

Import memeriksa source sebelum mendaftarkannya. Source yang baru diimpor tidak otomatis membuat clip. Place/drop memakai source yang dapat di-resolve di scope aktif; audio masuk track audio dan visual masuk track visual.

Recording tetap global. Voiceover dari Story aktif menjadi private media secara default. Kontrak media privat mendukung video/image/audio; ini bukan janji bahwa semua aksi import UI mempunyai selector privacy baru.

## Publish to Assets

Publikasi eksplisit memindahkan metadata source privat ke global sambil mempertahankan ID dan path. Aksi ini tidak mengekspor ulang media. Placement yang sudah ada tetap merujuk source yang sama; history dapat membatalkan publication dan pemakaian berikutnya sesuai urutan command.

## Hapus clip versus source

Delete clip menghapus placement, bukan source. Source global/private yang belum ditempatkan tetap ikut save/reopen. Menghapus source harus memeriksa pemakaian pada seluruh canonical Story; source yang masih direferensikan tidak boleh dihapus diam-diam.

## Template dan kompatibilitas

Penerapan Template menyalin konten secara mendalam agar dua judul tidak berbagi objek edit. Legacy global Text/Shape yang sudah ditempatkan berubah menjadi inline content per placement; desain tak terpakai dipertahankan sebagai Template. Load mengerjakan normalisasi pada clone dan tidak menulis ulang file asli.

Lihat [schema ownership](../architecture/ownership.md) dan [format project](../architecture/project-format.md).

