# Arsitektur AI Copilot dan MCP Server

Dokumen ini menjelaskan arsitektur integrasi AI Agent, Model Context Protocol (MCP) server lokal, serta Copilot Sidebar yang terpasang pada **Captr Studio V3**.

---

## 1. Ikhtisar Arsitektur

Captr Studio menyediakan integrasi agent dua arah (*bidirectional agent integration*) yang menghubungkan LLM/CLI agent (seperti `agy`, `claude`, atau model lokal) dengan timeline project `.captr`:

```
┌────────────────────────────────────────────────────────┐
│                   CAPTR STUDIO EDITOR                  │
│                                                        │
│  ┌────────────────────┐      ┌──────────────────────┐  │
│  │   Copilot Sidebar  │      │  Integrated Terminal │  │
│  │   (In-Context UI)  │      │  (Project CLI Shell) │  │
│  └─────────┬──────────┘      └──────────┬───────────┘  │
│            │                            │              │
│            ▼                            ▼              │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Local MCP Server (stdio / IPC)           │  │
│  │   • get_project_context  • split_clip            │  │
│  │   • propose_edit_plan    • trim_clip             │  │
│  │   • preview_speculative  • add_broll_or_overlay  │  │
│  │   • commit_edits         • remove_silence        │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│                             ▼                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │              ProjectController.execute           │  │
│  │         (Atomic Undoable Command History)        │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 2. In-Context Copilot Sidebar

Alih-alih modal popup yang memblokir layar, Copilot dirancang sebagai laci sidebar samping non-blocking:
- **Selection-Aware:** Mengidentifikasi klip yang sedang dipilih, playhead aktif, dan Artboard yang sedang dibuka.
- **Media Mention:** Pengguna dapat mengetik tag `@Clip`, `@Asset`, `@Whiteboard` untuk memasukkan konteks spesifik ke prompt agent.
- **Non-Blocking Interaction:** Pengguna dapat terus memutar video (*playback*), melakukan scrubbing, atau memeriksa timeline saat agent sedang bekerja.

---

## 3. Tool MCP Terstruktur

MCP Server Captr Studio mengekspos tool standar untuk memanipulasi timeline secara aman dan deterministik:

| Nama Tool | Deskripsi | Parameter Utama |
| --- | --- | --- |
| `get_project_context` | Mengambil metadata project, trek, klip, transkrip dengan timestamp per kata, dan catatan whiteboard. | `includeTranscripts`, `artboardId` |
| `propose_edit_plan` | Menghasilkan ringkasan rencana edit terstruktur sebelum dieksekusi. | `summary`, `operations[]` |
| `split_clip` | Membagi klip pada timestamp tertentu. | `clipId`, `splitTimeUs` |
| `trim_clip` | Memotong bagian awal (*in-point*) atau akhir (*out-point*) klip. | `clipId`, `newInUs`, `newOutUs` |
| `remove_silence` | Memotong segmen jeda hening berdasarkan transkrip suara. | `trackId`, `minSilenceDurationMs` |
| `add_broll_or_overlay` | Menempatkan B-roll atau elemen teks/shape inline di atas timeline. | `trackId`, `assetId`, `content`, `startUs` |
| `preview_speculative_edits` | Mengirimkan draf rencana ke UI untuk dirender sebagai ghost clips. | `draftProject`, `diffSummary` |
| `commit_edits` | Menerapkan rencana edit ke riwayat resmi `ProjectController`. | `planId` |

---

## 4. `StoryEditContext` dan Perlindungan Stale Execution

Setiap rencana edit yang diajukan oleh agent membawa metadata immutable bernama `StoryEditContext`:
- `scope`: Lingkup Story aktif (`root` atau `artboard: <id>`).
- `projectId`: Identitas project `.captr` yang sedang dibuka.
- `generation`: Token generasi import media untuk mencegah penyusupan proses asynchronous lama.
- `revision`: Nomor revisi commit timeline saat context diambil.

### Penolakan Proposal Basi (Stale Context Rejection):
Jika pengguna melakukan editing manual (misal memotong klip lain atau berpindah Artboard) sebelum agent menyelesaikan rencananya, `revision` atau `scope` akan berbeda. Proposal edit yang basi akan **ditolak secara atomik** (*atomic rejection*) tanpa merusak timeline kanonikal.

---

## 5. Ghost Timeline Preview (Speculative Diff)

Sebelum commit diterapkan ke riwayat undo:
1. UI merender **Ghost Clips** semi-transparan pada timeline dengan highlight warna khusus.
2. Pengguna dapat menekan tombol **Play** untuk melihat pratinjau hasil edit spekulatif.
3. Dua tombol aksi disediakan di bilah Copilot:
   - **Accept Changes:** Menerapkan seluruh operasi melalui `ProjectController.execute` dan mencatat satu entri riwayat undo.
   - **Discard:** Menghapus pratinjau spekulatif tanpa mengubah proyek sama sekali.

---

## 6. Terminal Tingkat Project

Pengaturan terminal CLI terintegrasi ke dalam file project `.captr`:
- Membuka terminal dengan pintasan `Ctrl + \`` langsung pada direktori konteks project aktif.
- Menjalankan agent CLI lokal (`agy`, `claude`, `codex`) yang otomatis terhubung ke MCP endpoint Captr Studio yang sedang berjalan.

---

## 7. Rujukan Terkait
- [Katalog Fitur: AI Copilot](../features/ai-copilot.md)
- [Arsitektur Kepemilikan Media (Ownership)](ownership.md)
- [Katalog Fitur: Story Editor](../features/story-editor.md)
