# Voiceover dan audio

Audio Recorder merekam microphone secara mandiri dari Screen Record. Take untuk Story didaftarkan sebagai private audio source milik Story asal, kemudian ditempatkan pada timeline.

## Context take

Saat rekaman dimulai, editor menangkap owner, project/import token, posisi playhead, serta ID source/clip yang stabil. Memindahkan playhead atau melakukan edit biasa saat take berjalan tidak memindahkan asal take.

Registrasi source dan placement adalah dua operasi terpisah. Undo placement menghilangkan clip tetapi mempertahankan source. Jika placement gagal sesudah source berhasil disimpan, take tetap tersedia di Story Media.

## Navigasi saat merekam

| Pilihan | Hasil yang diharapkan |
| --- | --- |
| Finish and keep | Selesaikan/finalisasi take dahulu, lalu lanjutkan navigasi setelah guard berhasil |
| Discard and continue | Batalkan take dan lakukan cleanup sementara yang terbatas, lalu lanjutkan |
| Stay | Tetap di project tanpa menjalankan perpindahan yang diminta |

Take yang selesai setelah owner dihapus, project berganti, atau session dibatalkan/dispose tidak boleh masuk project baru. Cleanup hanya memakai jalur file sementara yang diizinkan.

## Audio timeline

Audio source global/private dapat ditempatkan pada track audio. Timing, gain, enable/mute, dan playback rate dimiliki placement. Recording dapat mempunyai companion mic/system audio yang mengikuti time map Record.

Preview/export memakai audio plan scoped dan source clocks yang sama dengan evaluasi project. Fade/crossfade dan volume automation sebagai workflow finishing Story lengkap masih backlog; kemampuan audio lama pada Record Editor tidak menyelesaikan backlog tersebut.

## Batas verifikasi

Held save/probe, stale completion, source retention, undo/redo, dan rejection diuji otomatis. Mendengar hasil nyata, microphone capture, serta Finish/Discard/Stay melalui Home/Open/New/window close masih [QA native pending](../project/verification.md). Waveform Story masih sintetis.

