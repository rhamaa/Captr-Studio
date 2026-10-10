# Aturan & Spesifikasi Komposisi Hyperframe (Hyperframe Rules)

Dokumen ini merupakan referensi resmi dan spesifikasi teknis untuk pembuatan komposisi video berbasis kode (HTML5, CSS3, JavaScript, GSAP) yang disebut **Hyperframe** di Captr Studio.

> [!IMPORTANT]
> Seluruh agen AI dan pengembang yang menghasilkan template atau mengedit kode Hyperframe **wajib** mematuhi kontrak deterministik dan protokol frame-stepper yang dijelaskan di bawah ini. Template mentah lengkap tersedia di [`src/components/hyperframe/templates/HYPERFRAME_RULES.md`](../../src/components/hyperframe/templates/HYPERFRAME_RULES.md).

---

## 1. Arsitektur Komposisi Deterministik

Berbeda dengan halaman web interaktif biasa, Hyperframe adalah **komposisi video berbasis frame yang sepenuhnya deterministik**. Setiap detik dan milidetik animasi harus dapat di-*seek* secara presisi dan menghasilkan tampilan visual yang identik baik pada preview canvas maupun saat dirender frame-per-frame ke berkas MP4.

### 1.1 Elemen Root Canvas (`#root`)
Setiap berkas HTML Hyperframe wajib memiliki elemen pembungkus root dengan atribut khusus:

```html
<div id="root" data-composition-id="main" data-duration="40.9" style="width: 100%; height: 100%; position: relative; overflow: hidden;">
  <!-- Seluruh layer visual ditempatkan di sini -->
</div>
```

- `id="root"`: Titik kait utama seluruh layer visual.
- `data-composition-id="main"`: Identitas komposisi utama.
- `data-duration="<detik>"`: Durasi total komposisi dalam satuan detik (misal `40.9`).

### 1.2 Timeline Animasi GSAP Paused (`window.tl`)
Seluruh animasi visual berbasis waktu wajib dikelola melalui satu master timeline GSAP yang dalam keadaan **paused**:

```javascript
// Inisialisasi GSAP timeline paused
const tl = gsap.timeline({ paused: true });
window.tl = tl;
```

- **Dilarang keras** membiarkan timeline berjalan sendiri secara bebas (`tl.play()` dilarang kecuali saat diperintahkan oleh host via `seekFrame`).
- Setiap keyframe animasi, transisi masuk/keluar, dan efek teks ditambahkan ke `window.tl` pada timestamp absolut atau relatif.

### 1.3 Kontrak Wajib `window.seekFrame` & `window.getDuration`
Editor Captr Studio dan engine ekspor mengendalikan pemutaran video dengan memanggil fungsi global `window.seekFrame(timeInSeconds, isPlaying)`:

```javascript
window.seekFrame = function(timeInSeconds, isPlaying) {
  const duration = typeof window.getDuration === "function" ? window.getDuration() : 40.9;
  const clampedTime = Math.max(0, Math.min(duration, timeInSeconds));

  // 1. Sinkronisasi master GSAP animation timeline
  if (window.tl) {
    window.tl.seek(clampedTime);
  }

  // 2. Sinkronisasi seluruh elemen video dan audio HTML5
  const mediaElements = document.querySelectorAll("video, audio");
  mediaElements.forEach(function(el) {
    if (isPlaying) {
      if (el.paused) {
        el.play().catch(function() {});
      }
      // Koreksi jika terjadi drift waktu audio/video lebih dari 250ms
      if (Math.abs(el.currentTime - clampedTime) > 0.25) {
        el.currentTime = clampedTime;
      }
    } else {
      if (!el.paused) {
        el.pause();
      }
      // Seek presisi tinggi saat scrubber digeser saat pause
      if (Math.abs(el.currentTime - clampedTime) > 0.04) {
        el.currentTime = clampedTime;
      }
    }
  });
};

window.getDuration = function() {
  return 40.9; // Kembalikan durasi komposisi dalam detik
};
```

### 1.4 Larangan Animasi Loop Mandiri
- **Dilarang** menggunakan `requestAnimationFrame` atau `setInterval` loop yang berjalan sendiri tanpa terhubung ke `window.tl`.
- Loop mandiri yang tidak terkoordinasi akan bertabrakan dengan kontrol scrubber timeline host, menimbulkan stuttering, dan menyebabkan frame melompat saat diekspor.

---

