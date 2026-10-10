# Referensi API Host Ekstensi (Extensions API Reference)

Dokumen ini adalah spesifikasi teknis lengkap untuk sistem ekstensi di **Captr Studio**. Sistem ini memungkinkan pengembang membuat modul renderer yang dapat menyematkan hook ke pipeline render video, menambahkan efek kursor, mendaftarkan panel UI pengaturan, menyediakan aset (bingkai perangkat, wallpaper, efek suara), serta merespons peristiwa pemutaran timeline.

> [!NOTE]
> **Catatan Kontrak Runtime Historis:**
> Demi menjaga kompatibilitas runtime modul dan loader yang sudah ada, manifes berkas tetap menggunakan nama `recordly-extension.json` serta antarmuka modul mengekspor `RecordlyExtensionAPI` dan `RecordlyExtensionModule`. Jangan mengganti nama-nama simbol runtime ini karena merupakan kontrak internal loader.

---

## 1. Arsitektur Host Ekstensi

- **Lingkungan Eksekusi**: Ekstensi dieksekusi di dalam proses renderer browser/Electron yang terisolasi.
- **Permission-Gated**: Ekstensi hanya dapat mengakses API yang secara eksplisit dinyatakan pada properti `permissions` dalam manifesnya.
- **Siklus Hidup**: Modul memuat metode `activate(api)` saat diaktifkan, dan membersihkan seluruh listener/hook melalui fungsi dispose atau `deactivate()`.

---

## 2. Manifes Ekstensi (`recordly-extension.json`)

Setiap ekstensi wajib memiliki berkas manifes `recordly-extension.json` di direktori akarnya:

```json
{
  "id": "com.example.cursor-sparkles",
  "name": "Cursor Sparkles Effect",
  "version": "1.0.0",
  "description": "Menambahkan efek partikel berkilau di sekitar kursor saat klik dan gerak.",
  "author": "Captr Studio Community",
  "license": "MIT",
  "main": "index.js",
  "icon": "icon.png",
  "permissions": [
    "render",
    "cursor",
    "ui"
  ],
  "contributes": {
    "sounds": [
      {
        "id": "sparkle-pop",
        "label": "Sparkle Pop",
        "category": "click",
        "file": "sounds/pop.wav"
      }
    ]
  }
}
```

### Daftar Izin Akses (`permissions`)

| Izin | Deskripsi |
|---|---|
| `"render"` | Menyematkan hook ke pipeline penggambaran frame video canvas. |
| `"cursor"` | Mengakses data telemetri kursor dan mendaftarkan efek klik. |
| `"audio"` | Memutar efek suara bawaan ekstensi atau memanipulasi audio. |
| `"timeline"` | Mengamati peristiwa timeline (region added, removed, playback time). |
| `"ui"` | Mendaftarkan panel pengaturan kustom di inspector/settings dialog. |
| `"assets"` | Menyelesaikan path relatif aset berkas lokal (`resolveAsset`). |
| `"export"` | Mendengarkan peristiwa siklus hidup ekspor (`export:start`, `export:frame`, `export:complete`). |

---

## 3. Siklus Hidup Modul (`RecordlyExtensionModule`)

Berkas utama (`main`, misal `index.js`) wajib mengekspor objek yang memenuhi kontrak `RecordlyExtensionModule`:

```javascript
/**
 * @type {import('...').RecordlyExtensionModule}
 */
export default {
  activate(api) {
    api.log("Ekstensi berhasil diaktifkan!");

    // Daftarkan render hook
    const unregister = api.registerRenderHook("post-cursor", (ctx) => {
      if (!ctx.cursor) return;
      ctx.ctx.save();
      ctx.ctx.fillStyle = "rgba(255, 215, 0, 0.6)";
      ctx.ctx.beginPath();
      ctx.ctx.arc(ctx.cursor.cx * ctx.width, ctx.cursor.cy * ctx.height, 12, 0, Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.restore();
    });

    // Simpan disposer jika diperlukan saat deactivate
  },

  deactivate() {
    // Bersihkan listener atau resource yang menggantung
  }
};
```

---

## 4. Render Hooks API (`registerRenderHook`)

Metode `api.registerRenderHook(phase, hook)` memungkinkan ekstensi menggambar langsung pada `CanvasRenderingContext2D` pada setiap frame video.

### Fase Render (`RenderHookPhase`)

1. `"background"`: Dieksekusi sebelum frame video digambar (untuk latar belakang dinamis / canvas art).
2. `"post-video"`: Setelah frame video mentah digambar, sebelum transformasi zoom diterapkan.
3. `"post-zoom"`: Setelah transformasi zoom diterapkan.
4. `"post-cursor"`: Setelah kursor bawaan digambar (lokasi ideal untuk trails, particles, click sparkles).
5. `"post-webcam"`: Setelah overlay webcam picture-in-picture digambar.
6. `"post-annotations"`: Setelah shape dan anotasi digambar.
7. `"final"`: Pass terakhir (untuk watermark, timecode HUD kustom, atau border frame luar).

### Konteks Hook Render (`RenderHookContext`)

