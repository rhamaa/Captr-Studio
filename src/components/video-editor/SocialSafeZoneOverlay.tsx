import type React from "react";
import type { AspectRatio } from "@/utils/aspectRatioUtils";

interface SocialSafeZoneOverlayProps {
	aspectRatio: AspectRatio;
	visible?: boolean;
}

/**
 * Visual safe zone guide overlay for vertical (9:16) and social aspect ratios.
 * Displays real-world platform UI dead-zones (TikTok, IG Reels, YouTube Shorts)
 * so creators can keep critical text, faces, and cursor actions visible.
 */
export const SocialSafeZoneOverlay: React.FC<SocialSafeZoneOverlayProps> = ({
	aspectRatio,
	visible = true,
}) => {
	if (!visible) return null;

	if (aspectRatio === "9:16") {
		return (
			<div className="pointer-events-none absolute inset-0 z-30 overflow-hidden select-none">
				{/* Top Header Dead-Zone (Status, Search, Tabs) */}
				<div className="absolute top-0 inset-x-0 h-[10%] bg-red-500/10 border-b border-dashed border-red-400/40 flex items-center justify-center">
					<span className="text-[10px] font-medium tracking-wide text-red-300/80 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
						Top Header Area (Search / Tabs)
					</span>
				</div>

				{/* Right Sidebar Dead-Zone (Like, Comments, Share, Audio Disc) */}
				<div className="absolute top-[32%] bottom-[25%] right-0 w-[16%] bg-red-500/10 border-l border-dashed border-red-400/40 flex flex-col items-center justify-around py-3">
					<div className="flex flex-col items-center gap-1 opacity-70">
						<div className="w-5 h-5 rounded-full border border-red-300/50 flex items-center justify-center text-[8px] text-red-200">
							♥
						</div>
						<div className="w-5 h-5 rounded-full border border-red-300/50 flex items-center justify-center text-[8px] text-red-200">
							💬
						</div>
						<div className="w-5 h-5 rounded-full border border-red-300/50 flex items-center justify-center text-[8px] text-red-200">
							↗
						</div>
					</div>
					<span className="text-[8px] font-medium tracking-tighter text-red-300/80 [writing-mode:vertical-rl] rotate-180">
						Action Icons
					</span>
				</div>

				{/* Bottom Footer Dead-Zone (Captions, Username, Audio, Nav Bar) */}
				<div className="absolute bottom-0 inset-x-0 h-[22%] bg-red-500/10 border-t border-dashed border-red-400/40 flex flex-col justify-end p-2.5">
					<div className="flex items-center justify-between text-[9px] text-red-300/80 bg-black/50 px-2.5 py-1 rounded backdrop-blur-xs">
						<span>@username · Captions & Audio Ticker</span>
						<span className="text-[8px] opacity-75">Mobile UI</span>
					</div>
				</div>

				{/* Center Recommended Safe Zone */}
				<div className="absolute top-[12%] bottom-[24%] left-[4%] right-[18%] border-2 border-emerald-400/50 rounded-lg pointer-events-none flex items-start justify-end p-1.5">
					<span className="text-[9px] font-semibold text-emerald-300 bg-black/60 px-1.5 py-0.5 rounded shadow">
						Safe Content Zone
					</span>
				</div>
			</div>
		);
	}

	if (aspectRatio === "4:5" || aspectRatio === "1:1") {
		return (
			<div className="pointer-events-none absolute inset-0 z-30 overflow-hidden select-none">
				{/* Inner 90% boundary */}
				<div className="absolute inset-[5%] border border-dashed border-emerald-400/40 rounded-md flex items-start justify-end p-1.5">
					<span className="text-[8px] font-medium text-emerald-300/80 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-xs">
						{aspectRatio === "1:1" ? "1:1 Square Feed" : "4:5 Portrait Feed"}
					</span>
				</div>
			</div>
		);
	}

	return null;
};
