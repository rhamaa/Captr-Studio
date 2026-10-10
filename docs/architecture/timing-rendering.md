# Arsitektur Waktu, Evaluasi, dan Rendering (Timing & Rendering)

Dokumen ini menjelaskan model matematis waktu (*time mapping*), sistem evaluasi visual/audio, dan pipeline rendering frame pada **Captr Studio V3**.

---

## 1. Tiga Lapisan Waktu Hierarkis

Captr Studio mendukung komposisi bersarang (*nested compositions*) tanpa meratakan (*flattening*) video perantara. Hal ini dimungkinkan melalui pemetaan waktu tiga lapis:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. STORY TIMELINE TIME (Microseconds: timeUs)               │
│    Waktu global pada urutan video final Story.              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │  Map: (timeUs - clip.startUs) * clip.rate
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CLIP LOCAL TIME (sourceInUs .. sourceOutUs)              │
│    Waktu relatif di dalam klip (trim in/out & playback rate)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │  Record Time Map (Cut regions & Smart Zoom)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. SOURCE MEDIA TIME (Raw Video / Telemetry stream clocks)  │
│    Waktu riil frame video mentah, webcam, dan kursor mouse. │
└─────────────────────────────────────────────────────────────┘
```

### Prinsip Sinkronisasi:
- Perubahan playback rate (misal 2.0x cepat atau 0.5x lambat) di Story secara otomatis mempercepat/memperlambat waktu sampling telemetri kursor dan webcam, menjaga sinkronisasi audio dan video tetap presisi.
- Pemotongan (*cut*) pada Record Editor tidak memotong file video asli, melainkan menyusun interval waktu yang dipetakan ulang ke source time.

---

## 2. Logical Source Extent Elemen Inline Desain

Elemen teks dan shape tidak memiliki file media fisik dengan durasi bawaan. Namun, untuk mendukung pemotongan (*trimming*), playback rate, dan pegangan transisi (*transition handles*), sistem kanonikal menetapkan **durasi logis sumber** (`durationUs`):
- **Extent Standar:** Elemen inline baru diinisialisasi dengan extent 5.000.000 mikrodetik (5 detik).
- **Trimming Non-Destruktif:** Trimming klip teks/shape hanya mengubah `sourceInUs` dan `sourceOutUs` terlihat tanpa memperkecil extent logis sumbernya.
- **Ekstensi Transisi (Grow Extent):** Jika pengguna menambahkan transisi yang membutuhkan pegangan lebih panjang daripada durasi yang tersisa, sistem memperbesar `durationUs` secara terkontrol dan dapat di-undo (*undoable command*).
- **Finite Transition Handles:** Sistem menolak durasi transisi yang melebihi pegangan sumber yang tersedia, mencegah artefak visual atau freeze frame tak terduga.

---

## 3. Evaluasi Visual Terpadu (`evaluateProject`)

Pratinjau (*preview stage*) di Story Editor dan mesin pengekspor (*MP4 exporter*) menggunakan fungsi evaluasi kanonikal yang sama persis (`evaluateProject`):

```typescript
export function evaluateProject(
    project: TimelineProject,
    timeUs: number,
    scope?: StoryScope,
): EvaluatedProjectFrame
```

### Urutan Evaluasi Per-Layer:
1. **Pemeriksaan Trek Visual:** Mengabaikan trek yang dikunci (*muted*) atau disembunyikan (*hidden*).
2. **Hit-Testing Klip Aktif:** Menemukan klip visual yang berada dalam rentang `[clip.startUs, clip.startUs + duration]`.
3. **Resolusi Sumber:** Menggunakan `resolveClipSource` untuk membedakan elemen inline vs media file.
4. **Interpolasi Keyframe:** Menghitung nilai interpolasi posisi (`x`, `y`), `scale`, `rotation`, dan `opacity` pada waktu lokal klip (`sampleClipTransform`).
5. **Aplikasi Animasi Komponen:** Menerapkan kurva animasi enter/exit (misal slide, fade, pop).
6. **Blended Transition Overlap:** Menghitung percampuran alfa atau pergeseran wipe jika klip berada di zona transisi (`clipTransitions`).

---

## 4. Evaluasi Audio (`renderProjectAudio` / Audio Plan)

Audio pada Story Editor diproses melalui pipeline audio non-destruktif:
- **Audio Plan Generation:** Membuat jadwal pemutaran klip audio dengan offset mikrodetik, gain volume, dan status mute.
- **Companion Audio Streams:** Recording package yang memiliki microphone dan system audio terpisah dipetakan dengan offset sinkronisasi masing-masing.
- **Private Audio Decoding:** Audio voiceover privat di-decode langsung dari lokasi bundle lokal tanpa konflik lintas-Story.

---

## 5. WebGL & 2D Canvas Parity

Renderer grafis (`ProjectFrameRenderer`) mendukung akselerasi perangkat keras WebGL dengan fallback otomatis ke Canvas 2D:
- Shader transisi dan filter visual dievaluasi identik di WebGL maupun Canvas 2D.
- Export MP4 menggunakan offscreen render loop yang menghasilkan frame bit-level identik dengan apa yang dilihat pengguna di preview kanvas.

---

## 6. Rujukan Terkait
- [Katalog Fitur: Story Editor](../features/story-editor.md)
- [Katalog Fitur: Export](../features/export.md)
- [Arsitektur Format Proyek](project-format.md)
