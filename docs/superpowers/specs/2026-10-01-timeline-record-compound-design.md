# Timeline umum dengan Record compound clip

Tanggal: 1 Oktober 2026
Status: flow compound clip disetujui; revisi scope menghapus Video/Motion slide dan mengikuti UX OpenCut. Implementasi belum dimulai.

## 1. Tujuan dan keputusan

Captr beralih dari penyusunan deck ala Tella ke editing timeline umum. Hasil screen recording menjadi satu paket clip yang berisi media dan metadata, tetap memiliki kontrol cursor, auto-zoom, webcam, background, serta audio dari recorder saat ini.

Flow yang disetujui: Record/import → Media Library → drag ke timeline → trim/split/susun → edit efek → simpan/buka ulang → ekspor. Record tampil sebagai satu compound clip; membuka clip menampilkan editor internal. Screen, webcam, mikrofon, dan system audio tidak langsung menjadi track terpisah pada timeline utama.

Pendekatan: evolusi Captr bertahap. Pengguna meminta penghapusan seluruh kode src/slides/video dan src/slides/motion, termasuk wiring runtime di luar folder tersebut. Recorder native/browser dan logika efek Record dipertahankan melalui adapter. UX mengikuti OpenCut yang berjalan di https://opencut.app; repository OpenCut utama sedang rewrite, sehingga bukan baseline UX eksperimen ini. Ini keputusan UX, bukan keputusan menyalin seluruh engine atau fork.

Baseline yang diamati pada 1 Oktober 2026: project library → New project → workspace dengan assets di kiri, preview di tengah, inspector selection di kanan, timeline bawah, dan Export di header. Sidebar menyediakan Media, Text, Stickers, Effects, Transitions, Captions, Adjustment, Settings. Implementasi flow inti mengikuti baseline tersebut; kemampuan sidebar yang belum tersedia tidak boleh menjadi tombol palsu. Record ditambahkan sebagai aksi capture di Media; hasilnya masuk assets lalu didrag ke timeline. Editor internal Record merupakan ekstensi khusus Captr.

Kesuksesan: recording 60 detik dipakai sebagai dua potongan, diselingi video biasa, diberi text dan musik, auto-zoom diubah, disimpan lalu dibuka ulang dan diekspor dengan seluruh stream tetap sinkron.

## 2. Bukti dari repo

Span berikut diperiksa melalui Graft dan pembacaan sumber terarah:

- `src/slides/record/schema.ts:52-84`: RecordSlideMeta sudah memuat video/webcam, audio mikrofon/system, cursor telemetry, zoom, trim, speed, layout, annotation, dan pengaturan visual.
- `src/components/video-editor/types.ts:312-356`: LegacyClipEntry/ClipEntry mencampur sumber media, penempatan, serta pengaturan slide. Model baru memisahkan tanggung jawab tersebut.
- `src/components/video-editor/types.ts:410-447`: helper pemetaan waktu lama menggunakan ClipRegion. Adapter perlu kontrak baru yang membedakan waktu sumber dan waktu project; helper lama tidak diganti sebelum caller dan regresinya dipetakan.
- `src/slides/video/schema.ts:9-64`: Video slide sudah memiliki model video track, audio, text overlay, dan media pool, tetapi masih berscope satu slide.
- `src/core/slides/types.ts:73-83`: ProjectV2Data berisi slides, transitions, globalAudioTracks, dan canvas; belum menjadi model timeline project umum.
- `src/core/export/multiSlideExporter.ts:29-197`: ekspor deck merender chunk per slide kemudian melakukan stitching. Timeline bertumpuk membutuhkan evaluator dan komposisi project.
- `electron/ipc/register/project/save.ts:29-634`: media recording dan sidecar disalin ke workspace slide, manifest slide.json ditulis, lalu project dibundle.
- `ISSUE.md`, bagian 3: preservasi path, projectId, satu bundle per project, folder aset per slide, dan regresi Ctrl+S wajib dipertahankan. Verifikasi manual yang pending bukan bukti bahwa alur sudah lulus.

Ini peta integrasi awal, bukan audit lengkap seluruh recorder/exporter. Implementation plan wajib menelusuri caller simbol yang benar-benar diubah.

## 3. Scope eksperimen pertama

Termasuk:

- Media Library: Record package, video, image, audio; text dibuat dari editor.
- Timeline: visual track berurutan dan audio track; move, trim, split, delete, snapping, mute, lock, undo/redo.
- Posisi/scale/opacity statis untuk visual clip; text/image dapat berada di atas Record/video.
- Record compound dengan cursor, zoom, webcam, background, mikrofon/system audio dan pengaturan lama yang didukung adapter.
- Preview, seek, playback, save/load .captr, dan ekspor project timeline.
- Kecepatan konstan positif pada clip, termasuk uji 0.5x dan 2x. Reverse dan speed ramp baru ditunda; speed regions lama tetap dibaca oleh adapter composition.

