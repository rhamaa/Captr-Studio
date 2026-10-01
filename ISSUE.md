# Issue Log & Regression Checklist


1. Issue pada keyframing enggine (Video editor) "Slide Record", jadi dia itu melakukan keyframing pada timeline clip video record, bukan pada komponen overlay text, atau gambar yg di upload.

2. Audio record pada "Video Record" masih sering hilang dan tidak ter record, nah saya ingin agar

## 3. Menambahkan Record slide meminta project baru

**Status:** perbaikan kode diterapkan pada 27 September 2026; verifikasi alur penuh masih pending.

**Gejala:** menambahkan rekaman kedua ke project yang sudah ada dapat membuat aplikasi meminta menyimpan project baru. Deck juga berisiko terganti ketika referensi video aktif kosong meskipun slide lain sudah ada.

**Akar masalah yang sudah ditemukan:**

- Finalisasi Recorder HUD/native dapat menghapus `currentProjectPath`, sehingga penyimpanan berikutnya kehilangan target `.captr` aktif.
- Jalur capture Windows berjalan melalui `stop-native-screen-recording` dan `mux-native-windows-recording`; jalur ini tidak melewati finalizer macOS yang sebelumnya mengonsumsi flag `preserveProjectPath`. Handler sesi harus mengonsumsi flag tertunda sendiri sebelum memutuskan untuk menghapus path project.
- Kondisi pembuatan Record slide menganggap `videoSourcePath` kosong berarti deck kosong, meskipun daftar slide sudah berisi slide.
- Aset sudah dipisah ke folder slide, tetapi metadata per slide belum memiliki manifest di folder tersebut.

**Kontrak project dan checklist regresi:**

- [x] Rekaman baru ditambahkan selama deck sudah memiliki slide; referensi video aktif bukan penentu apakah deck kosong.
- [x] Konteks `preserveProjectPath` dari Recorder HUD dikonsumsi oleh handler sesi di semua platform; jalur macOS menunda reset path sampai handler sesi. Rekaman project baru tetap tidak memakai path lama.
- [x] Ctrl+S menyimpan kembali ke bundle aktif saat path Electron sempat ter-reset, dengan memverifikasi `projectId` dari `.captr` yang dikirim UI sebelum mengizinkan overwrite.
- [x] Satu project disimpan dalam satu file `.captr`. Setiap slide memiliki folder `slides/<slideId>/` berisi `slide.json` dengan metadata slide dan referensi path bundle-relative, serta aset slide tersebut.
- [ ] Verifikasi alur: buka project `.captr`, tambahkan setidaknya dua Record slide, simpan tanpa dialog Save As, tutup lalu buka kembali file yang sama, dan pastikan semua slide serta asetnya utuh.
- [ ] Verifikasi khusus Windows: simpan project sebagai `Test 2.captr`, tambahkan Record slide baru, tekan Ctrl+S, pastikan tidak muncul Save As dan file yang sama diperbarui.
- [x] Video/Motion slide dipensiunkan pada 1 Oktober 2026. Bundle lama dengan salah satu jenis tersebut ditolak sebelum state/path/aset aktif berubah; tes bundle nyata memverifikasi file asli tidak berubah.
- [ ] Verifikasi UI: membuka bundle lama Video/Motion menampilkan pesan untuk memakai versi Captr sebelumnya, lalu Ctrl+S tetap menyimpan project Record aktif.
- [ ] Pastikan Save As eksplisit dan pembuatan project baru tetap membuat file baru.

**Kontrak V3 — Project Assets tanpa Slides (1 Oktober 2026):** kontrak deck/`slides/` di atas adalah histori V1/V2. Project baru memiliki Assets dan timeline independen; finalisasi Record hanya mendaftarkan satu paket source/sidecar/settings ke library.

- [x] Domain V3 mendeduplikasi capture ID; registration menghasilkan nol placement, dan dua placement mempunyai komposisi independen.
- [x] Bundle V3 menyimpan seluruh library di `assets/<assetId>/`, termasuk Record yang belum masuk timeline; `project.json` authoritative, komposisi terpisah, tanpa tulisan `slides/`/`slide.json` baru pada jalur V3.
- [x] Load memvalidasi semua media sebelum memasang workspace; sumber hilang tidak mengganti project aktif. Save gagal mempertahankan bytes bundle dan path aktif.
- [x] Pemulihan target Ctrl+S memverifikasi identitas, termasuk path yang sudah trusted.
- [x] Konverter Record V1/V2 mengutamakan slides canonical, membuat identitas baru, menjaga trim/settings/audio; transitions/extensions dan audio loop/fades yang belum didukung ditolak utuh, tanpa mutasi input.
- [x] Finalisasi Record hanya masuk Assets; stale completion/import tidak masuk project baru. Tes juga memastikan event duplikat tidak mengembalikan aset yang sudah dihapus.
- [ ] Native QA: Record dua kali pada `.captr` aktif, Ctrl+S tanpa Save As, buka ulang Assets tanpa timeline dan semua sidecar utuh.
- [ ] Native QA: tempatkan Record dua kali, split/trim/rate/edit independen; import video/gambar/audio, preview/export parity, Ctrl+S/reopen.
- [ ] Native QA: Save As dan New Project mempertahankan perbedaan path/identitas; konversi eksplisit memakai file baru dan bundle asli tidak berubah.

**Instruksi berikutnya:** pertahankan preservasi path native/browser/Windows dan pemeriksaan identitas. Jangan menentukan project kosong dari source aktif. Aset milik library, penghapusan clip tidak menghapus source; seluruh library harus ikut save meskipun timeline kosong. Perbarui checklist ini dan `AGENTS.md` saat kontrak berubah.

**Verifikasi engine V3 (1 Oktober 2026):** bundle nyata menguji seluruh library dan sidecar, atomic save/load serta konversi sebagai copy. Uji browser memakai screen/webcam MP4 dan mic/system WAV nyata: completion duplikat menghasilkan satu Asset tanpa clip, seek acak dan rate 0.5×/2× mempertahankan frame efek pada source time yang sama, offset mic 500 ms terukur tepat. MP4 dari frame hasil edit dan mixer yang sama memiliki selisih rata-rata preview/export 1.51 dari 255 per channel, sesuai kompresi H.264. Tidak ada error console.

**Batas verifikasi:** bridge encoder fixture memakai FFmpeg yang sudah tersedia; belum menjalankan capture native Windows/macOS atau IPC encoder di aplikasi desktop. Checklist native di atas tetap pending, termasuk Ctrl+S setelah dua capture pada `.captr` aktif, reopen dari aplikasi, serta Save As/New Project selama capture berlangsung. Sembilan kegagalan test decoder/effect/audio/media-layer dan 248 diagnostik locale merupakan baseline yang sudah direproduksi sebelum perubahan ini.
