# Hyperframe Master Specification & Best Practices (Captr Studio Edition)

> **Authority:** This document is the authoritative, comprehensive guide for creating HTML5/CSS/JavaScript video compositions ("Hyperframes") in Captr Studio. It synthesizes the official HeyGen HyperFrames specifications, adapted specifically for the desktop runtime, media pipeline, and aesthetic system of Captr Studio.
>
> All AI coding agents generating or refining Hyperframe compositions MUST strictly adhere to the contracts, patterns, and code recipes defined in this guide.

---

## 1. Core Architecture & Mandatory Contracts

Every Hyperframe is an offline-capable, standalone HTML5 document evaluated inside a sandboxed browser environment. Unlike standard web pages, a Hyperframe is a **frame-accurate, deterministic video composition**.

### 1.1 The `#root` Canvas Container
The composition MUST be enclosed in a top-level container with the following required attributes:
```html
<div id="root" data-composition-id="main" data-duration="40.9" style="width: 100%; height: 100%; position: relative; overflow: hidden;">
  <!-- Composition content here -->
</div>
```
- `id="root"`: The primary mounting root for all visual layers.
- `data-composition-id="main"`: Identifies the root composition.
- `data-duration="<seconds>"`: The exact duration of the composition in seconds (must match the requested project/media duration, e.g., `40.9`).

### 1.2 The Paused GSAP Timeline
All visual animations MUST be orchestrated on a single, paused GSAP timeline bound to the global window:
```javascript
// Load GSAP (included via CDN or offline bundle)
const tl = gsap.timeline({ paused: true });
window.tl = tl;
```
- **Never** let the timeline play freely on its own (`tl.play()` is forbidden unless driven by `seekFrame`).
- Every animation keyframe, stagger, and transition must be added to `window.tl` at an absolute or relative timestamp along the timeline.

### 1.3 The Mandatory `window.seekFrame` Contract
Captr Studio's editor timeline and export pipeline control playback by calling `window.seekFrame(timeInSeconds, isPlaying)`. Every Hyperframe MUST implement this function:

```javascript
window.seekFrame = function(timeInSeconds, isPlaying) {
  const duration = typeof window.getDuration === "function" ? window.getDuration() : 40.9;
  const clampedTime = Math.max(0, Math.min(duration, timeInSeconds));

  // 1. Seek the master GSAP animation timeline
  if (window.tl) {
    window.tl.seek(clampedTime);
  }

  // 2. Synchronize all video and audio elements
  const mediaElements = document.querySelectorAll("video, audio");
  mediaElements.forEach(function(el) {
    if (isPlaying) {
      if (el.paused) {
        el.play().catch(function() {});
      }
      // Re-sync if media drifted more than 250ms
      if (Math.abs(el.currentTime - clampedTime) > 0.25) {
        el.currentTime = clampedTime;
      }
    } else {
      if (!el.paused) {
        el.pause();
      }
      // Precise seek when scrubbing while paused
      if (Math.abs(el.currentTime - clampedTime) > 0.04) {
        el.currentTime = clampedTime;
      }
    }
  });
};

window.getDuration = function() {
  return 40.9; // Return the exact composition duration
};
```

### 1.4 Strict Ban on Self-Running Loops
- **DO NOT** use unmanaged `requestAnimationFrame` animation loops or `setInterval` tickers that update transforms or opacity.
- Self-running loops actively fight the host editor scrubber and cause frame stuttering, jitter, and desynchronization.
- All time-based changes MUST be expressed via `window.tl` (GSAP) or synchronized inside `window.seekFrame`.

---

## 2. Captr Studio Media & Asset Pipeline

Captr Studio captures and stores high-fidelity screen recordings, webcam overlays, audio tracks, cursor telemetry, and speech transcripts. You MUST handle each media type according to these contracts.

### 2.1 Always Use Media Server Loopback URLs
- Captr Studio serves project media through an internal loopback HTTP server:
  `http://127.0.0.1:<port>/video?path=...`
- **NEVER** use raw local Windows paths (e.g. `C:\Users\...` or `D:\...`) or `file:///` URLs in `<video>`, `<audio>`, or `<img>` elements. Browsers and sandboxed iframes block local file access for security reasons.
- Always use the URL provided in the `@asset` metadata or `PROJECT_ASSETS.json`.

