# Arsitektur AI Custom Harness dan MCP Server

Dokumen ini menjelaskan arsitektur integrasi AI Agent, Model Context Protocol (MCP) server lokal, serta Custom Harness UI (`Ctrl+K`) yang terpasang pada **Captr Studio V3**.

---

## 1. Ikhtisar Arsitektur

Captr Studio memisahkan antarmuka pengguna (native Spotlight Harness) dengan runner LLM (eksternal/terminal), terhubung melalui MCP server lokal dan IPC layer:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CAPTR STUDIO EDITOR                           │
│                                                                        │
│   ┌───────────────────────────┐      ┌──────────────────────────────┐  │
│   │ Floating Command Bar      │      │ External CLI / Terminal      │  │
│   │ (Ctrl+K Spotlight & Pills)│      │ (agy, opencode, hermes, etc.)│  │
│   └─────────────┬─────────────┘      └──────────────┬───────────────┘  │
│                 │                                   │                  │
│                 ▼                                   ▼                  │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │       Local MCP Server (port 4040 / stdio / IPC)                │  │
│   │  • activeSurfaceState tracking   • get_project_context          │  │
│   │  • set_frame_appearance          • apply_appearance_preset      │  │
│   │  • auto_zoom_to_clicks           • split_clip / trim_clip       │  │
│   │  • remove_silence                • add_broll_or_overlay         │  │
│   └─────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│                                     ▼                                  │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                 ProjectController.execute                       │  │
│   │           (Pure In-Memory Metadata Transformations)             │  │
│   └─────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│                                     ▼                                  │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │      Speculative Ghost Preview Drawer & Undo/Redo History       │  │
│   │         (Non-Destructive • Zero Synthetic Media Proxies)        │  │
│   └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Real-Time Surface Awareness & IPC Sync

Setiap perpindahan surface/tab pada renderer memanggil IPC `agent:sync-surface`:
- **`ActiveSurface`**: Representasi tipe diskriminatif (`kind: "record-editor" | "story-editor" | "caption-editor" | "artboard" | "voiceover" | "none"`).
- **Graceful Closed-Project Handling**: Ketika MCP tool `get_project_context` dipanggil oleh runner eksternal saat aplikasi berada di layar Home (tidak ada project terbuka), server mengembalikan payload terstruktur tanpa error:
  ```json
  {
    "isProjectOpen": false,
    "activeView": "home",
    "activeSurface": { "kind": "none" },
    "availableActions": ["create_project", "list_recent_projects", "import_screen_recording"]
  }
  ```
- **Contextual Accelerators**: Saat project terbuka, `get_project_context` menyertakan daftar action pills relevan yang siap dipicu oleh pengguna atau agent sesuai konteks yang sedang aktif.

---

## 3. Tool MCP Terstruktur

MCP Server mengekspos tool standar untuk manipulasi metadata timeline dan composition secara aman:

| Nama Tool | Target Surface | Deskripsi & Parameter Utama |
| --- | --- | --- |
| `get_project_context` | Semua | Mengambil metadata project, trek, klip, transkrip, catatan, serta status surface aktif. |
| `set_frame_appearance` | Record Editor | Mengubah padding, corner radius, border, dan drop shadow pada frame rekaman atau webcam. |
| `apply_appearance_preset` | Record Editor | Menerapkan preset visual styling siap pakai (`brutalism`, `claymorphism`, `glassmorphism`, `modern-dark`, `clean-minimal`, `retro-arcade`). |
| `auto_zoom_to_clicks` | Record Editor | Menganalisis log klik mouse dan menghasilkan keyframe zoom in/out yang mulus secara otomatis. |
| `propose_edit_plan` | Story Timeline | Menghasilkan ringkasan rencana edit terstruktur sebelum dieksekusi. |
| `split_clip` | Story Timeline | Membagi klip pada timestamp tertentu (`clipId`, `splitTimeUs`). |
| `trim_clip` | Story Timeline | Memotong bagian in-point atau out-point klip (`clipId`, `newInUs`, `newOutUs`). |
| `remove_silence` | Story Timeline | Memotong jeda hening berdasarkan transkrip suara (`trackId`, `minSilenceDurationMs`). |
| `add_broll_or_overlay` | Story Timeline | Menempatkan B-roll atau elemen teks/shape inline di atas timeline. |
| `preview_speculative_edits` | UI Drawer | Mengirimkan draf rencana ke UI untuk dirender sebagai ghost diff. |
| `commit_edits` | History | Menerapkan rencana edit ke riwayat resmi `ProjectController`. |

---

## 4. `StoryEditContext` dan Perlindungan Stale Execution

Setiap rencana edit yang diajukan oleh agent membawa metadata immutable:
- `scope`: Lingkup Story aktif (`root` atau `artboard: <id>`).
- `projectId`: Identitas project `.captr` yang sedang dibuka.
- `generation`: Token generasi import media untuk mencegah penyusupan proses asynchronous lama.
- `revision`: Nomor revisi commit timeline saat context diambil.

Proposal edit yang basi (*stale proposal*) akan **ditolak secara atomik** (*atomic rejection*) tanpa merusak timeline kanonikal bila terdapat revisi baru sebelum rencana disetujui.

---

## 5. Speculative Preview & Non-Redundant Execution

1. **Zero Media Touching**: Perubahan hanya diterapkan pada metadata in-memory `project.json` (posisi keyframe, styling appearance, split/trim offsets). File video dan audio asli di `assets/<assetId>/` tidak pernah diubah atau dibuatkan proxy video sintetis.
2. **Ghost Timeline Diff**: Pengguna melihat perubahan secara instan di kanvas dan timeline.
3. **Penyelesaian 1-Klik**:
   - **Accept Changes (`Enter`):** Mengesahkan mutasi sebagai satu transaksi undoable di `ProjectController`.
   - **Discard (`Esc`):** Membatalkan draf dan mengembalikan state kanvas ke semula.

---

## 6. Konfigurasi Model Hierarkis

- **Global Level (`AppSettingsDialog`):** Disimpan di preferensi aplikasi (`appSettings.ts`) untuk runner CLI default (`agy`, `opencode`, `hermes`, `cursor`, `custom`), custom binary path, model default, dan port MCP server.
- **Project Level (`aiConfig` di `.captr`):** Disimpan di dalam `project.json` pada bundle `.captr`, memungkinkan setiap project memiliki model override atau persona instruksi khusus tanpa bentrok dengan pengaturan global.

---

## 7. Rujukan Terkait
- [Katalog Fitur: AI Custom Harness](../features/ai-copilot.md)
- [Arsitektur Kepemilikan Media (Ownership)](ownership.md)
- [Katalog Fitur: Record Editor](../features/record-editor.md)
- [Katalog Fitur: Story Editor](../features/story-editor.md)
