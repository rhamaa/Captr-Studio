# Record Editor

Record Editor mengolah **satu placement recording** yang dibuka dari Story. Ia berada di bawah Story Editor dalam alur compositing; ia bukan project file terpisah untuk setiap edit.

## Fungsi utama

- Mengatur framing/canvas recording, cursor, webcam, zoom, dan motion.
- Mengubah cut serta pemetaan waktu rekaman pada komposisi placement.
- Memakai source package dan sidecar yang tetap tersimpan bersama di project.
- Menerima rasio/dimensi Story atau Artboard tempat placement dibuka.

Cursor smoothing, click feedback, auto-zoom/auto-reframe, webcam layout, dan recording styling termasuk area Record Editor. Detail setting historis tersedia pada [verifikasi recording settings](../verification/2026-10-04-recording-editor-settings.md).

## Edit independen

Satu Recording Asset dapat dipakai dua kali pada Story yang sama atau pada Artboard berbeda. Setiap placement mempunyai Record composition sendiri. Mengubah zoom/cut pada placement B tidak mengubah package sumber atau komposisi placement A.

Duplikasi Artboard membuat identitas placement dan komposisi independen sambil tetap berbagi source global. Ini memungkinkan versi tutorial panjang dan short portrait memakai recording yang sama.

## Hubungan dengan Story

Urutan visual adalah source media → komposisi Record → efek placement Story → compositing Story. Trim/rate Story tidak boleh merusak cursor, webcam, dan audio yang mengikuti source time Record.

Setelah selesai mengedit komposisi Record, lanjutkan urutan klip, Text/Shape, transisi, musik, dan voiceover di [Story Editor](story-editor.md). Source tetap editable; tidak perlu flatten package untuk memakai efek Story.

## Batas bukti

Renderer/clock diuji pada rate 0.5× dan 2×, termasuk mic/webcam/cursor alignment. Interaksi Record Editor/native dan output encoder nyata tetap memerlukan [QA desktop](../project/verification.md).

