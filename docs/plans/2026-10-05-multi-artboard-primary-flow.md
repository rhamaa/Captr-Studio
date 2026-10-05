# Multi-Artboard Primary Flow & Independent Sequence Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Membalik arsitektur alur kerja (workflow) Captr Studio sehingga Multi-Artboard Board Hub menjadi tampilan utama default saat membuka project, di mana double-click pada artboard membuka Timeline Project Editor untuk mengedit sequence video tersebut secara independen dengan pustaka aset (shared asset pool) yang sama.

**Architecture:** Memperluas skema `RepurposeArtboard` dengan field opsional `tracks?: TimelineTrack[]` dan `clipTransitions?: ClipTransition[]`. Root `TimelineProject` menyimpan pustaka bersama (`assets`, `packages`), sedangkan setiap artboard bertindak sebagai sequence independen. `ProjectEditor.tsx` mengelola state `activeArtboardId: string | null`: ketika `null`, me-render Multi-Artboard Hub sebagai panggung utama; ketika berisi ID artboard, me-render Timeline Editor khusus resolusi artboard tersebut dengan sinkronisasi dua arah ke root project.

**Tech Stack:** React 19, TypeScript, Vitest, Canvas 2D / WebGL Evaluator, Phosphor Icons, Electron Desktop IPC.

---

### Task 1: Domain Modeling & Sequence Management Helpers
**Files:**
- Modify: `src/core/timeline/repurposeTypes.ts`
- Modify: `src/core/timeline/repurposeCommands.ts`
- Modify: `src/core/timeline/validation.ts`
- Test: `src/core/timeline/repurposeCommands.test.ts`

**Step 1: Tulis unit test untuk sequence helpers di `repurposeCommands.test.ts`**
- Test `getArtboardProjectView`: Mengembalikan objek `TimelineProject` dengan canvas dimension sesuai artboard dan tracks milik artboard (atau fallback ke project root).
- Test `updateArtboardProject`: Memperbarui track dan transitions milik artboard serta mempropagasi penambahan asset baru ke root project.
- Test `duplicateRepurposeArtboard`: Menduplikasi artboard beserta sequence tracks-nya.

**Step 2: Jalankan test untuk memastikan gagal (Red)**
- Run: `npx vitest run src/core/timeline/repurposeCommands.test.ts`

**Step 3: Implementasikan sequence helpers di `repurposeCommands.ts` dan tipe di `repurposeTypes.ts`**
- Tambahkan `tracks?: TimelineTrack[]` dan `clipTransitions?: ClipTransition[]` di `RepurposeArtboard`.
- Implementasikan `getArtboardProjectView`, `updateArtboardProject`, `forkArtboardSequence`, dan `duplicateRepurposeArtboard`.
- Perbarui `validation.ts` untuk memvalidasi `tracks` di dalam `artboard` jika ada.

**Step 4: Jalankan test untuk memastikan lulus (Green)**
- Run: `npx vitest run src/core/timeline/repurposeCommands.test.ts`

---

### Task 2: Per-Artboard Sequence Preview & Double-Click Interaction
**Files:**
- Modify: `src/components/repurpose/RepurposeArtboardCard.tsx`
- Modify: `src/components/repurpose/RepurposeBoardEditor.tsx`
- Modify: `src/components/editor/projectEditor.css`
- Test: `src/components/repurpose/repurposeFraming.test.ts`

**Step 1: Tambahkan event onDoubleClick & Edit Timeline button pada `RepurposeArtboardCard`**
- Prop `onOpenEditor?: () => void` pada `RepurposeArtboardCard`.
- Tambahkan handler `onDoubleClick` pada `.repurpose-card-viewport`.
- Tambahkan tombol action "Edit Timeline" pada header kartu dengan ikon `PencilSimple` atau `FilmStrip`.
- Tampilkan badge "Custom Sequence" jika artboard memiliki `tracks` sendiri.

**Step 2: Integrasikan per-artboard frame evaluation**
- Jika artboard memiliki `tracks`, kartu artboard mengevaluasi sequence-nya sendiri via `evaluateProject(artboardProjectView, timeUs)` pada renderer offscreen lokal atau master canvas yang disesuaikan.
- Jika artboard belum memiliki `tracks`, menggunakan framing crop dari master buffer seperti sebelumnya.

**Step 3: Hubungkan callback ke `RepurposeBoardEditor`**
- `RepurposeBoardEditor` menerima prop `onOpenArtboardEditor: (artboardId: string) => void`.

---

### Task 3: Inversi Alur Utama di `ProjectEditor.tsx`
**Files:**
- Modify: `src/components/editor/ProjectEditor.tsx`
- Modify: `src/components/editor/ProjectEditorPanel.tsx`
- Modify: `src/components/editor/projectEditor.css`
- Test: `src/components/editor/ProjectEditorPanel.test.tsx`
- Test: `src/components/editor/ProjectEditor.test.tsx`

**Step 1: Ubah default view di `ProjectEditor.tsx`**
- Ganti state `showRepurposeStudio` dengan `activeArtboardId: string | null = null`.
- Default saat membuka project adalah `activeArtboardId === null` (Multi-Artboard Hub).
- Saat `activeArtboardId === null`, tampilkan `RepurposeBoardEditor` sebagai tampilan utama dengan integrasi penuh topbar project (File menu, Undo/Redo, Title rename, Save, Add Artboard, Batch Export).

**Step 2: Masuk ke Individual Project Editor saat Artboard di-double click**
- Ketika user melakukan double-click pada artboard: `setActiveArtboardId(artboard.id)`.
- Timeline Project Editor aktif untuk sequence artboard tersebut:
  - Header menampilkan breadcrumb: `[← All Artboards] / [Project Name] / [Artboard Name]`.
  - Tombol `← Artboards` (atau shortcut `Esc`) mengembalikan user ke Multi-Artboard Hub (`setActiveArtboardId(null)`).
  - Canvas preview menggunakan resolusi artboard (`artboard.width × artboard.height`).
  - Timeline mengedit `artboard.tracks`.
  - Asset library tetap berbagi semua aset dari `project.assets` dan `project.packages`.

---

### Task 4: Integrasi Batch Exporter dengan Sequence Artboard Independen
**Files:**
- Modify: `src/lib/exporter/timelineProjectExporter.ts`
- Modify: `src/components/repurpose/RepurposeBatchExportDialog.tsx`
- Test: `src/lib/exporter/timelineProjectExporter.test.ts`
- Test: `src/components/repurpose/RepurposeBatchExportDialog.test.tsx`

**Step 1: Tulis unit test untuk export artboard dengan custom sequence tracks**
- Verifikasi `TimelineProjectExporter` merender sequence tracks artboard jika ada, dengan resolusi artboard target.

**Step 2: Update exporter dan dialog batch**
- Exporter mengekspor sequence unik artboard jika `artboard.tracks` terisi, atau framing crop jika `artboard.tracks` tidak terisi.
- Dialog menampilkan indikasi jika artboard memiliki sequence khusus.

---

### Task 5: Regression Testing, Biome Linter, dan Dokumentasi
**Files:**
- Modify: `ISSUE.md`
- Run: `npx tsc --noEmit`
- Run: `npx @biomejs/biome check --write`
- Run: `npm test -- src/core/timeline/ src/components/repurpose/ src/components/editor/ src/lib/exporter/`
- Run: `npx graft build`
