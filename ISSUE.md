# Issue Log & Regression Checklist


1. Issue pada keyframing enggine (Video editor) "Slide Record", jadi dia itu melakukan keyframing pada timeline clip video record, bukan pada komponen overlay text, atau gambar yg di upload.

2. Audio record pada "Video Record" masih sering hilang dan tidak ter record, nah saya ingin agar

## 3. Menambahkan Record slide meminta project baru

**Status:** perbaikan kode diterapkan pada 27 September 2026; verifikasi alur penuh masih pending.

**Gejala:** menambahkan rekaman kedua ke project yang sudah ada dapat membuat aplikasi meminta menyimpan project baru. Deck juga berisiko terganti ketika referensi video aktif kosong meskipun slide lain sudah ada.

**Akar masalah yang sudah ditemukan:**

- Finalisasi Recorder HUD/native dapat menghapus `currentProjectPath`, sehingga penyimpanan berikutnya kehilangan target `.captr` aktif.
- Kondisi pembuatan Record slide menganggap `videoSourcePath` kosong berarti deck kosong, meskipun daftar slide sudah berisi slide.
- Aset sudah dipisah ke folder slide, tetapi metadata per slide belum memiliki manifest di folder tersebut.

**Kontrak project dan checklist regresi:**

- [x] Rekaman baru ditambahkan selama deck sudah memiliki slide; referensi video aktif bukan penentu apakah deck kosong.
- [x] Konteks `preserveProjectPath` diteruskan melalui Recorder HUD dan finalisasi native/browser. Project aktif tetap menjadi target save; recording baru dari alur project baru tetap tidak memakai path lama.
- [x] Satu project disimpan dalam satu file `.captr`. Setiap slide memiliki folder `slides/<slideId>/` berisi `slide.json` dengan metadata slide dan referensi path bundle-relative, serta aset slide tersebut.
- [ ] Verifikasi alur: buka project `.captr`, tambahkan setidaknya dua Record slide, simpan tanpa dialog Save As, tutup lalu buka kembali file yang sama, dan pastikan semua slide serta asetnya utuh.
- [ ] Pastikan Save As eksplisit dan pembuatan project baru tetap membuat file baru.

**Instruksi untuk perubahan berikutnya:** jangan menghapus preservasi path di jalur sesi/finalisasi, jangan mengembalikan kondisi append yang bergantung pada `videoSourcePath`, dan jangan memindahkan semua aset slide ke folder global. Jika kontrak ini berubah, perbarui checklist ini dan instruksi agen di `AGENTS.md`.
