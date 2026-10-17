# Captr Studio

Captr Studio adalah aplikasi desktop untuk merekam layar, mengolah hasil rekaman, dan menyusun video final dari beberapa sumber media. Workflow utama menghubungkan Record Editor, Story Editor, dan Artboard di dalam satu project `.captr`.

Tutorial produk dapat memakai rekaman layar dengan cursor dan webcam. Video promosi dapat menggabungkan rekaman, B-roll, teks, musik, dan motion graphic. Beberapa Artboard memungkinkan satu library media digunakan untuk output dengan ukuran berbeda.

## Tiga tingkat pekerjaan

| Tingkat | Tujuan | Contoh |
| --- | --- | --- |
| Project dan Artboard | Mengelola sumber bersama dan beberapa output | Tutorial landscape dan cuplikan portrait dari rekaman yang sama |
| Story Editor | Menyusun urutan dan tampilan video final | Memotong klip, menambahkan teks, transisi, musik, dan voiceover |
| Record Editor | Mengolah satu placement rekaman | Mengubah zoom, cursor, webcam, framing, dan cut rekaman |

Hasil Record Editor tetap berupa komposisi yang dapat diedit ketika dipakai oleh Story. Source rekaman tidak perlu diratakan menjadi video baru sebelum penyusunan final.

## Ruang kerja tambahan

- Whiteboard menempatkan kartu Story/Artboard dan Hyperframe bersama catatan visual di infinite canvas.
- Hyperframe menyediakan motion graphic berbasis HTML/CSS/Canvas dengan preview, versi draft, dan ekspor MP4.
- Copilot dan terminal project menghubungkan editor dengan agent CLI serta tool MCP untuk editing terstruktur.
- Whisper menyediakan transkripsi lokal dan metadata subtitle dari audio sumber.

## Kondisi pengembangan

Versi package saat dokumentasi ini disusun adalah `1.4.0-beta.2`. Fondasi ownership Story, finishing Story Editor, engine keyframing visual, shape library baru, dan custom dark scrollbars telah diimplementasikan pada 17 Oktober 2026.

Story Editor sedang dikembangkan menuju workflow editor video modern dengan CapCut Desktop sebagai referensi perilaku. Caption final/burn-in, waveform nyata, filmstrip, dan sejumlah tool finishing masih backlog. Lihat [status fitur](status.md), [roadmap](../project/roadmap.md), dan [verifikasi](../project/verification.md) sebelum menulis klaim publikasi.

## Mulai membaca

- [Panduan mulai](../guides/getting-started.md)
- [Workflow rekaman hingga Story](../guides/record-to-story.md)
- [Katalog fitur](../features/README.md)
- [Hierarki dan ownership](../architecture/ownership.md)
- [Daftar issue](../project/issues/README.md)

