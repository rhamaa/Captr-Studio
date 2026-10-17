# Transkripsi dan caption

Captr Studio menyediakan jalur speech-to-text lokal memakai Whisper. Audio sumber diekstrak dan transkrip disimpan sebagai metadata/sidecar yang dapat dipakai editor serta context agent.

## Transkrip source

Transkrip berisi segment/kata dan timestamp. Ia menjelaskan isi source media, sehingga dapat dipakai bersama ketika source yang sama ditempatkan pada beberapa Story. Sidecar seperti `transcript.json` dan `captions.vtt` mengikuti media yang terdaftar.

Inferensi lokal memerlukan runtime Whisper dan model yang tersedia. Downloader model ada dalam workflow aplikasi; unduhan model tetap memerlukan jaringan meskipun inferensi setelah itu dapat berjalan lokal.

## Caption Story

Caption video final adalah keputusan Story: teks, timing, segmentasi, posisi, dan style dapat berbeda dari transkrip mentah. Ownership foundation mempertahankan metadata caption pada canonical owner, projection, dan save/reopen.

Per 17 Oktober 2026, tombol **Captions** pada footer Story membuka editor caption final. Pilih **Generate from transcripts** atau **Add caption**, lalu ubah teks, timing, kata, posisi, ukuran dan warna. Perubahan masuk history undo/redo dan tersimpan pada owner Story di `.captr`.

Caption hasil generate menyimpan snapshot transkrip per placement pada source clock, lalu dipetakan melalui trim/rate dan time map Record saat digambar. Caption manual memakai waktu Story. Renderer Canvas yang sama membakar caption untuk preview dan export MP4. Preview transkrip lama masih tersedia sampai caption final dibuat; gunakan panel Captions untuk menghasilkan caption yang ikut export.

## Pemakaian context agent

Agent dapat menerima transcript untuk merencanakan cut atau B-roll. Source transcript tidak memberi agent hak mengubah Story lain; hasil editing tetap membawa [StoryEditContext](../architecture/agent-mcp.md).

## Pekerjaan lanjutan

- QA visual desktop hasil MP4 dan interaksi panel; round-trip metadata diuji otomatis.

Lihat [roadmap finishing](../project/roadmap.md) dan [status fitur](../product/status.md).

