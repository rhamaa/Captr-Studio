# Status fitur dan batas dukungan

Halaman ini mencatat kondisi checkout pada **10 Oktober 2026**, dengan package `1.4.0-beta.1`. Status implementasi, status tes, dan status rilis adalah hal berbeda.

| Label | Arti |
| --- | --- |
| Tersedia | Jalur implementasi ada dan memiliki bukti di kode atau catatan verifikasi. Dukungan perangkat tetap mengikuti backend/platform. |
| Parsial | Sebagian alur ada, tetapi bagian hasil akhir atau workflow belum lengkap. |
| Backlog | Arah produk; belum dinyatakan sebagai implementasi selesai. |
| QA native pending | Interaksi desktop/perangkat belum dijalankan ulang pada perubahan ownership terakhir. |
| Historis | Catatan pada tanggal tertentu; bukan hasil pengujian baru atau kontrak current. |

## Katalog kemampuan

| Fitur | Status | Batas atau bukti utama |
| --- | --- | --- |
| Screen/window recording dan package multi-stream | Tersedia; QA native pending | Capture dan sidecar dipertahankan; backend berbeda menurut platform. |
| Zoom, cursor, webcam, framing pada Record Editor | Tersedia; QA native pending | Edit dimiliki komposisi placement; package sumber bersama. |
| Artboard dengan sequence independen | Tersedia | Normalisasi, duplikasi, isolasi, dan bundle diuji otomatis. |
| Whiteboard tldraw dan kartu Story/Hyperframe | Tersedia | Snapshot project, sinkronisasi kartu, dan asset UI offline memiliki catatan tes 7 Oktober. |
| Timeline visual/audio, split, trim, move, duplicate, ripple delete | Tersedia | Commands/history dan UI timeline sudah terpasang. |
| Playback rate konstan per clip | Tersedia | Clock/rate diuji; ini tidak berarti speed curve sudah tersedia. |
| Text dan Shape inline lokal Story | Tersedia, unreleased | Ownership selesai dan final review disetujui 10 Oktober. |
| Assets global dan Story Media privat | Tersedia, unreleased | Resolusi scope, publikasi, penghapusan, dan persistence diuji. |
| Templates Text/Shape independen | Tersedia, unreleased | Preset menghasilkan salinan konten; bukan source media sintetis. |
| Transisi visual dan animasi enter/exit | Tersedia | Handle source terbatas; evaluasi preview/export bersama. |
| Keyframe position/scale/rotation/opacity | Tersedia | Inspector dan evaluator ada; editing graph lanjutan tetap backlog. |
| Canvas gizmo, zoom/pan, frame stepping, loop | Tersedia | Kontrol Story Editor terpasang; shortcut terpisah dari mode mengetik. |
| Voiceover privat dengan playhead anchor | Tersedia, unreleased; QA native pending | Registrasi source dan placement dipisahkan; stale completion ditolak. |
| Import video/gambar/audio | Tersedia; QA native pending | Source masuk library; tidak berarti otomatis ditempatkan di timeline. |
| Whisper lokal dan metadata transkrip | Tersedia | Memerlukan runtime/model yang tersedia di mesin pengguna. |
| Subtitle preview dan metadata milik Story | Parsial | Metadata round-trip tersedia; preview overlay belum menjadi caption final yang dibakar ke frame ekspor Story. |
| Editor caption final dan burn-in Story | Backlog | Jangan mengiklankan subtitle preview sebagai dukungan ekspor final lengkap. |
| Waveform Story | Parsial | Tampilan masih sintetis; ekstraksi peak audio nyata belum selesai. |
| Filmstrip thumbnail video di timeline | Backlog | Belum dicatat sebagai finishing selesai. |
| Copilot, MCP, ghost preview, rencana edit | Tersedia | Context membawa scope/projectId/generation/revision; draft stale ditolak. |
| Terminal project dan konfigurasi tersimpan | Tersedia | Konfigurasi tingkat project; bukan setting lokal satu Story. |
| Hyperframe HTML, versi draft, MP4 offscreen | Tersedia | Catatan implementasi 6–7 Oktober; QA encoder/perangkat tidak diperbarui oleh tes ownership. |
| `.captr` V3, library tanpa placement, source/sidecar | Tersedia | Real bundle tests dan atomic rejection tersedia. |
| Rename, Save As, Home/New/Open guards | Tersedia; QA native pending | Rename mempertahankan ID; Save As menghasilkan identitas salinan. |
| Konversi Record V1/V2 | Terbatas | Eksplisit ke salinan baru; metadata yang tidak didukung ditolak utuh. Video/Motion legacy tetap ditolak. |
| Full compatibility seluruh project legacy | Tidak didukung | Klaim lama di arsip tidak menggantikan batas konversi current. |
| Copy/paste clip/attributes, group, link/unlink | Backlog | Duplikasi clip/Artboard tidak berarti workflow clipboard/group sudah selesai. |
| Insert/overwrite, ripple trim, audio automation/crossfade | Backlog Story | Jangan menyamakan helper audio/Record lama dengan workflow finishing Story lengkap. |
| Mask/feather/blend dan color/LUT per placement Story | Backlog | Fitur historis Record tidak membuktikan fitur finishing Story ini. |
| Speed curve, reverse, freeze frame, tracking, proxies | Backlog | Scope/spec lanjutan diperlukan. |
| Engine TTS baru untuk Story | Backlog | Kontrak media privat mendukung arah ini; tidak ada engine baru dalam ownership foundation. |

## Platform dan media

Windows memiliki jalur Windows Graphics Capture/WASAPI; macOS memiliki jalur ScreenCaptureKit; jalur browser/fallback berbeda. Native recording Linux masih disebut area kontribusi di dokumentasi repo. Daftar platform pada installer tidak menjamin kesetaraan semua backend capture dan encoder.

Jenis media canonical adalah video, image, audio, dan recording; Text/Shape merupakan konten inline. GIF tidak memiliki jenis Asset domain tersendiri. Dukungan GIF di pipeline lain tidak boleh diterjemahkan menjadi klaim decoder/export GIF animasi di seluruh Story Editor tanpa verifikasi.

## Bukti terbaru

Perbaikan final ownership di `8c2fe68` lulus **224 tes pada 15 suite**, TypeScript, dan review independen. Run seluruh suite sebelumnya memiliki **1.491 lulus / 9 gagal / 1.500 tes**; sembilan kegagalan merupakan baseline lama. Suite penuh tidak diulang sesudah perbaikan terarah. QA native tetap pending. Rincian ada di [verifikasi project](../project/verification.md).