## 2. Pipeline Media & Loopback Server Captr Studio

Captr Studio menyajikan berkas media proyek melalui server internal HTTP loopback Electron (`http://127.0.0.1:<port>/video?path=...`).

### 2.1 URL Server Loopback vs Path Lokal
- **Wajib**: Gunakan URL loopback yang disediakan melalui penandaan aset `@asset` atau peta media aktif (`PROJECT_ASSETS.json`).
- **Dilarang**: Menggunakan path absolut Windows mentah (seperti `C:\Users\...` atau `D:\...`) atau skema `file:///` di dalam elemen `<video>`, `<audio>`, atau `<img>`. Lingkungan iframe sandboxed memblokir akses berkas lokal langsung demi alasan keamanan.

### 2.2 Penanganan Port Ephemeral Dinamis
Server media Electron menggunakan port dinamis acak setiap kali aplikasi diluncurkan. Captr Studio secara otomatis melakukan pra-proses pada kode HTML Hyperframe (`preprocessHyperframeHtml`) untuk memperbarui port lama yang tersimpan menjadi port aktif sesi saat ini.

### 2.3 Companion Voiceover Audio (`*.mic.wav`)
Rekaman layar Captr Studio menyimpan suara mikrofon dalam berkas terpisah (`*.mic.wav`), bukan di dalam video MP4 layar.
- Template harus memuat elemen audio pendamping:
  ```html
  <audio id="voiceover" src="http://127.0.0.1:.../audio.wav" autoplay playsinline></audio>
  ```
- Jika template lupa menyertakannya, host Captr Studio otomatis menginjeksi elemen companion `<audio id="__captr_companion_mic">` ke dalam dokumen sebelum dirender.

### 2.4 Telemetri Kursor & Transkrip Suara
- **Kursor**: Metadata kursor disimpan di `cursor_telemetry.json` (koordinat normalisasi `x`, `y`, timestamp, tipe klik). Hyperframe dapat merender pointer mouse kustom yang mengikuti telemetri tersebut.
- **Transkrip**: Berkas `transcript.json` memuat teks transkrip kata-per-kata presisi milidetik dari Whisper STT untuk animasi kinetic typography atau karaoke subtitles.

---

## 3. Pola Layout & Komposisi Umum

1. **Browser Mockup (macOS / Windows Chrome)**:
   Membungkus rekaman layar di dalam bingkai jendela browser modern dengan kontrol dot tiga warna, bilah alamat URL, dan bayangan lembut (*drop shadow*).
2. **Picture-in-Picture (PiP) Webcam**:
   Menempatkan video webcam di sudut kanan bawah dengan border radius melengkung atau bentuk lingkaran, border halus, dan bayangan elevasi.
3. **Kinetic Typography & Counter Callouts**:
   Menampilkan kata kunci penting yang muncul secara berurutan sesuai timestamp ucapan audio.

---

## 4. Pipeline Ekspor MP4 Offscreen

Ketika pengguna menekan tombol **Export MP4** di antarmuka Hyperframe:
1. **Offscreen Chromium Frame Stepper**: Electron membuka jendela browser offscreen (`offscreen: true`) pada resolusi target (1080p, 4K, 9:16 Shorts, dll.).
2. **Frame-by-Frame Stepping**: Host memanggil `window.seekFrame(t, false)` untuk setiap interval frame (`1 / fps`), menunggu seluruh elemen media menyelesaikan `seeked`, lalu menangkap buffer mentah BGRA 32-bit via `webContents.capturePage()`.
3. **Encoding FFmpeg Hardware-Accelerated**: Buffer bitmap dialirkan langsung ke `stdin` FFmpeg untuk dikodekan dengan akselerasi perangkat keras (`h264_nvenc`, `h264_qsv`, `h264_amf`, `h264_videotoolbox`, atau fallback `libx264`).
4. **Audio Muxing**: Audio mikrofon dan sistem disatukan ke dalam kontainer MP4 akhir tanpa degradasi sinkronisasi suara.

---

## 5. Rujukan Terkait
- [Spesifikasi Master HYPERFRAME_RULES.md](../../src/components/hyperframe/templates/HYPERFRAME_RULES.md)
- [Dokumentasi Fitur Hyperframe](../features/hyperframe.md)
- [Pipeline Ekspor MP4](../plans/2026-10-07-hyperframe-mp4-export-pipeline.md)
- [Pusat Dokumentasi Ekspor Video](../features/export.md)
