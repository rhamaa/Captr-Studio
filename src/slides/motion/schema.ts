export interface MotionSlideMeta {
	document?: string;
	html: string;
	css: string;
	js: string;
	durationMs: number;
	autoReload?: boolean;
	backgroundColor?: string;
	templateId?: string;
	modeSelected?: boolean;
	sourceFileName?: string;
}

export function extractDocumentParts(docString: string): {
	html: string;
	css: string;
	js: string;
} {
	if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(docString, "text/html");

			const styleElements = Array.from(doc.querySelectorAll("style"));
			const css = styleElements
				.map((el) => el.textContent || "")
				.filter(Boolean)
				.join("\n\n");
			styleElements.forEach((el) => el.remove());

			const scriptElements = Array.from(doc.querySelectorAll("script:not([src])"));
			const js = scriptElements
				.map((el) => el.textContent || "")
				.filter(Boolean)
				.join("\n\n");
			scriptElements.forEach((el) => el.remove());

			const bodyHtml = doc.body ? doc.body.innerHTML.trim() : docString;
			return {
				html: bodyHtml || docString,
				css: css || "",
				js: js || "",
			};
		} catch {
			// fallback to regex
		}
	}

	const cssMatches: string[] = [];
	const cleanCss = docString.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, p1) => {
		cssMatches.push(p1.trim());
		return "";
	});

	const jsMatches: string[] = [];
	const cleanJs = cleanCss.replace(
		/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
		(_match, p1) => {
			jsMatches.push(p1.trim());
			return "";
		},
	);

	const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(cleanJs);
	const html = (bodyMatch ? bodyMatch[1] : cleanJs).trim();

	return {
		html: html || docString,
		css: cssMatches.filter(Boolean).join("\n\n"),
		js: jsMatches.filter(Boolean).join("\n\n"),
	};
}

export const STARTER_HTML = `<div class="motion-canvas">
  <!-- 
    =============================================================================
    CAPTR MOTION GRAPHICS — STARTER TEMPLATE
    =============================================================================
    Panduan Singkat Membuat Video Animasi:
    1. DURASI & PLAYBACK:
       - Durasi slide diatur di panel kontrol atas (misal 5 detik).
       - Captr Studio mengontrol playback secara otomatis saat video di-play / scrub.
    2. ANIMASI CSS (@keyframes):
       - Anda bisa membuat animasi apa pun menggunakan CSS standard.
       - Elemen dapat masuk secara berurutan dengan animation-delay.
    3. TIMELINE INTERAKTIF (JavaScript):
       - Captr Studio memanggil window.setSeekTime(currentTimeMs, durationMs)
         setiap kali playhead bergerak atau discrub di timeline.
       - Cek tab "JS" untuk melihat contoh progress bar & update frame real-time!
    4. AUTO RELOAD:
       - Setiap kali Anda mengubah HTML, CSS, atau JS, preview akan langsung reload.
    =============================================================================
  -->

  <!-- Background Decorative Ambient Glow -->
  <div class="glow-orb orb-1"></div>
  <div class="glow-orb orb-2"></div>

  <!-- Main Motion Card -->
  <div class="card">
    <div class="badge">
      <span class="badge-dot"></span>
      <span>CAPTR MOTION STUDIO</span>
    </div>

    <h1 class="title">
      Animasi Video Berbasis <span class="gradient-text">HTML & CSS</span>
    </h1>

    <p class="subtitle">
      Tulis kode HTML, CSS, dan JavaScript Anda. Preview langsung auto-reload
      dan sinkron dengan timeline Captr Studio secara presisi.
    </p>

    <!-- Feature Steps Grid -->
    <div class="grid">
      <div class="step-box step-1">
        <div class="step-num">01</div>
        <div class="step-content">
          <h3>Struktur HTML</h3>
          <p>Teks, grafik SVG, badge, atau kartu informasi presentasi.</p>
        </div>
      </div>

      <div class="step-box step-2">
        <div class="step-num">02</div>
        <div class="step-content">
          <h3>CSS Keyframes</h3>
          <p>Transisi halus, glowing glassmorphism, dan efek tipografi.</p>
        </div>
      </div>

      <div class="step-box step-3">
        <div class="step-num">03</div>
        <div class="step-content">
          <h3>JS Timeline Sync</h3>
          <p>Kaitkan variabel animasi ke seek time frame-by-frame.</p>
        </div>
      </div>
    </div>

    <!-- Timeline Progress Bar Indicator -->
    <div class="timeline-indicator">
      <div class="timeline-track">
        <div id="progress-fill" class="timeline-fill"></div>
      </div>
      <div class="timeline-meta">
        <span id="time-display">0.0s / 5.0s</span>
        <span class="live-pill">LIVE TIMELINE</span>
      </div>
    </div>
  </div>
</div>`;

