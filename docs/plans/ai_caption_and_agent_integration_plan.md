# AI-Powered Video Automation: Caption Pipeline & Agent Integration Plan

## 1. Overview & Understanding Summary
* **Tujuan:** Mengotomasi pengeditan video di Captr Studio menggunakan AI multimodal (Speech-to-Text Captioning + CLI AI Agents seperti Claude, Codex, Agy, OpenCode).
* **Alur Caption:**
  1. Pengguna memilih aset di library (rekaman layar, mikrofon, file video/audio eksternal).
  2. Pengguna menekan tombol **"Generate Captions"** (*manual on-demand*).
  3. Audio diekstrak ke 16kHz WAV mono via FFmpeg (`ffmpeg-static`).
  4. Engine Speech-to-Text (Local Whisper via `whisper-cli.exe` atau Cloud API Groq/OpenAI) memproses audio.
  5. Menghasilkan word-level timestamps yang disimpan di `assets/<assetId>/transcript.json` dan `captions.vtt`.
* **Sinkronisasi Non-Destruktif:** Subtitle di-render otomatis di atas video player kanvas. Saat klip di timeline dipotong (*cut/trim*) atau diubah *speed rate*-nya, subtitle otomatis menyesuaikan tanpa merusak transkrip asli.
* **Integrasi AI Agent (Hyperframe Bridge):** Jendela/Dock UI di Captr Studio yang memungkinkan pengguna memilih CLI tool untuk memotong video atau membuat variasi Shorts/Reels berdasarkan teks transkrip `transcript.json` dan `project.json`.

---

## 2. Decision Log
1. **Trigger Transkripsi:** *Manual On-Demand* (Hanya saat user menekan tombol pada aset).
2. **STT Engine:** *Hybrid* (Default: Local bundled `whisper-cli` di `electron/native/bin/`, dengan fallback/opsi Cloud Groq & OpenAI API).
3. **Penyimpanan:** Per-aset di `assets/<assetId>/transcript.json` dan `captions.vtt`.
4. **Interaksi UI:** Subtitle visual track overlay di player + tombol per-aset di panel Asset Library.
5. **Agent Interface:** Dock / Modal AI Assistant yang terhubung ke CLI binaries lokal melalui Electron Child Process IPC.

---

## 3. Skema Data `transcript.json`

Setiap aset yang telah ditranskrip akan memiliki file `assets/<assetId>/transcript.json` dengan struktur:

```json
{
  "assetId": "rec-asset-123",
  "language": "id",
  "durationUs": 30000000,
  "segments": [
    {
      "id": 0,
      "startUs": 1000000,
      "endUs": 4500000,
      "text": "Selamat datang di Captr Studio",
      "words": [
        { "word": "Selamat", "startUs": 1000000, "endUs": 1600000 },
        { "word": "datang", "startUs": 1650000, "endUs": 2200000 },
        { "word": "di", "startUs": 2250000, "endUs": 2500000 },
        { "word": "Captr", "startUs": 2550000, "endUs": 3200000 },
        { "word": "Studio", "startUs": 3250000, "endUs": 4500000 }
      ]
    }
  ]
}
```

---

## 4. Rumus Time-Mapping Timeline

Ketika sebuah klip video di timeline memiliki:
* Titik awal di timeline: `clip.startUs`
* Titik potong sumber: `clip.sourceInUs` sampai `clip.sourceOutUs`
* Kecepatan putar: `clip.rate`

Maka sebuah kata dengan `word.startUs` dan `word.endUs` akan aktif dan ditampilkan pada waktu timeline:

$$\text{isWordActive}(t) \iff \text{word.startUs} \ge \text{clip.sourceInUs} \land \text{word.endUs} \le \text{clip.sourceOutUs}$$

Dan waktu tampilnya di layar timeline adalah:

$$\text{timelineTimeUs} = \text{clip.startUs} + \frac{\text{word.startUs} - \text{clip.sourceInUs}}{\text{clip.rate}}$$

---

## 5. Rencana Fase Implementasi

### Fase 1: Audio Extractor & Transkripsi Core (Backend IPC)
1. Buat tipe TypeScript untuk transkrip (`src/core/timeline/transcriptTypes.ts`).
2. Buat IPC Handler di Electron (`electron/ipc/transcription/`):
   * `extract-asset-audio`: Konversi audio aset ke 16kHz WAV mono menggunakan `getFfmpegBinaryPath()`.
   * `run-whisper-transcription`: Menjalankan `whisper-cli` lokal atau Cloud API Groq/OpenAI.
   * `save-asset-transcript`: Menyimpan `transcript.json` dan `captions.vtt` ke folder aset.
3. Unit tests untuk time-mapping dan parser transkrip.

### Fase 2: Integrasi UI Asset Library (Tombol & Status)
1. Tambahkan tombol "Generate Captions" di kartu aset atau context menu `AssetLibrary.tsx`.
2. Status visual: Loading spinner saat memproses, dan badge `[CC]` jika transkrip telah tersedia.
3. Preview transkrip singkat di popup info aset.

### Fase 3: Subtitle Overlay Renderer & Auto-Cut Sync
1. Komponen `SubtitleOverlay.tsx` di dalam `ProjectPreview.tsx`.
2. Membaca `transcript.json` dari aset klip aktif, menghitung pemotongan secara dinamis dengan rumus time-mapping.
3. Mendukung kustomisasi visual dasar (posisi atas/bawah, warna teks, background container).

### Fase 4: AI Agent / Hyperframe Assistant Panel [SELESAI]
1. [x] Modal / Drawer UI di Project Editor (`AIAssistantModal.tsx`).
2. [x] Input prompt pengguna + preset chips (cut dead air, 60s reel, filler removal) + pemilihan CLI agent (`claude`, `codex`, `agy`, `opencode`, `gemini`).
3. [x] Payload assembler: Merangkum `project.json` + semua `transcript.json` kata per kata menjadi konteks lengkap (`agentPayload.ts`).
4. [x] Menjalankan CLI di subprocess dengan live stdout/stderr log streaming (`agentRunner.ts`, `agentDetector.ts`), memvalidasi hasil perubahan `validateTimelineProject()`, menghasilkan diff review, dan 1-click apply ke Project Editor timeline dengan undo/redo terintegrasi.

