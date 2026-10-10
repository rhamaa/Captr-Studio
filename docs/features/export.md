# Export

Captr Studio mempunyai jalur export berbeda untuk timeline project/Story dan komposisi Hyperframe. Pilih pipeline sesuai jenis output; kemampuan encoder pada satu jalur tidak otomatis berlaku untuk semua jalur.

## Story dan Record placement

TimelineProjectExporter memakai frame evaluation/rendering project dan audio plan. Inline content, media privat, transisi, dan Record compositions di-resolve dalam scope output. Record package tetap editable dan tidak perlu flatten sebelum transisi.

Preview dan export memakai evaluasi visual yang sama. Bukti otomatis ownership mencakup sampling inline styling, private media, transisi, dan nested Record clocks pada 0.5×/2×; ini bukan jaminan semua output hardware telah dilihat atau didengar.

## Multi-output

Artboard dan slice/batch workflow yang tercatat dapat menghasilkan output per kombinasi yang dipilih. Artboard dengan sequence sendiri menggunakan komposisi canonical-nya. Mengubah rasio tidak berarti memodifikasi source media global.

## Hyperframe

Hyperframe merender frame melalui offscreen Chromium dan encode/mux melalui FFmpeg. Lihat [Hyperframe](hyperframe.md) untuk hubungan animation seek, media lokal, dan companion audio.

## Hardware dan fallback

Repo memiliki jalur encoder native/hardware serta fallback, antara lain Windows/Media Foundation, NVIDIA, VideoToolbox, WebCodecs, dan FFmpeg sesuai subsystem. Kemampuan aktual ditentukan helper, codec, GPU, driver, dan hasil probe. Dokumentasi ini tidak menambahkan benchmark kecepatan atau janji kesetaraan antarplatform.

## Batas yang terlihat

- Subtitle preview Story belum dibakar ke frame export final.
- QA desktop untuk export nyata dan native encoder belum diperbarui pada perubahan ownership terbaru.
- Cancel/failure harus mempertahankan project aktif dan membersihkan output sementara sesuai pipeline.
- Animated GIF sebagai input Story bukan dukungan otomatis hanya karena exporter lain menawarkan GIF.

Lihat [status fitur](../product/status.md), [timing/rendering](../architecture/timing-rendering.md), dan [verifikasi](../project/verification.md).

