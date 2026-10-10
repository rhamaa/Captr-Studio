# Dari Record ke video final Story

Contoh ini memakai satu recording untuk tutorial landscape dan cuplikan portrait.

1. Mulai atau buka project `.captr`.
2. Jalankan Screen Record dengan stream yang dibutuhkan.
3. Selesaikan capture. Pastikan hasil terlihat pada Assets; tidak ada placement otomatis.
4. Buat/buka Artboard landscape dan place recording ke Story.
5. Buka Record Editor dari placement: sesuaikan zoom, cursor, webcam, framing, dan cut.
6. Kembali ke Story untuk mengatur urutan, Text/Shape, B-roll, musik, serta voiceover.
7. Buat atau duplikasi Artboard portrait. Atur komposisi placement portrait secara independen.
8. Save, buka ulang bila diperlukan, dan periksa kedua output sebelum export.

## Yang dibagi dan yang independen

Recording package tetap satu source bersama. Trim/rate/transform Story serta komposisi Record dimiliki placement. Text/Shape adalah konten inline. Voiceover privat hanya tersedia pada owner-nya sampai dipublikasikan eksplisit.

Menghapus clip tidak menghapus source. Tidak perlu mengekspor hasil Record Editor menjadi file perantara untuk mempertahankan editability.

## Pemeriksaan praktis

- Perubahan komposisi portrait tidak mengubah landscape.
- Ctrl+S kembali ke bundle project aktif setelah tambahan recording.
- Source/sidecar masih ada meskipun salah satu Story kosong.
- Subtitle preview tidak diasumsikan ikut MP4 sebelum finishing caption tersedia.

Checklist desktop lengkap tetap [pending verifikasi native](../project/verification.md); panduan ini menjelaskan workflow yang diimplementasikan, bukan laporan bahwa langkah desktop telah dieksekusi ulang.