### 2.2 Screen Recordings: Live Continuous Video
- Screen recordings MUST be embedded as real, live `<video>` elements:
  ```html
  <video id="screen-video" src="http://127.0.0.1:..." autoplay loop playsinline muted></video>
  ```
- **NEVER** replace a video recording with a static screenshot, canvas freeze-frame, or placeholder image.
- Preserve video aspect ratio: screen recordings are typically 16:9. Use `object-fit: contain` or `object-fit: cover` with proper padding so UI elements are not cropped out.

### 2.3 Companion Microphone Voiceover Audio (CRITICAL)
- **Essential Reality:** In Captr Studio, screen recording `.mp4` video files **DO NOT** contain microphone audio!
- Microphone audio is recorded into a separate companion audio track (e.g., `*.mic.wav`).
- Whenever a screen recording or audio asset is present, you **MUST** embed a dedicated `<audio>` element with a unique ID:
  ```html
  <audio id="voiceover" src="http://127.0.0.1:...mic.wav" preload="auto" data-start="0" data-duration="40.9"></audio>
  ```
- If system audio is also present:
  ```html
  <audio id="system-audio" src="http://127.0.0.1:...system.wav" preload="auto" data-start="0" data-duration="40.9"></audio>
  ```
- The `<audio>` element must be unmuted (do NOT add `muted`) so the speaker's voice is audible during preview playback and export.

### 2.4 Webcam Overlay: Picture-in-Picture (PiP)
- When a webcam track is available, embed it as a secondary `<video>` element styled as a sleek floating PiP badge:
  ```html
  <div class="webcam-container">
    <video id="webcam-video" src="http://127.0.0.1:...webcam.mp4" autoplay loop playsinline muted></video>
  </div>
  ```
- Recommended styling: Circular (`border-radius: 50%`) or rounded square (`border-radius: 20px`), placed in the bottom-right or bottom-left corner with a subtle border and soft glow shadow.

### 2.5 Mouse Cursor Telemetry (`cursor_telemetry.json`)
- If cursor telemetry is provided in the workspace, you can animate a custom cursor pointer or visual ripple on user clicks:
  ```html
  <div id="custom-cursor" class="cursor-pointer">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 4L11 20L13.5 13.5L20 11L4 4Z" fill="#A879F5" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>
    </svg>
    <div class="click-ripple"></div>
  </div>
  ```
- Coordinate mapping: Screen coordinates (`cx`, `cy`) are normalized to `0..1` or relative to the screen video dimensions.

### 2.6 Speech Transcript & Kinetic Subtitles (`transcript.json`)
- When `transcript.json` is provided, animate kinetic subtitles or karaoke word highlights synced to the speaker's speech:
  - Each word or sentence has `startMs` and `endMs`.
  - Add animations to `window.tl` at `timeInSeconds = startMs / 1000`.

---

## 3. Layout Patterns & Staging

Choose from these standard layout patterns depending on the user's prompt:

