# Transkripsi dan caption

Captr Studio menyediakan jalur speech-to-text lokal memakai Whisper. Audio sumber diekstrak dan transkrip disimpan sebagai metadata/sidecar yang dapat dipakai editor serta context agent.

## Transkrip source

Transkrip berisi segment/kata dan timestamp. Ia menjelaskan isi source media, sehingga dapat dipakai bersama ketika source yang sama ditempatkan pada beberapa Story. Sidecar seperti `transcript.json` dan `captions.vtt` mengikuti media yang terdaftar.

Inferensi lokal memerlukan runtime Whisper dan model yang tersedia. Downloader model ada dalam workflow aplikasi; unduhan model tetap memerlukan jaringan meskipun inferensi setelah itu dapat berjalan lokal.

## Caption Story

Caption video final adalah keputusan Story: teks, timing, segmentasi, posisi, dan style dapat berbeda dari transkrip mentah. Ownership foundation mempertahankan metadata caption pada canonical owner, projection, dan save/reopen.

Subtitle/karaoke overlay pada preview tersedia. Namun pada kondisi 10 Oktober 2026, overlay Story berada di lapisan UI terpisah dari canvas yang diekspor. **Editor caption final dan burn-in pada export Story masih backlog.**

Jangan memakai keberadaan preview subtitle atau klaim karaoke pada release note lama sebagai bukti caption final Story sudah masuk MP4.

## Pemakaian context agent

Agent dapat menerima transcript untuk merencanakan cut atau B-roll. Source transcript tidak memberi agent hak mengubah Story lain; hasil editing tetap membawa [StoryEditContext](../architecture/agent-mcp.md).

## Pekerjaan lanjutan

- Editor segment/kata caption lokal Story dengan undo/redo.
- Pemetaan caption mengikuti trim/rate dan nested Record clocks.
- Burn-in melalui renderer bersama agar preview dan export setara.
- QA hasil video dan round-trip metadata.

Lihat [roadmap finishing](../project/roadmap.md) dan [status fitur](../product/status.md).