Ditunda: membuka komponen menjadi track bebas, nested compound rekursif, transition baru, katalog efek, AI editing, collaboration, interchange package lintas aplikasi, dan rewrite recorder. Modul Video/Motion slide dihapus; kemampuan video biasa dibangun sebagai timeline clip umum. Tidak ada editor Motion lama yang tetap aktif dalam hasil migrasi ini.

## 4. Model data yang diusulkan

Project timeline memakai format version 3, berbeda dari ProjectV2Data. Ini kontrak usulan, bukan perubahan schema yang sudah diterapkan.

| Entitas | Data dan tanggung jawab |
| --- | --- |
| MediaAsset | ID, kind, path bundle-relative, metadata hasil probe, durasi dan dimensi. Media sumber immutable. |
| RecordingPackage | ID stabil, schemaVersion, waktu sumber recording, referensi screen/webcam/mic/system/cursor, stream offsets, capture dimensions, diagnostics dan provenance. |
| RecordComposition | ID, packageId, revision, durasi output internal, source time map, pengaturan visual/audio, zoom/layout/annotation. |
| TimelineTrack | ID, visual/audio kind, nama, urutan stacking, mute/hidden/lock, daftar clip. |
| TimelineClip | ID, trackId, kind, assetId atau compositionId, timelineStartUs, sourceInUs/sourceOutUs, playbackRate, transform, gain, enabled. |
| TimelineProject | version: 3, projectId, title, canvas, library, recordingPackages, compositions, tracks, timestamps. |

Semua interval half-open [start, end). Waktu persisted baru berupa integer microseconds yang aman dalam Number; rate merupakan finite number positif. Data lama bermilidetik dikonversi sekali di adapter. Frame/sample index dihitung dari waktu dan FPS/sample rate; pembulatan hanya saat sampling, tidak setelah setiap operasi edit.

Media asli satu paket dipakai bersama. Saat Record dimasukkan lagi dari library atau diduplikasi, composition disalin secara logis ke ID baru, aset tetap direferensikan. Saat split, dua clip menerima salinan composition yang sama pada saat split dan rentang sumber berbeda. Edit internal berikutnya hanya memengaruhi clip terpilih. Tidak ada edit bersama tersembunyi.

Schema validation menolak ID duplikat, referensi hilang, rate tidak valid, waktu negatif, rentang di luar sumber, nilai non-finite, dan path yang keluar dari workspace. Export wajib gagal jelas untuk sumber wajib yang hilang.

## 5. Kontrak waktu dan sinkronisasi

Ada tiga domain: project time, composition output time, recording source time.

Untuk clip dengan kecepatan konstan r:

`compositionTime = sourceInUs + (projectTime - timelineStartUs) * r`

`clipDuration = (sourceOutUs - sourceInUs) / r`

SourceIn/sourceOut Record menunjuk waktu output composition. Composition time map mengubah waktu ini menjadi recording source time; mapping tersebut menyimpan trim/speed internal lama dan bersifat piecewise monotonic untuk rate positif. Timestamp cursor dan zoom/layout berbasis sumber recording, bukan posisi clip pada project. Annotation internal memakai domain yang dideklarasikan adapter; metadata lama wajib dikonversi sesuai semantik asalnya, tanpa menganggap seluruh region memakai clock sama.

Setiap stream menyimpan startOffsetUs relatif origin recording. Pada recordingSourceTime s, waktu lokal stream ialah s - startOffsetUs. Stream belum mulai/sudah berakhir menghasilkan fallback eksplisit: webcam transparan, audio silence; screen di luar durasi valid tidak boleh dibuat clip tanpa validasi.

Seek mengevaluasi state langsung pada waktu target, termasuk spring cursor/zoom. Evaluasi memerlukan pre-roll atau checkpoint deterministik agar hasil tidak tergantung urutan playback sebelumnya. Preview dan export memakai evaluator waktu/efek sama.

Saat split di project time p, source boundary dihitung memakai mapping di atas; tidak memotong atau menulis ulang media. Left dan right clip mempunyai batas yang bertemu tanpa overlap/gap tambahan. Pada clip rate 2x, project delta 5 detik berarti composition delta 10 detik.

Internal trim/speed mengubah durasi composition. Update dilakukan sebagai satu command: rentang clip di-clamp pada durasi baru, start project tetap, panjang berubah; clip sesudahnya tidak otomatis bergeser. Hasil kosong ditolak dengan pesan jelas. Untuk eksperimen, overlap pada visual track sama ditolak; user memperpendek clip atau memindahnya ke track lain. Ini default non-ripple.