Objek `ctx` yang diterima fungsi hook memuat:
- `width`, `height`: Dimensi kanvas output (piksel).
- `timeMs`, `durationMs`: Waktu playhead aktif dan total durasi rekaman (milidetik).
- `cursor`: Posisi kursor ternormalisasi `{ cx: 0..1, cy: 0..1, interactionType }` atau `null`.
- `smoothedCursor`: Objek kursor yang telah diperhalus beserta riwayat jejak `trail`.
- `ctx`: Objek `CanvasRenderingContext2D` kanvas aktif.
- `videoLayout`: Posisi dan ukuran kotak video termasker (`maskRect`, `borderRadius`, `padding`).
- `zoom`: Skala zoom aktif, titik fokus (`focusX`, `focusY`), dan progres interpolasi.
- `sceneTransform`: Offset dan skala transformasi animasi pemandangan (`scale`, `x`, `y`).
- **Helper Warna Piksel**:
  - `getPixelColor(x, y)`: Nilai RGBA piksel tertentu.
  - `getAverageSceneColor()`: Rata-rata warna video untuk adaptasi warna dinamis.
  - `getEdgeAverageColor(edgeWidth)`: Rata-rata warna tepi video untuk pencocokan wallpaper.

---

## 5. Efek Kursor & Telemetri

```javascript
// Mendaftarkan animasi efek klik interaktif
api.registerCursorEffect((ctx) => {
  // ctx.elapsedMs: milidetik sejak interaksi terjadi
  // Kembalikan false saat animasi selesai untuk menghentikan loop
  if (ctx.elapsedMs > 500) return false;

  const progress = ctx.elapsedMs / 500;
  const radius = progress * 30;
  const opacity = 1 - progress;

  ctx.ctx.save();
  ctx.ctx.strokeStyle = `rgba(111, 168, 255, ${opacity})`;
  ctx.ctx.lineWidth = 3;
  ctx.ctx.beginPath();
  ctx.ctx.arc(ctx.cx * ctx.width, ctx.cy * ctx.height, radius, 0, Math.PI * 2);
  ctx.ctx.stroke();
  ctx.ctx.restore();

  return true; // Lanjutkan animasi
});
```

---

## 6. Panel Pengaturan UI (`registerSettingsPanel`)

Ekstensi dapat menambahkan antarmuka pengaturan yang terintegrasi langsung ke sidebar pengaturan aplikasi:

```javascript
api.registerSettingsPanel({
  id: "sparkles-settings",
  label: "Pengaturan Sparkles",
  icon: "Sparkle",
  parentSection: "cursor", // Sisipkan di bawah grup kursor bawaan
  fields: [
    {
      id: "enabled",
      label: "Aktifkan Efek",
      type: "toggle",
      defaultValue: true
    },
    {
      id: "particleCount",
      label: "Jumlah Partikel",
      type: "slider",
      min: 5,
      max: 50,
      step: 1,
      defaultValue: 20
    },
    {
      id: "sparkleColor",
      label: "Warna Kilau",
      type: "color",
      defaultValue: "#FFD700"
    }
  ]
});

// Mendengarkan perubahan konfigurasi pengguna
api.onSettingChange((settingId, newValue) => {
  api.log(`Setting ${settingId} diubah menjadi:`, newValue);
});
```

---

## 7. Query State & Pembacaan Data Proyek

Ekstensi dapat membaca status pemutaran dan metadata proyek (Read-Only):

```javascript
const videoInfo = api.getVideoInfo(); 
// { width: 1920, height: 1080, durationMs: 45000, fps: 60 }

const playback = api.getPlaybackState();
// { currentTimeMs: 12400, durationMs: 45000, isPlaying: true }

const cursorAt5s = api.getCursorAt(5000);
// { cx: 0.45, cy: 0.62, timeMs: 5000, interactionType: "click" }

const keystrokes = api.getKeystrokesInRange(1000, 3000);
// Array penekanan tombol keyboard yang tercatat di rentang waktu tersebut
```

---

## 8. Batas Keamanan & Isolasi (Security Guidelines)

1. **Isolasi Mutasi Story**:
   - Host ekstensi saat ini menyediakan akses hook rendering visual dan telemetry query. Ekstensi **tidak diizinkan** melakukan mutasi destruktif langsung pada struktur data `project.json` atau menghapus klip tanpa melalui protokol perintah resmi.
2. **Tanpa Node.js Arbitrer**:
   - Skrip ekstensi berjalan di sandbox renderer browser. Pemanggilan modul sistem operasi mentah (`fs`, `child_process`) dilarang secara default demi keamanan data pengguna.
3. **Pembersihan Resource**:
   - Setiap fungsi registrasi (`registerRenderHook`, `on`, dll.) mengembalikan fungsi unregister. Selalu bersihkan resource untuk menghindari kebocoran memori saat ekstensi dinonaktifkan.

---

## 9. Rujukan Terkait
- [Dokumentasi Fitur Ekstensi](../features/extensions.md)
- [Pedoman Setup Lingkungan Pengembang](setup.md)
- [Pedoman Berkontribusi](contributing.md)
