# Artboard dan Whiteboard

Artboard mengelola output video dalam satu project. Satu library reusable dapat digunakan oleh beberapa Artboard dengan ukuran, judul, framing, dan Story sequence yang independen.

## Workflow Artboard

- Buat Artboard dari preset rasio yang tersedia atau pengaturan output yang didukung editor.
- Buka kartu Story untuk mengedit timeline output tersebut.
- Gunakan source global yang sama pada beberapa Story.
- Duplikasi Artboard bila ingin membuat versi baru; edit placement, desain inline, private media, dan Record composition pada salinan tetap independen.
- Gunakan preview per kartu dan workflow export sesuai kebutuhan output.

Preset yang tercatat antara lain 9:16, 1:1, 16:9, dan 4:5. Story Editor juga menyediakan pengaturan canvas lain; preset yang ada pada satu permukaan UI tidak otomatis identik pada semua dialog.

## Infinite canvas

Whiteboard memakai tldraw untuk pan/zoom, catatan, connector, shape, dan sketch. Story/Artboard serta Hyperframe ditampilkan sebagai custom cards. Kontrol kartu dipisahkan dari gesture whiteboard agar scrub/playback tidak berubah menjadi drag canvas.

Hanya satu kartu video aktif diputar dalam satu waktu pada guard playback yang tercatat. Snapshot whiteboard tersimpan sebagai field opsional project V3. Project tanpa snapshot masih dapat dibuka; layout awal kartu dibentuk ketika diperlukan.

Asset UI tldraw menggunakan bundel lokal. Catatan whiteboard tidak otomatis menjadi overlay timeline/export Story; gunakan alat Text/Shapes Story untuk elemen video final.

## Canonical owner

Artboard baru memiliki sequence sendiri. Legacy Artboard yang belum menyimpan tracks dimaterialisasi sebagai snapshot root independen ketika dinormalisasi. Nilai eksplisit, termasuk tracks/transitions kosong, mengalahkan fallback. Referensi clip/track/transition di-remap; referensi tidak valid ditolak.

Lihat [ownership](../architecture/ownership.md), [panduan repurpose](../guides/repurpose.md), dan [arsip rencana whiteboard](../plans/2026-10-07-tldraw-infinite-canvas-integration.md).

