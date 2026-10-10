# Glosarium

| Istilah | Makna dalam Captr Studio |
| --- | --- |
| Project | Satu dokumen dan satu bundle `.captr` dengan identitas, Assets global, Artboard, komposisi, serta konfigurasi project. |
| Artboard | Pemilik output video dengan nama, ukuran, framing, sequence Story, dan media privatnya. |
| Story | Komposisi video final milik Artboard. Root/default sequence tetap tersedia sebagai scope canonical. |
| Record Editor | Sub-editor komposisi rekaman pada placement yang dibuka dari Story. |
| Recording package | Source rekaman bersama: screen, webcam, microphone, system audio, cursor/telemetry, dan metadata sesuai stream yang tersedia. |
| Record composition | Instruksi edit satu placement recording, terpisah dari package sumber. |
| Asset | Source media beridentitas; berbeda dari placement clip yang memakai source tersebut. |
| Assets global | Media reusable milik project yang dapat dipakai lintas Story. |
| Story Media | Media file privat milik root/default Story atau satu Artboard; tidak terlihat di library Story lain. |
| Inline content | Konten Text/Shape di clip tanpa backing Asset sintetis. |
| Template | Preset desain reusable. Penerapan menghasilkan elemen lokal yang dapat diedit independen. |
| Clip / placement | Pemakaian source atau konten inline pada track, dengan timing, transform, rate, gain, dan efek sendiri. |
| Track | Lane visual atau audio. Lock/mute/hidden dan urutannya memengaruhi editing/evaluasi. |
| Canonical | Representasi authoritative yang boleh menjadi pemilik state editing. |
| Projection | Representasi turunan untuk penyimpanan/pertukaran; tidak menjadi pemilik state kedua. |
| Sidecar | File pendamping source: audio, transkrip, telemetry, thumbnail, atau metadata lain yang terdaftar. |
| Source handle | Bagian source di luar visible in/out yang diperlukan untuk sampling transisi. |
| Time map | Pemetaan waktu antara Story, komposisi Record, dan source media. |
| Hyperframe | Komposisi motion graphic berbasis kode, bukan nama baru untuk Record composition. |
| Ghost preview | Draft perubahan agent yang tampil di timeline sebelum di-commit. |
| Revision | Nomor perubahan editing; membedakan proposal yang dibuat sebelum dan sesudah edit biasa. |
| Generation / import token | Penanda lifecycle context untuk menolak hasil asynchronous dari project/scope yang sudah tidak berlaku. |
| Unreleased | Perubahan checkout yang belum dinyatakan masuk rilis publik. |

Lihat [ownership](../architecture/ownership.md) untuk hubungan antaristilah dan [status fitur](status.md) untuk batas implementasi.

