# Recording

Screen Record menghasilkan recording package yang tetap dapat diedit. Package menyimpan screen dan stream pendamping yang tersedia, misalnya webcam, microphone, system audio, serta cursor telemetry.

## Perilaku hasil rekaman

1. Mulai Record dari project aktif atau intent capture yang valid.
2. Selesaikan capture melalui Recorder HUD/backend yang digunakan.
3. Finalisasi mendaftarkan source package ke **Assets global project asal**.
4. Pilih placement secara eksplisit ketika ingin memakai hasilnya di Story.

Capture completion tidak otomatis menambah clip timeline. Project dengan library terisi dan timeline kosong tetap project valid.

## Jalur capture

| Jalur | Peran |
| --- | --- |
| Windows native | Windows Graphics Capture dan jalur audio WASAPI sesuai konfigurasi/helper |
| macOS native | ScreenCaptureKit dan stream audio yang disediakan backend |
| Browser/fallback | Jalur capture melalui renderer/browser ketika digunakan |
| Webcam/microphone | Stream pendamping yang harus tetap mengikuti metadata sinkronisasi package |

Keberadaan backend di source bukan hasil benchmark perangkat. Native Linux dan kondisi hardware tertentu tidak dinyatakan setara dengan Windows/macOS oleh dokumentasi ini.

## Identitas dan finalisasi

Capture dari project aktif mempertahankan target `.captr`. `videoSourcePath` kosong bukan alasan membuat project baru. Completion duplikat memakai capture ID untuk mencegah source terdaftar dua kali. Completion dari project yang sudah ditinggalkan harus ditolak.

Proses capture/preparation/finalization memiliki guard lifecycle; navigasi dan transaksi file tidak boleh mengganti pemilik hasil rekaman secara diam-diam.

## Verifikasi dan batas

Registrasi Assets-only, paket/sidecar, deduplikasi, dan source bersama diuji pada domain serta real bundle. Pengulangan Record → Ctrl+S melalui HUD/native belum dijalankan ulang setelah ownership Story berubah. Lihat [QA pending](../project/verification.md) dan [issue Record/project](../project/issues/README.md).

