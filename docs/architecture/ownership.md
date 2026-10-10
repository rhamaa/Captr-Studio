# Arsitektur Kepemilikan Media dan Elemen Story (Story Asset Ownership)

Dokumen ini menjelaskan model kepemilikan kanonikal (canonical ownership) antara project `.captr`, Artboard, Story, dan klip timeline yang diimplementasikan pada 10 Oktober 2026 (commit `8c2fe68` / Issue #12).

---

## 1. Prinsip Dasar Kepemilikan

Captr Studio V3 mengadopsi model **pemisahan kepemilikan yang tegas (strict ownership boundary)** untuk mencegah tercampurnya aset media yang dapat digunakan ulang (*reusable media*) dengan elemen desain lokal yang spesifik untuk satu video.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PROJECT (.captr)                                │
│                                                                        │
│   ├── Assets Global (`project.assets`)                                 │
│   │   • Screen Recording Packages                                      │
│   │   • Video / B-roll file sources                                    │
│   │   • Gambar / Logo / Audio musik impor                              │
│   │                                                                    │
│   ├── Templates Desain (`project.designTemplates`)                     │
│   │   • Preset Teks & Shape reusable (tanpa backing media)             │
│   │                                                                    │
│   ├── Default / Root Story Sequence (`project.tracks`)                 │
│   │   • Media Privat Root: `project.localAssets`                       │
│   │   • Desain Inline Lokal: `clip.content` (Teks/Shape)               │
│   │                                                                    │
│   └── Repurpose Artboards (`repurposeBoard.artboards[]`)               │
│       ├── Artboard 1: "TikTok 9:16"                                    │
│       │   • Timeline mandiri: `artboard.tracks`                        │
│       │   • Media Privat: `artboard.localAssets` (e.g. Voiceover)      │
│       │   • Desain Inline: `clip.content`                              │
│       │                                                                │
│       └── Artboard 2: "YouTube 16:9"                                   │
│           • Timeline mandiri: `artboard.tracks`                        │
│           • Media Privat: `artboard.localAssets`                       │
│           • Desain Inline: `clip.content`                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Empat Kategori Entitas

| Kategori | Tingkat Pemilik | Deskripsi & Contoh | Aturan Akses |
| --- | --- | --- | --- |
| **Assets Global** | Project (`project.assets`) | Recording packages, video B-roll, gambar, musik background. | Dapat diakses dan ditempatkan oleh semua Artboard/Story. |
| **Story Media** | Privat ke Story (`localAssets`) | Rekaman voiceover yang diambil dalam Story, media privat. | Hanya dapat diakses oleh Story pemilik; tidak terlihat oleh Story saudara (*sibling*). |
| **Inline Content** | Klip Story (`clip.content`) | Judul teks, lower third, callout, rectangle, ellipse, line, arrow. | Sepenuhnya lokal di dalam klip timeline; **tidak** membuat entri `MediaAsset` sintetis di Assets. |
| **Templates** | Library Project (`project.designTemplates`) | Preset teks/shape yang dapat digunakan ulang. | Menerapkan template membuat salinan mendalam (*deep clone*) menjadi inline content di klip aktif. |

---

## 3. Struktur Data Kanonikal pada Klip (`TimelineClip`)

Pada model V3 terbaru, sebuah klip visual memiliki **tepat satu** di antara `assetId` atau `content`:

```typescript
export interface TimelineClip {
    id: string;
    assetId?: string;       // Merujuk ke MediaAsset fisik (global atau privat Story)
    content?: StoryClipContent; // Elemen desain inline tanpa file media fisik
    startUs: number;
    sourceInUs: number;
    sourceOutUs: number;
    rate: number;
    transform: ClipTransform;
    gain: number;
    enabled: boolean;
    // ... keyframes, animation, transitions
}

export type StoryClipContent =
    | { kind: "text"; text: TextOverlay; durationUs: number }
    | { kind: "shape"; shapeDefinition: ShapeDefinition; durationUs: number };
```

### Aturan Kontrak:
1. **XOR Requirement:** Klip media menggunakan `assetId`. Klip desain menggunakan `content`. Keduanya tidak boleh ada bersamaan atau kosong bersamaan pada klip yang valid.
2. **Logical Source Extent:** Elemen inline memiliki durasi logis sumber `durationUs` (default 5.000.000 µs = 5 detik). Operasi trim memperpendek porsi terlihat tanpa merusak extent, sedangkan ekstensi pegangan transisi memperbesar extent secara undoable.
3. **Tanpa File Sintetis:** Tidak ada folder `assets/<id>/` atau file `asset.json` tiruan yang dibuat di bundle disk untuk elemen teks atau shape.

---

## 4. Resolusi Sumber Media (`resolveClipSource`)

Untuk mengevaluasi frame, merender preview, dan melakukan ekspor, aplikasi menggunakan API resolusi terpadu:

```typescript
export function resolveClipSource(
    project: TimelineProject,
    clip: TimelineClip,
    scope: StoryScope, // { kind: "root" } atau { kind: "artboard", artboardId: string }
): ResolvedClipSource | null
```

### Algoritma Resolusi:
1. Jika klip memiliki `content`: Sumber langsung di-resolve dari `clip.content` (desain inline), menghasilkan deskriptor visual dengan dimensi kanvas dan durasi logis tanpa membaca disk.
2. Jika klip memiliki `assetId`:
   - Pertama diperiksa di **Media Privat Story aktif** (`story.localAssets`).
   - Jika tidak ditemukan, diperiksa di **Assets Global** (`project.assets`).
   - Jika ID ditemukan di media privat Story lain (*sibling*), resolusi **ditolak** (rejection atomik) untuk menjaga isolasi kepemilikan.

---

## 5. Publikasi Media Privat (`Publish to Assets`)

Media privat seperti voiceover dapat dipublikasikan menjadi aset global project:
- **Aksi Eksplisit:** Pengguna mengklik tombol *Publish to Assets* pada kartu Story Media.
- **Identitas Terjaga:** `assetId` dan file fisik di folder `assets/<assetId>/` tetap utuh.
- **Placements Tetap Valid:** Semua klip yang sudah merujuk `assetId` tersebut tetap berfungsi normal.
- **Undoable:** Riwayat undo/redo membatalkan publikasi dan memindahkan kembali kepemilikan ke privat, asalkan tidak ada penempatan baru di Story saudara yang bergantung padanya.

---

## 6. Normalisasi V3 Lama (Backward Compatibility)

Saat membuka file `.captr` versi V3 sebelum 10 Oktober 2026:
1. **Pemeriksaan pada Kloning (In-Memory Clone):** File asli di disk **tidak pernah dimutasi** saat operasi Open.
2. **Konversi Teks/Shape yang Sudah Ditempatkan:** Aset teks/shape global lama yang memiliki klip diterjemahkan menjadi `clip.content` inline pada setiap placement independen.
3. **Penyelamatan Aset Tak Terpakai:** Aset teks/shape lama yang belum sempat ditempatkan ke timeline dipindahkan secara otomatis ke koleksi `project.designTemplates` sehingga karya pengguna tidak hilang.
4. **Pad/Grow Handle Transisi:** Extent logis shape lama dipad/grow secara proporsional hanya jika klip memiliki transisi aktif yang membutuhkan pegangan (*handles*).
5. **Idempoten:** Menjalankan normalisasi berulang kali pada project yang sama menghasilkan state kanonikal yang identik.

---

## 7. Rujukan Terkait
- [Spesifikasi Teknis Desain](../superpowers/specs/2026-10-10-story-asset-ownership-design.md)
- [Format File Bundle .captr](project-format.md)
- [Katalog Fitur: Story Editor](../features/story-editor.md)
- [Katalog Fitur: Assets & Templates](../features/assets-templates.md)