### Pattern A: macOS Browser / Software Window Mockup (Recommended for Tutorials)
Wraps the screen recording inside an elegant modern window with window controls, subtle border, and soft elevation:
```html
<div class="mac-window">
  <div class="mac-titlebar">
    <div class="traffic-lights">
      <span class="dot close"></span>
      <span class="dot minimize"></span>
      <span class="dot zoom"></span>
    </div>
    <div class="address-bar">captr.studio/demo</div>
    <div class="spacer"></div>
  </div>
  <div class="mac-content">
    <video id="screen-video" src="..." autoplay loop playsinline muted></video>
  </div>
</div>
```
```css
.mac-window {
  width: 90%;
  max-width: 1600px;
  background: #1A1D26;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45), 0 0 40px rgba(168, 121, 245, 0.12);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.mac-titlebar {
  height: 40px;
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.traffic-lights { display: flex; gap: 8px; }
.traffic-lights .dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
.traffic-lights .dot.close { background: #FF5F56; }
.traffic-lights .dot.minimize { background: #FFBD2E; }
.traffic-lights .dot.zoom { background: #27C93F; }
.address-bar {
  flex: 1;
  max-width: 380px;
  margin: 0 auto;
  height: 24px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.2px;
}
.mac-content {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  overflow: hidden;
}
.mac-content video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

### Pattern B: Circular Webcam Picture-in-Picture (PiP)
```css
.webcam-pip-container {
  position: absolute;
  bottom: 40px;
  right: 48px;
  width: 190px;
  height: 190px;
  border-radius: 50%;
  border: 3px solid #A879F5;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 24px rgba(168, 121, 245, 0.4);
  overflow: hidden;
  z-index: 50;
  background: #161922;
}
.webcam-pip-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### Pattern C: Split-Screen Feature Showcase
Screen recording on the left (60% width), animated bullet points, stats, and kinetic cards on the right (40% width):
```html
<div class="split-stage">
  <div class="split-media">
    <!-- Screen Video or Browser Mockup -->
  </div>
  <div class="split-info">
    <div class="badge">Feature Spotlight</div>
    <h2 class="title">Smart Noise Cancellation</h2>
    <div class="bullet-list">
      <div class="bullet-item"><span class="bullet-icon">✦</span> Zero latency audio engine</div>
      <div class="bullet-item"><span class="bullet-icon">✦</span> Automatic voice isolation</div>
      <div class="bullet-item"><span class="bullet-icon">✦</span> Crystal-clear output</div>
    </div>
  </div>
</div>
```

---

## 4. Kinetic Typography, Badges & Motion Library

### 4.1 Word-by-Word Karaoke Subtitles
Subtitle lines are split into `<span>` words, animated sequentially with a bright pastel color pop:
```html
<div class="caption-container">
  <div class="caption-line" id="caption-box">
    <span class="c-word">Welcome</span>
    <span class="c-word">to</span>
    <span class="c-word">Captr</span>
    <span class="c-word">Studio</span>
  </div>
</div>
```
```css
.caption-container {
  position: absolute;
  bottom: 60px;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  z-index: 60;
  pointer-events: none;
}
.caption-line {
  background: rgba(15, 17, 23, 0.85);
  backdrop-filter: blur(12px);
  padding: 12px 28px;
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 26px;
  font-weight: 700;
  color: #FFFFFF;
}
.c-word {
  display: inline-block;
  margin: 0 4px;
  opacity: 0.35;
  transition: opacity 0.15s, color 0.15s, transform 0.15s;
}
.c-word.active {
  opacity: 1;
  color: #F6C768; /* Honey Amber highlight */
  transform: scale(1.08);
}
```

```javascript
// Synchronize captions via GSAP timeline:
tl.to("#caption-box .c-word:nth-child(1)", { opacity: 1, color: "#F6C768", scale: 1.08, duration: 0.2 }, 0.4);
tl.to("#caption-box .c-word:nth-child(2)", { opacity: 1, color: "#F6C768", scale: 1.08, duration: 0.2 }, 0.8);
tl.to("#caption-box .c-word:nth-child(3)", { opacity: 1, color: "#6FA8FF", scale: 1.12, duration: 0.3 }, 1.1);
tl.to("#caption-box .c-word:nth-child(4)", { opacity: 1, color: "#A879F5", scale: 1.15, duration: 0.3 }, 1.5);
```

### 4.2 Animated Stat Counters
For displaying performance metrics, conversion counts, or download numbers:
```javascript
const statObj = { val: 0 };
tl.to(statObj, {
  val: 98,
  duration: 1.5,
  ease: "power2.out",
  onUpdate: function() {
    const el = document.getElementById("stat-number");
    if (el) el.innerText = Math.round(statObj.val) + "%";
  }
}, 0.5);
```

### 4.3 Staggered Pill Badges & Feature Cards
```javascript
tl.from(".feature-card", {
  y: 40,
  opacity: 0,
  scale: 0.95,
  duration: 0.6,
  stagger: 0.15,
  ease: "back.out(1.4)"
}, 0.8);
```

---

## 5. Design System: Captr Studio Pastel Aesthetic

Captr Studio uses a refined, modern dark canvas paired with soft pastel accent tones. Avoid radioactive, harsh neon colors.

