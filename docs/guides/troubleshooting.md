# Troubleshooting

Gunakan gejala berikut untuk membedakan aturan produk dengan bug. Catat versi, platform, langkah reproduksi, dan status source/placement ketika melapor.

| Gejala | Pemeriksaan |
| --- | --- |
| Rekaman/import ada di Assets tetapi timeline kosong | Capture/import adalah registration; place source secara eksplisit. |
| Text/Shape tidak muncul di Assets | Ini perilaku canonical; desain lokal berada pada clip Story. |
| Voiceover tidak terlihat di Story lain | Source privat milik owner asal. Gunakan Publish to Assets bila ingin berbagi. |
| Clip dihapus tetapi media masih ada | Delete clip tidak menghapus source; unused media tetap ikut save. |
| Proposal AI ditolak setelah pindah Story/edit | Context lama tidak cocok scope/revision; generate context/proposal baru. |
| Subtitle terlihat di preview tetapi tidak di output Story | Burn-in caption final masih backlog; lihat status caption. |
| Waveform tidak sesuai audio nyata | Waveform Story saat ini sintetis, bukan hasil ekstraksi peak. |
| Legacy project tidak terbuka | Video/Motion legacy ditolak; Record V1/V2 memakai konversi eksplisit ke copy. |
| Save setelah Record meminta target baru | Untuk capture dari project aktif, periksa regresi path/projectId dan laporkan alur lengkap; source aktif kosong tidak boleh menentukan project baru. |
| Audio recording tidak terdengar | Periksa stream mic/system dan companion sidecar, source path, gain/mute, serta time map; jangan menganggap screen MP4 selalu menyertakan microphone. |
| Hyperframe media hitam atau connection refused | Periksa pemetaan URL media ke server/port aktif dan binding companion audio. |
| Whisper tidak dapat dipakai | Periksa runtime/model dan hasil ekstraksi audio; download model dan inferensi adalah tahap berbeda. |
| Export hardware tidak tersedia | Periksa hasil probe, helper, codec, driver, serta jalur fallback pada mesin tersebut. |

## Saat membuat laporan

Sertakan output yang diharapkan versus aktual, project baru atau existing, source global/private, owner Story, dan langkah Save/Open bila relevan. Berikan pesan error/log yang sudah dibersihkan dari data pribadi. Jangan menyertakan media sensitif untuk mereproduksi bug jika contoh sederhana cukup.

Gunakan [panduan kontribusi](../development/contributing.md) dan [issue register](../project/issues/README.md). Status sembilan kegagalan tes lama serta QA native ada pada [verifikasi](../project/verification.md).