## 6. Editor dan batas modul

- Timeline domain: schema, validation, mapping, operasi command murni. Tidak bergantung React/Electron.
- Project store: project state authoritative, selection/UI terpisah, dirty revision, undo/redo. Drag menghasilkan satu command saat selesai, preview gesture tidak memenuhi history.
- Recording package adapter: mengambil hasil finalisasi capture yang ada menjadi paket tervalidasi; mengonsumsi konteks preserveProjectPath sesuai sesi platform.
- Record composition adapter/evaluator: pengaturan lama → composition → output frame dan audio contributions pada waktu tertentu. Renderer tidak harus membuka/mengaktifkan VideoEditor global untuk export.
- Timeline UI: library, track, clip interaction, inspector, playback controls. Double-click Record masuk workspace internal, breadcrumb kembali ke project. Pilihan text/image mengubah properti objek tersebut.
- Project evaluator: visual stacking dari bawah ke atas, background canvas, transform compound sesudah render internal, audio mix semua kontribusi aktif. Mute visual track mematikan audio milik clip; hidden hanya menyembunyikan visual. Track audio memakai mute, lock hanya mencegah editing.
- Persistence adapter: schema migration, asset staging, manifest, save queue, project identity, autosave.
- Export adapter: evaluator yang sama dengan preview, scheduling frame, decoding/encoding dan audio rendering melalui infrastruktur yang kompatibel.

Mikrofon/system audio paket dihitung sekali. Jika audio sudah tertanam dalam screen video dan sidecar tersedia, manifest memilih sidecar sebagai sumber canonical; embedded track dimatikan untuk mencegah audio ganda. Audio item global seperti musik ditambahkan setelah audio internal Record dievaluasi. Rate clip diterapkan konsisten pada semua stream; time stretching mempertahankan pitch pada rate yang didukung, kegagalan backend menghasilkan error eksplisit.

## 7. Penyimpanan .captr

Satu .captr per project. project.json tetap indeks authoritative dengan version: 3. Folder slides/<packageId>/ tetap dipakai sebagai owner media paket Record dan manifest slide.json compatibility; package.json baru menyatakan aset/offset/capture metadata. Nama folder adalah keputusan storage, UI menampilkan Record clip.

Komposisi disimpan di compositions/<compositionId>.json; project.json mereferensikan komposisi dan aset. Imported video/image/audio memiliki owner unik slides/<assetOwnerId>/ beserta manifest, sehingga aset tidak dipindah ke folder global. Dua clip dari recording sama tidak menggandakan media. Proxy/cache tidak authoritative dan dapat diregenerasi.

Deletion clip tidak menghapus library package. Penghapusan package dari library ditolak selama direferensikan; cleanup aset dilakukan berdasarkan reachability seluruh project, bukan selection atau active clip.

Ctrl+S memakai path project aktif. Renderer/Electron yang berbeda state hanya memulihkan target melalui projectId bundle yang cocok dengan snapshot yang disimpan. New Project membuat identity baru dan meminta lokasi baru; Save As membuat salinan dengan identity baru dan memperbarui path hanya setelah sukses. Save memakai snapshot immutable dan queue; dirty revision hanya dibersihkan sampai revision yang berhasil tersimpan. Penulisan bundle ke file sementara, validasi, lalu replace menjaga file sebelumnya saat gagal.

Saat kontrak storage benar-benar diimplementasikan, perbarui ISSUE.md dan AGENTS.md dalam perubahan sama. Spec ini belum mengubah kontrak berjalan atau menandai checklist lama selesai.

## 8. Migrasi dan rollout

Selama rollout, workspace Record yang tersisa menyediakan jalur regresi capture; Video/Motion tidak dipertahankan sebagai mode runtime. Perintah eksplisit Convert to Timeline untuk project Record yang didukung menulis salinan .captr baru, mempertahankan file/identity lama; konversi tidak menimpa otomatis.

Record slide lama → package + composition + satu timeline clip. Urutan slide tanpa transition → posisi berurutan menurut durasi output aktual. Global audio → audio timeline clip dengan trim/fade/loop yang dipertahankan.

Project lama yang mengandung Video/Motion atau extension/transition belum didukung ditolak untuk editing/konversi dengan alasan per-item sebelum mutasi state. Bundle asli tidak diubah dan tidak disimpan ulang dalam bentuk parsial. Pesan menyebut penggunaan versi Captr sebelumnya untuk membuka project tersebut. Tidak ada renderer atau schema aktif dari folder yang dihapus; deteksi legacy membaca envelope mentah secara minimal. Migrasi isi Video/Motion menjadi track umum dapat menjadi pekerjaan berikutnya. Record tidak dibakar menjadi MP4.

