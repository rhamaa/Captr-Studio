# Hyperframe

Hyperframe adalah workflow motion graphic berbasis HTML/CSS/Canvas yang dapat hidup berdampingan dengan kartu Story pada whiteboard. Ia memiliki editor kode, preview, percakapan agent, serta snapshot versi draft.

## Dua hasil yang perlu dibedakan

| Bentuk | Pemakaian |
| --- | --- |
| Hyperframe composition/card | Motion graphic berbasis kode yang diedit dan dipreview dalam ruang kerja Hyperframe |
| B-roll media hasil render | File video yang didaftarkan sebagai media source lalu ditempatkan pada timeline Story |

Kartu Hyperframe di whiteboard tidak otomatis setara dengan inline Text/Shape Story. Source video hasil render tetap mengikuti aturan Assets/placement ketika digunakan di Story.

## Preview dan versi

Output agent dapat memperbarui code draft serta stage secara langsung. Snapshot versi memungkinkan beralih antara draft sebelum memilih hasil yang ingin disimpan. Versi lama mempunyai penanda agar pengguna mengetahui draft yang sedang dilihat.

Template runtime memakai seek berbasis waktu untuk mengendalikan animasi/media. Media lokal harus memakai pemetaan URL server aktif; port lama yang tersimpan pada HTML tidak boleh dianggap tetap valid. Companion microphone/system audio mengikuti binding media yang tersedia.

## Export MP4

Jalur export Hyperframe memakai offscreen Chromium untuk stepping frame dan FFmpeg untuk encoding/muxing. UI mempunyai pilihan resolusi, fps, kualitas, audio, tujuan file, progress, dan cancellation sesuai implementasi.

Pemilihan hardware encoder bergantung probe/runtime perangkat. Penyebutan NVENC/QSV/AMF/VideoToolbox pada implementasi bukan jaminan semua mesin dapat menjalankannya.

## Rujukan

- [Aturan template lengkap](../reference/hyperframe-rules.md)
- [Arsip implementasi MP4](../plans/2026-10-07-hyperframe-mp4-export-pipeline.md)
- [Export dan batas parity](export.md)

