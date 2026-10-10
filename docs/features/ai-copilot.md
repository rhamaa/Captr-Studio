# AI Copilot dan agent CLI

Copilot membantu menyusun rencana dan draft editing menggunakan agent CLI yang tersedia di komputer pengguna. Sidebar dapat menampilkan context playhead, pilihan clip, Artboard aktif, log proses, dan draft timeline.

## Workflow editing

1. Pilih Story dan agent yang terdeteksi oleh aplikasi.
2. Beri instruksi; gunakan mention media bila diperlukan.
3. Periksa plan atau speculative draft/ghost clips.
4. Terima perubahan melalui command/history atau tolak draft.
5. Batalkan proses bila perlu melalui kontrol runner.

Ada jalur sidebar/runner UI dan jalur external terminal melalui MCP. Dukungan CLI bergantung registry/deteksi lokal serta tool yang benar-benar terpasang; dokumentasi tidak mematok versi model milik provider luar.

## Context yang dibawa

Context dapat mencakup sequence, source metadata, transcript, recording metadata, playhead, selection, Artboard, dan catatan whiteboard sesuai endpoint. Prompt/agent menerima data yang dilampirkan pada workflow tersebut; inferensi memakai konfigurasi CLI/provider pengguna.

Setiap proposal editing Story membawa scope, projectId, generation, dan revision. Pergantian Story/project atau edit lebih baru dapat membuat proposal lama tidak valid. Reject stale context bersifat atomik; aplikasi tidak mencoba owner lain sebagai fallback.

## Ghost preview

Ghost clips dan draft tracks menunjukkan perubahan sebelum commit. Accept memasukkan perubahan ke history root project dengan batas Story aktif. Reject menghapus rancangan tanpa mengubah canonical timeline.

Konfigurasi terminal adalah command tingkat project yang terpisah dari edit Story. Jalur scoped tidak boleh menyalin seluruh catalog global/private sibling dari draft secara bebas.

## Batas produk

Agent bukan bukti fitur finishing sudah tersedia. Permintaan speed curve, caption burn-in, atau masking harus mengikuti tool/model yang sudah diimplementasikan. Lihat [status fitur](../product/status.md) dan [MCP/context](../architecture/agent-mcp.md).

