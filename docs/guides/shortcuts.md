# Shortcut Story Editor

Daftar ini berasal dari handler StoryEditor pada checkout 10 Oktober 2026. Shortcut tidak dijalankan saat fokus berada pada input, textarea, select, atau elemen editable.

| Tombol | Aksi |
| --- | --- |
| Space | Play/pause timeline |
| Left / Right | Mundur/maju satu frame berdasarkan fps canvas |
| Shift + Left / Right | Mundur/maju satu detik |
| Home / End | Ke awal/akhir timeline |
| S atau C | Split melalui command timeline pada playhead |
| Ctrl/Cmd + D | Duplicate clip terpilih |
| Delete / Backspace | Hapus clip terpilih |
| Shift + Delete / Backspace | Ripple delete clip terpilih |
| F | Toggle fullscreen preview |
| L | Toggle loop playback |
| Escape | Keluar fullscreen ketika fullscreen aktif |
| Ctrl/Cmd + backtick | Toggle terminal project |
| Ctrl/Cmd + mouse wheel | Zoom preview workspace |
| Middle mouse drag | Pan preview workspace |
| Shift + left drag | Pan saat preview tidak berada pada Fit |

Split tetap mengikuti aturan selection/track/lock pada command timeline; shortcut tidak memberi izin mengubah track terkunci. Shortcut Save dan Undo/Redo dikelola oleh lifecycle/history project di luar handler ini.

Preset zoom selector tersedia dari 25% sampai 300%; wheel zoom memiliki clamp sendiri. Reset Fit mengembalikan zoom dan pan area kerja. Preview zoom tidak mengubah canvas atau ukuran export.

Rujukan kode: `src/components/editor/StoryEditor.tsx`, terutama handler keyboard dan preview gesture. Lihat [Story Editor](../features/story-editor.md).