export const STARTER_CSS = `/* ==========================================================================
   Motion Slide Stylesheet
   Semua style di sini scoped dan terisolasi di dalam preview sandbox.
   ========================================================================== */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
  background-color: #030712;
  color: #f8fafc;
  overflow: hidden;
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
}

.motion-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 30%, #1e1b4b 0%, #030712 70%);
  overflow: hidden;
}

/* Ambient Animated Glows */
.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.45;
  pointer-events: none;
  animation: floatOrb 6s ease-in-out infinite alternate;
}

.orb-1 {
  width: 380px;
  height: 380px;
  background: #f59e0b;
  top: -60px;
  left: 10%;
}

.orb-2 {
  width: 420px;
  height: 420px;
  background: #6366f1;
  bottom: -80px;
  right: 10%;
  animation-delay: -3s;
}

@keyframes floatOrb {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(40px, 30px) scale(1.15); }
}

/* Main Card */
.card {
  position: relative;
  z-index: 10;
  max-width: 900px;
  width: 90%;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  padding: 44px 48px;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7),
              0 0 40px rgba(99, 102, 241, 0.15);
  backdrop-filter: blur(20px);
  animation: cardEntrance 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes cardEntrance {
  0% {
    opacity: 0;
    transform: translateY(35px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Badge */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #fbbf24;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-bottom: 20px;
  animation: fadeIn 0.8s ease-out 0.2s both;
}

.badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
  animation: pulseDot 2s infinite;
}

@keyframes pulseDot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.6; }
}

/* Typography */
.title {
  font-size: 38px;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 14px;
  animation: fadeIn 0.8s ease-out 0.35s both;
}

.gradient-text {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 40%, #ec4899 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 15px;
  line-height: 1.6;
  color: #94a3b8;
  max-width: 680px;
  margin-bottom: 32px;
  animation: fadeIn 0.8s ease-out 0.5s both;
}

/* Grid of steps */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.step-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 18px 20px;
}

.step-1 { animation: slideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both; }
.step-2 { animation: slideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.75s both; }
.step-3 { animation: slideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.9s both; }

.step-num {
  font-size: 12px;
  font-weight: 800;
  font-family: monospace;
  color: #f59e0b;
  margin-bottom: 8px;
}

.step-box h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #f1f5f9;
}

.step-box p {
  font-size: 12px;
  line-height: 1.45;
  color: #64748b;
}

/* Progress bar synchronized with timeline */
.timeline-indicator {
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.timeline-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 10px;
}

.timeline-fill {
  width: 0%;
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #ec4899);
  border-radius: 9999px;
  transition: width 0.05s linear;
}

.timeline-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-family: monospace;
  color: #64748b;
}

.live-pill {
  font-size: 9px;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 700;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}`;

export const STARTER_JS = `// =============================================================================
// CAPTR MOTION — JAVASCRIPT ANIMATION & TIMELINE HOOKS
// =============================================================================
// Captr Studio memanggil fungsi window.setSeekTime(timeMs, durationMs) secara global
// saat video dimainkan (playback) atau saat scrubber di-drag.

window.setSeekTime = function(timeMs, durationMs) {
  // 1. Hitung progress dari 0.0 sampai 1.0
  const progress = Math.min(1, Math.max(0, timeMs / Math.max(1, durationMs)));
  
  // 2. Update progress bar visual
  const progressFill = document.getElementById("progress-fill");
  if (progressFill) {
    progressFill.style.width = (progress * 100).toFixed(2) + "%";
  }

  // 3. Update tampilan waktu (contoh: 2.5s / 5.0s)
  const timeDisplay = document.getElementById("time-display");
  if (timeDisplay) {
    const curSec = (timeMs / 1000).toFixed(1);
    const durSec = (durationMs / 1000).toFixed(1);
    timeDisplay.textContent = \`\${curSec}s / \${durSec}s (\${Math.round(progress * 100)}%)\`;
  }
};

console.log("[Motion Slide] Starter template initialized!");`;

export const DEFAULT_SINGLE_DOCUMENT_TEMPLATE = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
${STARTER_CSS}
  </style>
</head>
<body>
${STARTER_HTML}

  <script>
${STARTER_JS}
  </script>
</body>
</html>`;

export function buildMotionPreviewDocument(meta: Partial<MotionSlideMeta>): string {
	let doc = meta.document?.trim();
	if (!doc) {
		const html = meta.html ?? STARTER_HTML;
		const css = meta.css ?? STARTER_CSS;
		const js = meta.js ?? STARTER_JS;
		doc = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
${css}
  </style>
</head>
<body>
${html}

  <script>
${js}
  </script>
</body>
</html>`;
	}

	const seekBridgeScript = `
  <script data-captr-bridge="true">
    (function() {
      window.addEventListener("message", function(e) {
        if (e.data && e.data.type === "SEEK") {
          if (typeof window.setSeekTime === "function") {
            try {
              window.setSeekTime(e.data.timeMs, e.data.durationMs);
            } catch(seekErr) {
              console.error("[Captr Motion Seek Error]", seekErr);
            }
          }
        }
      });
    })();
  </script>`;

	if (doc.includes("</body>")) {
		return doc.replace("</body>", `${seekBridgeScript}\n</body>`);
	}
	return `${doc}\n${seekBridgeScript}`;
}

export function createDefaultMotionMeta(): MotionSlideMeta {
	return {
		document: DEFAULT_SINGLE_DOCUMENT_TEMPLATE,
		html: STARTER_HTML,
		css: STARTER_CSS,
		js: STARTER_JS,
		durationMs: 5000,
		autoReload: true,
		backgroundColor: "#030712",
		templateId: "starter-explainer",
		modeSelected: false,
	};
}