Reader version 3 tidak menyamar sebagai version 2. Versi aplikasi yang tidak mendukung schema harus menampilkan pesan upgrade; tidak melakukan downgrade lossy.

## 9. Error, performa dan export

Recording yang belum selesai tetap pending dan tidak bisa dimasukkan ke timeline. Gagal finalisasi tidak mereset project aktif. Paket berhasil masuk library; penempatan dilakukan melalui drag/drop sehingga perekaman tidak mengganti timeline.

Media wajib hilang: placeholder dan daftar file di UI; export diblokir dengan lokasi clip/package. Metadata corrupt: paket gagal validasi; raw media bisa diimpor terpisah atas pilihan pengguna. Sidecar opsional hanya diabaikan jika manifest secara eksplisit menyatakan stream tidak direkam.

Resource decoder/cache dibatasi pada clip aktif dan prefetch terbatas. Seek yang tertinggal dibatalkan menggunakan generation token. Render compound dapat dicache berdasarkan revision, waktu, dan canvas; proxy tidak menggantikan metadata editable.

Exporter Record yang tersisa dipertahankan melalui adapter. Export timeline menyampling seluruh track pada setiap frame dan mencampur audio berdasarkan evaluator project; stitching slide saja tidak cukup untuk clip overlap. Cancel/failure membersihkan file sementara dan tidak mengubah project/media asli.

## 10. Tahapan pengembangan

Ini urutan milestone, bukan implementation plan terperinci:

0. Hapus modul Video/Motion beserta wiring, UI action, registry, schema runtime dan test spesifik fitur tersebut; tambahkan penolakan project legacy yang aman. Pastikan Record tetap berjalan dan aplikasi lolos TypeScript.
1. Kontrak RecordingPackage, composition dan time mapping; fixture capture/legacy; adapter murni tanpa UI baru.
2. Timeline vertical slice: library, dua track visual/audio, operasi dasar, undo/redo; Record internal editor dan preview.
3. Persistence version 3, staging aset, convert-as-copy untuk subset didukung, regresi path/projectId.
4. Export evaluator project, audio mix, parity preview/export, packaged smoke test dan QA native Windows/macOS.

OpenCut live/classic adalah acuan UX; Cartcut tidak lagi menjadi kandidat UX utama. Adopsi modul OpenCut harus lewat inspeksi dependency/API/render contract dan attribution pada commit yang dipin. Flow inti wajib memiliki acceptance matrix terhadap baseline, tanpa klaim seluruh feature set sudah identik.

## 11. Verifikasi dan acceptance

- Unit: mapping tiga clock, offsets stream, half-open boundaries, split/rate, source immutability, independent composition, lock/mute/hidden, undo/redo.
- Integration: finalisasi recording → package → library; pending/error; sidecar versus embedded audio; queue autosave/Ctrl+S; project identity mismatch; save interrupted; bundle path validation.
- Fixture deterministik: screen/cursor/click marker, webcam marker, mic tone, system tone dengan offset yang diketahui. Setelah split, trim, 0.5x/2x dan seek acak, marker preview/export harus cocok dalam satu frame project; audio alignment dalam satu frame setelah memperhitungkan codec delay.
- End-to-end acceptance: recording 60 detik → potongan 5–15 dan 30–40 → video biasa di antaranya → text/image di track atas → musik di track audio → ubah cursor/auto-zoom salah satu potongan → undo/redo → Ctrl+S → tutup/buka ulang → export. Kedua potongan tetap punya edit independen, metadata utuh, dan tidak ada audio ganda.
- Jalankan checklist ISSUE.md: dua Record tambahan pada project aktif, Windows Test 2.captr, Save As dan New Project. Saat penghapusan diterapkan, revisi checklist Video menjadi import video umum pada timeline; Motion menjadi penolakan legacy tanpa overwrite. Verifikasi browser/native masing-masing; jalur Windows tidak dianggap melewati finalizer macOS.
- Pengujian otomatis domain/persistence/export wajib menjadi CI gate. QA UI/native dan packaged test melengkapi unit test; jumlah test saja bukan bukti kesuksesan.

## 12. Review spec

Keputusan yang perlu pengguna review: Record compound default, edit composition independen per clip, timeline non-ripple, paket di library sebelum drag, penyimpanan tetap satu .captr, dan konversi project lama sebagai salinan eksplisit.

Self-review: domain waktu dibedakan; ownership source/edits jelas; asset deduplication tidak merusak folder per owner; legacy yang tidak didukung tidak hilang; scope dibatasi satu vertical slice; acceptance mencakup simpan/buka ulang/export. Implementasi dan implementation plan menunggu review spec tertulis sesuai workflow Superpowers.