### 5.1 Color Palette
- **Canvas Base:** `#0F1117` (Deep Obsidian), `#161922` (Dark Slate)
- **Soft Blue:** `#6FA8FF` (Primary highlights, links, progress)
- **Lavender Purple:** `#A879F5` (Creative accents, webcam borders, hero titles)
- **Sage Mint:** `#8DDB9B` (Success badges, positive stats, completed states)
- **Honey Amber:** `#F6C768` (Active karaoke words, spotlight callouts, stars)
- **Coral Rose:** `#FF6B81` (Action alerts, close buttons, warm badges)
- **Card Background:** `rgba(255, 255, 255, 0.05)` with `backdrop-filter: blur(16px)`
- **Card Border:** `rgba(255, 255, 255, 0.08)` to `rgba(255, 255, 255, 0.15)`

### 5.2 Typography
- Use clean, highly legible system font stacks:
  `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;`
- Title headings: 700 to 800 weight, tight letter spacing (`-0.03em`), line height `1.15`.
- Subtitles & Body: 400 to 500 weight, clean line height `1.5`.

### 5.3 Motion Curves & Easing
- **Entrance:** `power3.out` or `back.out(1.4)` (gives a clean, crisp arrival without excessive wobble).
- **Exit:** `power2.in` or `power3.in` (swift and decisive).
- **Smooth Scrub:** Always use standard easing curves on `window.tl`. Never leave scrubbed transitions without duration.

---

## 6. Complete Reference Recipes (Copy-Paste Ready)

