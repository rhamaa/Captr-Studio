# 🎬 Motion Slide — Captr Studio

**Motion Slide** adalah modul slide animasi generasi baru di Captr Studio yang memungkinkan pembuatan video motion graphics berkualitas tinggi menggunakan standar teknologi web modern (**HTML5, CSS3, & JavaScript**).

Slide ini terintegrasi penuh ke dalam ekosistem Captr Studio, dapat digabungkan dengan **Record Slide** dan **Video Slide**, serta mendukung transisi global (Crossfade, Fade to Black, Wipe, Slide) dan ekspor video multi-slide (MP4 H.264/AAC 48kHz).

---

## 📌 Daftar Isi
1. [Arsitektur & Cara Kerja](#-arsitektur--cara-kerja)
2. [Lifecycle API: `window.setSeekTime`](#-lifecycle-api-windowsetseektime)
3. [Format & Struktur File HTML](#-format--struktur-file-html)
4. [Pola Pembuatan Animasi](#-pola-pembuatan-animasi)
   - [Pola 1: Pure CSS Keyframes](#pola-1-pure-css-keyframes)
   - [Pola 2: JS Direct Timeline Interpolation (Sangat Direkomendasikan)](#pola-2-js-direct-timeline-interpolation-sangat-direkomendasikan)
   - [Pola 3: GSAP Timeline Scrubbing](#pola-3-gsap-timeline-scrubbing)
   - [Pola 4: HTML5 Canvas 2D / WebGL](#pola-4-html5-canvas-2d--webgl)
5. [Contoh Template Bawaan (Examples)](#-contoh-template-bawaan-examples)
6. [Best Practices & Aturan Penting](#-best-practices--aturan-penting)

---

## 🏗 Arsitektur & Cara Kerja

Motion Slide beroperasi dalam dua mode:

### 1. Interactive Preview (Editor Sandbox)
- Tampilan dimuat di dalam sandbox `<iframe>` terisolasi di sisi renderer React.
- Mengirimkan event playhead scrubbing saat scrubber timeline digeser atau saat video diputar di editor.
- Fitur **Live Auto-Reload**: perubahan kode di tab HTML, CSS, atau JS langsung di-compile ulang ke preview secara instan.

### 2. Headless Frame Capture (Export Pipeline)
- Saat project diekspor ke MP4:
  1. Main Process Electron membuka hidden `BrowserWindow` khusus rendering.
  2. Dokumen HTML dimuat secara lokal.
  3. Electron melakukan iterasi frame demi frame dari `frame = 0` hingga `totalFrames` sesuai target FPS (misal: 60 FPS).
  4. Pada setiap frame, Electron menginjeksi:
     ```javascript
     window.setSeekTime(currentTimeMs, durationMs);
     ```
  5. Layar di-capture (`capturePage`) dan di-pipe ke FFmpeg sebagai MJPEG image stream.
  6. FFmpeg meng-encode hasil capture menjadi MP4 H.264 dengan audio AAC stereo 48000Hz.
  7. Video klip Motion Slide disambungkan dengan klip slide lainnya melalui filtergraph normalisasi (`stitchVideoClips`).

> **PENTING**: Karena rendering frame dieksekusi satu per satu (bukan real-time playback), animasi harus **deterministik** terhadap waktu (`timeMs`).

---

## ⚡ Lifecycle API: `window.setSeekTime`

Kontrak komunikasi utama antara Captr Studio dan kode Motion Slide Anda adalah fungsi global:

```javascript
window.setSeekTime = function(timeMs, durationMs) {
  // timeMs     : Waktu playhead saat ini dalam milidetik (misal: 2500ms)
  // durationMs : Total durasi slide dalam milidetik (misal: 5000ms)
  
  const progress = Math.min(1, Math.max(0, timeMs / Math.max(1, durationMs)));
  // progress bernilai 0.0 pada detik ke-0, dan 1.0 pada akhir slide.
};
```

### Mengapa harus `setSeekTime`?
- Saat user menggeser scrubber timeline maju-mundur, visual akan bergerak sinkron secara real-time.
- Saat ekspor ke MP4, setiap frame video yang ditangkap FFmpeg dijamin berada di posisi waktu yang presisi.

---

## 📄 Format & Struktur File HTML

Captr Studio mendukung file HTML mandiri (`.html`) lengkap yang dapat Anda buat di IDE luar (VS Code, Cursor, dll.) dan di-import via tombol **"Import File HTML"**.

Sistem parser Captr Studio ([`parseHtmlFileContent`](./components/MotionSlideWorkspace.tsx)) secara otomatis memisahkan komponen file:
- Semua isi di dalam tag `<style>...</style>` diekstrak ke tab **CSS**.
- Semua isi di dalam tag `<script>...</script>` (tanpa atribut `src`) diekstrak ke tab **JS**.
- Isi di dalam `<body>...</body>` diekstrak ke tab **HTML**.
- Tag `<link rel="stylesheet">` ke external font (seperti Google Fonts) tetap dipertahankan.

### Struktur Minimal Boilerplate

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #0f172a;
      color: #f8fafc;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .box {
      width: 200px;
      height: 200px;
      background: #6366f1;
      border-radius: 20px;
    }
  </style>
</head>
<body>
  <div class="box" id="box"></div>

  <script>
    window.setSeekTime = function(timeMs, durationMs) {
      const progress = timeMs / durationMs;
      const box = document.getElementById("box");
      if (box) {
        box.style.transform = `rotate(${progress * 360}deg) scale(${0.8 + progress * 0.4})`;
      }
    };
  </script>
</body>
</html>
```

---

## 🎨 Pola Pembuatan Animasi

### Pola 1: Pure CSS Keyframes
Cocok untuk elemen dekoratif yang berulang (floating orb, pulsing dot, background glow).

```css
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-15px); }
  100% { transform: translateY(0px); }
}

.ambient-glow {
  animation: float 4s ease-in-out infinite;
}
```

### Pola 2: JS Direct Timeline Interpolation (Sangat Direkomendasikan)
Metode paling akurat untuk ekspor video. Hitung nilai CSS atau atribut visual secara matematis menggunakan fungsi interpolasi (lerp / easing):

```javascript
// Utility easing: cubic ease-out
function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

// Linear interpolation
function lerp(start, end, t) {
  return start + (end - start) * t;
}

window.setSeekTime = function(timeMs, durationMs) {
  const p = Math.min(1, Math.max(0, timeMs / durationMs));
  const eased = easeOutCubic(p);

  // Animasi posisi Y dari 50px ke 0px
  const title = document.getElementById("title");
  if (title) {
    title.style.transform = `translateY(${lerp(50, 0, eased)}px)`;
    title.style.opacity = lerp(0, 1, eased);
  }
};
```

### Pola 3: GSAP Timeline Scrubbing
Anda dapat menggunakan library populer seperti **GSAP** melalui CDN:

```html
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
</head>
<body>
  <h1 id="headline">Captr Studio</h1>

  <script>
    // 1. Buat GSAP timeline dalam keadaan paused
    const tl = gsap.timeline({ paused: true });
    tl.from("#headline", { duration: 2, y: 100, opacity: 0, ease: "power3.out" });

    // 2. Hubungkan ke Captr Studio timeline
    window.setSeekTime = function(timeMs, durationMs) {
      const timeSec = timeMs / 1000;
      tl.seek(timeSec);
    };
  </script>
</body>
```

### Pola 4: HTML5 Canvas 2D / WebGL
Untuk grafik generatif, partikel, atau gelombang matematis:

```html
<canvas id="canvas" width="1920" height="1080"></canvas>
<script>
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  window.setSeekTime = function(timeMs, durationMs) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const progress = timeMs / durationMs;
    
    // Gambar lingkaran yang berputar sesuai waktu
    const angle = progress * Math.PI * 2;
    const x = canvas.width / 2 + Math.cos(angle) * 200;
    const y = canvas.height / 2 + Math.sin(angle) * 200;
    
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fill();
  };
</script>
```

---

## 📂 Contoh Template Bawaan (Examples)

Tersedia beberapa contoh siap pakai di direktori [`examples/`](./examples/):

| File | Deskripsi | Teknik Utama |
| :--- | :--- | :--- |
| [`01-kinetic-title-card.html`](./examples/01-kinetic-title-card.html) | Title card pembuka modern dengan glassmorphism & progress bar. | Pure CSS + JS Seek Hook |
| [`02-gsap-feature-showcase.html`](./examples/02-gsap-feature-showcase.html) | Presentasi fitur produk dengan 3D card tilt & staggered entrance. | GSAP Timeline Scrubbing |
| [`03-canvas-geometric-network.html`](./examples/03-canvas-geometric-network.html) | Jaringan partikel geometris futuristik beranimasi frame-by-frame. | HTML5 Canvas 2D Math |
| [`04-kpi-dashboard-metrics.html`](./examples/04-kpi-dashboard-metrics.html) | Dashboard analitik SaaS dengan animated counter angka & grafik SVG. | SVG Dasharray + Number Lerp |
| [`05-minimal-starter.html`](./examples/05-minimal-starter.html) | Template boilerplate bersih untuk mulai coding dari nol. | Clean Starter Template |

---

## 💡 Best Practices & Aturan Penting

1. **Gunakan Waktu Deterministik**:
   - ❌ **Hindari**: `setInterval()`, `setTimeout()`, atau `requestAnimationFrame()` yang bergantung pada waktu jam sistem (`Date.now()`). Saat ekspor video, waktu tidak berjalan real-time.
   - ✅ **Gunakan**: Parameter `timeMs` dari `window.setSeekTime(timeMs, durationMs)`.

2. **Gaya Tampilan Fullscreen**:
   - Pastikan root container mengisi viewport:
     ```css
     body {
       margin: 0;
       width: 100vw;
       height: 100vh;
       overflow: hidden;
     }
     ```

3. **Performa Rendering**:
   - Gunakan CSS hardware-accelerated properties: `transform` dan `opacity`.
   - Hindari manipulasi layout berat seperti mengubah `width`, `height`, `top`, `left` secara repetitif di setiap frame.

4. **Koneksi Internet untuk Asset**:
   - Font Google dan CDN library (GSAP, Lucide, Tailwind CDN) membutuhkan koneksi internet saat render pertama kali.
   - Untuk offline, embed SVG secara inline atau gunakan CSS base64.
