import { Sparkle } from "@phosphor-icons/react";
import React from "react";

export const MotionGuideTab: React.FC = () => {
	return (
		<div className="flex-1 overflow-y-auto p-4 text-slate-300 font-sans leading-relaxed space-y-4 select-text">
			<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
				<div className="flex items-center gap-2 text-amber-400 font-semibold text-xs mb-1">
					<Sparkle size={15} weight="fill" />
					<span>Cara Kerja Motion Slide Captr Studio</span>
				</div>
				<p className="text-xs text-slate-300">
					Motion Slide memungkinkan Anda membuat video motion graphics menggunakan
					teknologi web standar (HTML5, CSS3, & JS). Anda tidak perlu rendering berat atau
					tool eksternal!
				</p>
			</div>

			<div className="space-y-2">
				<h4 className="text-xs font-bold text-white flex items-center gap-1.5">
					<span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-amber-400">
						1
					</span>
					Membuat Animasi dengan CSS Keyframes
				</h4>
				<p className="text-[11px] text-slate-400">
					Gunakan deklarasi <code>@keyframes</code> standard di tab <strong>CSS</strong>.
					Untuk transisi masuk berurutan, atur <code>animation-delay</code> pada
					masing-masing elemen.
				</p>
				<div className="rounded-lg bg-slate-900 p-2.5 font-mono text-[11px] text-amber-300 border border-slate-800">
					{`@keyframes slideIn {\n  0% { opacity: 0; transform: translateY(20px); }\n  100% { opacity: 1; transform: translateY(0); }\n}`}
				</div>
			</div>

			<div className="space-y-2">
				<h4 className="text-xs font-bold text-white flex items-center gap-1.5">
					<span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-amber-400">
						2
					</span>
					Sinkronisasi Playhead (Scrubbing) dengan JS
				</h4>
				<p className="text-[11px] text-slate-400">
					Captr Studio otomatis memanggil fungsi JavaScript berikut saat playhead
					bergerak:
				</p>
				<div className="rounded-lg bg-slate-900 p-2.5 font-mono text-[11px] text-sky-300 border border-slate-800">
					{`window.setSeekTime = function(timeMs, durationMs) {\n  const progress = timeMs / durationMs;\n  // Update elemen sesuai progress (0.0 - 1.0)\n};`}
				</div>
			</div>

			<div className="space-y-2">
				<h4 className="text-xs font-bold text-white flex items-center gap-1.5">
					<span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-amber-400">
						3
					</span>
					Auto Reload & Live Editing
				</h4>
				<p className="text-[11px] text-slate-400">
					Setiap ketikan Anda di tab HTML, CSS, atau JS akan langsung di-compile ke
					preview sebelah kiri tanpa perlu me-reload manual. Anda dapat mematikan toggle
					Auto-reload di bagian atas jika ingin mengedit tanpa refresh otomatis.
				</p>
			</div>

			<div className="space-y-2">
				<h4 className="text-xs font-bold text-white flex items-center gap-1.5">
					<span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-amber-400">
						4
					</span>
					Kompatibilitas Global Flow
				</h4>
				<p className="text-[11px] text-slate-400">
					Slide ini dapat digabungkan dengan Slide Record dan Slide Video Captr Studio.
					Transisi antar-slide (Crossfade, Fade to Black, Slide Left, dll.) berfungsi
					penuh di timeline dan saat multi-slide export.
				</p>
			</div>
		</div>
	);
};