### Recipe A: Software Demo / Screen & Webcam with Voiceover & Captions
This recipe is the gold standard for software demos, tutorials, and walkthroughs:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Software Walkthrough</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: #0F1117; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #root {
      width: 100%; height: 100%; position: relative;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: radial-gradient(circle at 50% 20%, #1E2230 0%, #0F1117 100%);
      color: #FFFFFF;
    }
    .header-bar {
      position: absolute; top: 32px; left: 48px; right: 48px;
      display: flex; justify-content: space-between; align-items: center; z-index: 20;
    }
    .badge {
      background: rgba(168, 121, 245, 0.15); border: 1px solid rgba(168, 121, 245, 0.35);
      color: #A879F5; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;
      letter-spacing: 0.5px; text-transform: uppercase;
    }
    .title-banner { font-size: 28px; font-weight: 700; color: #FFFFFF; }
    
    .window-stage {
      width: 82%; max-width: 1500px; aspect-ratio: 16 / 9.5;
      background: #161922; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6), 0 0 50px rgba(111, 168, 255, 0.12);
      display: flex; flex-direction: column; overflow: hidden; position: relative; z-index: 10;
    }
    .window-bar {
      height: 42px; background: rgba(255, 255, 255, 0.04);
      display: flex; align-items: center; padding: 0 16px; gap: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .dots { display: flex; gap: 8px; }
    .dots span { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    .dot-r { background: #FF5F56; } .dot-y { background: #FFBD2E; } .dot-g { background: #27C93F; }
    .url-pill {
      flex: 1; max-width: 340px; margin: 0 auto; height: 24px;
      background: rgba(255, 255, 255, 0.06); border-radius: 6px;
      font-size: 11px; color: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center;
    }
    
    .screen-container { position: relative; flex: 1; width: 100%; background: #000; overflow: hidden; }
    #screen-vid { width: 100%; height: 100%; object-fit: contain; display: block; }
    
    .pip-cam {
      position: absolute; bottom: 48px; right: 64px; width: 180px; height: 180px;
      border-radius: 50%; border: 3px solid #A879F5;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(168, 121, 245, 0.4);
      overflow: hidden; z-index: 30; background: #161922;
    }
    #cam-vid { width: 100%; height: 100%; object-fit: cover; }
    
    .captions-wrap {
      position: absolute; bottom: 36px; left: 0; width: 100%;
      display: flex; justify-content: center; z-index: 40; pointer-events: none;
    }
    .caption-bubble {
      background: rgba(15, 17, 23, 0.88); backdrop-filter: blur(16px);
      padding: 12px 28px; border-radius: 30px; border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); font-size: 24px; font-weight: 700; color: #FFF;
    }
    .word { display: inline-block; margin: 0 4px; opacity: 0.3; transition: all 0.2s; }
    .word.active { opacity: 1; color: #F6C768; transform: scale(1.08); }
  </style>
</head>
<body>
  <div id="root" data-composition-id="main" data-duration="40.9">
    <div class="header-bar">
      <div class="badge">Captr Studio Walkthrough</div>
      <div class="title-banner">Workspace Overview</div>
    </div>
    
    <div class="window-stage" id="main-stage">
      <div class="window-bar">
        <div class="dots"><span class="dot-r"></span><span class="dot-y"></span><span class="dot-g"></span></div>
        <div class="url-pill">app.captr.studio/workspace</div>
      </div>
      <div class="screen-container">
        <!-- Live screen recording video -->
        <video id="screen-vid" src="http://127.0.0.1:62733/video?path=recording.mp4" autoplay loop playsinline muted></video>
      </div>
    </div>
    
    <!-- Floating Webcam PiP -->
    <div class="pip-cam" id="pip-container">
      <video id="cam-vid" src="http://127.0.0.1:62733/video?path=webcam.mp4" autoplay loop playsinline muted></video>
    </div>
    
    <!-- Kinetic Captions -->
    <div class="captions-wrap">
      <div class="caption-bubble" id="caption-strip">
        <span class="word w1">Now</span>
        <span class="word w2">let's</span>
        <span class="word w3">explore</span>
        <span class="word w4">the</span>
        <span class="word w5">interactive</span>
        <span class="word w6">timeline.</span>
      </div>
    </div>
    
    <!-- Companion Microphone Voice Audio (MANDATORY in Captr Studio) -->
    <audio id="voiceover" src="http://127.0.0.1:62733/video?path=audio.mic.wav" preload="auto" data-start="0" data-duration="40.9"></audio>
  </div>

  <script>
    const DURATION = 40.9;
    const tl = gsap.timeline({ paused: true });
    window.tl = tl;

    // Orchestrate Entrance Animations
    tl.from("#main-stage", { scale: 0.92, y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, 0);
    tl.from("#pip-container", { scale: 0.4, opacity: 0, duration: 0.7, ease: "back.out(1.5)" }, 0.4);
    tl.from(".header-bar", { y: -20, opacity: 0, duration: 0.6, ease: "power2.out" }, 0.2);

    // Orchestrate Kinetic Caption Highlights
    tl.to(".w1", { opacity: 1, color: "#F6C768", scale: 1.08, duration: 0.2 }, 0.6);
    tl.to(".w2", { opacity: 1, color: "#F6C768", scale: 1.08, duration: 0.2 }, 0.9);
    tl.to(".w3", { opacity: 1, color: "#6FA8FF", scale: 1.12, duration: 0.3 }, 1.2);
    tl.to(".w4", { opacity: 1, color: "#6FA8FF", scale: 1.08, duration: 0.2 }, 1.5);
    tl.to(".w5", { opacity: 1, color: "#A879F5", scale: 1.15, duration: 0.35 }, 1.8);
    tl.to(".w6", { opacity: 1, color: "#8DDB9B", scale: 1.15, duration: 0.35 }, 2.2);

    // Subtle breathing/floating motion for PiP
    tl.to("#pip-container", { y: -6, duration: 2.5, yoyo: true, repeat: -1, ease: "sine.inOut" }, 1.0);

    // Host Transport Scrubber Contract
    window.seekFrame = function(timeInSeconds, isPlaying) {
      const clampedTime = Math.max(0, Math.min(DURATION, timeInSeconds));
      if (window.tl) window.tl.seek(clampedTime);
      
      const media = document.querySelectorAll("video, audio");
      media.forEach(function(el) {
        if (isPlaying) {
          if (el.paused) el.play().catch(function() {});
          if (Math.abs(el.currentTime - clampedTime) > 0.25) el.currentTime = clampedTime;
        } else {
          if (!el.paused) el.pause();
          if (Math.abs(el.currentTime - clampedTime) > 0.04) el.currentTime = clampedTime;
        }
      });
    };

    window.getDuration = function() { return DURATION; };
  </script>
</body>
</html>
```

---

### Recipe B: High-Energy Kinetic Typography & Stat Card Showcase
Ideal for social media hooks, product announcements, and motion graphic intros:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kinetic Feature Launch</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: #0F1117; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #FFF; }
    #root {
      width: 100%; height: 100%; position: relative;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: radial-gradient(circle at 50% 30%, #1A1F30 0%, #0F1117 100%);
    }
    .hero-badge {
      background: rgba(111, 168, 255, 0.15); border: 1px solid rgba(111, 168, 255, 0.35);
      color: #6FA8FF; padding: 8px 24px; border-radius: 30px; font-size: 15px; font-weight: 700;
      letter-spacing: 1px; text-transform: uppercase; margin-bottom: 24px;
    }
    .hero-title {
      font-size: 72px; font-weight: 800; line-height: 1.1; text-align: center; max-width: 1000px;
      letter-spacing: -1.5px; margin-bottom: 36px;
    }
    .hero-title .highlight {
      background: linear-gradient(135deg, #6FA8FF 0%, #A879F5 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .cards-row { display: flex; gap: 24px; margin-top: 16px; }
    .stat-card {
      background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(20px); border-radius: 20px; padding: 32px 40px; min-width: 260px;
      text-align: center; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
    }
    .stat-num { font-size: 54px; font-weight: 800; color: #8DDB9B; margin-bottom: 8px; }
    .stat-label { font-size: 15px; color: rgba(255, 255, 255, 0.6); font-weight: 500; }
  </style>
</head>
<body>
  <div id="root" data-composition-id="main" data-duration="15.0">
    <div class="hero-badge" id="badge">Next Generation Export</div>
    <h1 class="hero-title" id="title">
      Render Video at <span class="highlight">10x Speed</span> with Zero Lag
    </h1>
    <div class="cards-row" id="cards">
      <div class="stat-card">
        <div class="stat-num" id="s1">10x</div>
        <div class="stat-label">Faster Render Pipeline</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" id="s2">60fps</div>
        <div class="stat-label">Silky Smooth Playback</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" id="s3">100%</div>
        <div class="stat-label">Offline & Private</div>
      </div>
    </div>
  </div>

  <script>
    const DURATION = 15.0;
    const tl = gsap.timeline({ paused: true });
    window.tl = tl;

    tl.from("#badge", { scale: 0.8, opacity: 0, duration: 0.5, ease: "back.out(1.6)" }, 0.2);
    tl.from("#title", { y: 40, opacity: 0, duration: 0.8, ease: "power3.out" }, 0.4);
    tl.from(".stat-card", { y: 50, opacity: 0, scale: 0.9, duration: 0.6, stagger: 0.15, ease: "back.out(1.4)" }, 0.8);

    window.seekFrame = function(timeInSeconds, isPlaying) {
      const clamped = Math.max(0, Math.min(DURATION, timeInSeconds));
      if (window.tl) window.tl.seek(clamped);
    };

    window.getDuration = function() { return DURATION; };
  </script>
</body>
</html>
```

---

## 7. Quality Checklist & Anti-Patterns to Avoid

Before finalizing any Hyperframe HTML composition, check off every point:

- [ ] **Exact Duration:** The root container has `data-duration="${durationSec}"` matching the requested timeline, NOT clamped to 5s.
- [ ] **Live Playing Video:** Screen recordings and webcams are `<video>` tags with `autoplay loop playsinline muted`, NEVER static screenshots.
- [ ] **Audio Voiceover Embedded:** If a microphone track or audio asset exists, `<audio id="voiceover" src="..." preload="auto">` is included and UNMUTED.
- [ ] **Valid Media Server URLs:** All media URLs use `http://127.0.0.1:<port>/...`, NEVER `C:\...` or `file:///`.
- [ ] **Paused GSAP Timeline:** `const tl = gsap.timeline({ paused: true }); window.tl = tl;` is defined.
- [ ] **Implemented `seekFrame`:** `window.seekFrame(timeInSeconds, isPlaying)` syncs both `window.tl` and all `<video>` / `<audio>` elements.
- [ ] **No Self-Running Loops:** No unmanaged `requestAnimationFrame` or `setInterval` loops fighting the host scrubber.
- [ ] **Pastel Palette:** Colors match Captr Studio soft pastels (`#6FA8FF`, `#A879F5`, `#8DDB9B`, `#F6C768`, `#FF6B81`).
- [ ] **Clean Layout:** Screen recording is placed inside an elegant container or mockup with `object-fit: contain` without cutting off UI.
