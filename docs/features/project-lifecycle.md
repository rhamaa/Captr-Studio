# Home, save, rename, dan project lifecycle

Home tidak mempunyai projectId aktif atau target save tersembunyi. Startup normal membuka Home; intent Open/capture yang terverifikasi dapat menentukan tujuan awal lain.

## Operasi file

| Operasi | Identitas dan file |
| --- | --- |
| Save / Ctrl+S | Menyimpan project aktif ke target yang sah; target yang dipulihkan harus cocok projectId |
| Rename | Mempertahankan identitas dan folder project; nama file baru menjadi nama terlihat |
| Save As | Membuat salinan dengan projectId baru dan mempertahankan file asli |
| New | Membuat project baru dengan identitas/target save baru |
| Open | Memvalidasi input/media sebelum memasang state dan path baru |
| Back to Home | Menyelesaikan Save/Discard/Cancel dan guard operasi sebelum deactivation |

Nama terlihat mengikuti filename `.captr`; title internal tidak menyimpan ekstensi. Undo/redo tidak membatalkan nama/identitas file yang sudah committed.

## Guard asynchronous

Capture, finalisasi, export, import/probe, dan transaksi file mempunyai batas lifecycle. Edit dibekukan selama navigasi asynchronous. Rename/Save As menunggu media yang sedang diproses. Listing/recovery memakai antrean bersama file transaction sehingga recovery tidak menimpa Rename aktif.

Rename yang sudah commit terverifikasi dapat mengembalikan sukses dengan warning jika hanya cleanup gagal. Jangan menyamakan warning cleanup dengan kegagalan publikasi file yang sudah sah.

## Kompatibilitas

V3 lama dinormalisasi pada clone sebelum dipasang. Konversi Record V1/V2 adalah aksi eksplisit ke salinan baru; metadata yang tidak didukung menolak seluruh konversi tanpa mengubah input. Bundle Video/Motion legacy tetap ditolak.

Ekstensi file lama dan fitur sejarah tidak berarti semua project lama dapat di-upgrade otomatis. Lihat [format V3](../architecture/project-format.md).

## QA

Real bundle/transaction tests melindungi bytes/path dan source yang belum ditempatkan. Explorer open, file locks, Rename case-only/Unicode, relaunch recovery, HUD/native capture, dan guard microphone membutuhkan QA desktop sesuai [checklist](../project/verification.md).

