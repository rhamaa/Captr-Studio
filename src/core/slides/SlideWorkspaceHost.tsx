import React from "react";
import { slideRegistry } from "./registry";
import { useSlideDeck } from "./SlideDeckContext";

interface SlideWorkspaceHostProps {
	className?: string;
}

export const SlideWorkspaceHost: React.FC<SlideWorkspaceHostProps> = ({ className }) => {
	const {
		activeSlide,
		updateSlideMeta,
		updateSlideTitle,
		updateSlideDuration,
		project,
	} = useSlideDeck();

	if (!activeSlide) {
		return (
			<div className={`flex flex-col items-center justify-center p-12 text-slate-400 ${className || ""}`}>
				<p className="text-sm">Tidak ada slide yang dipilih.</p>
			</div>
		);
	}

	const isRegistered = slideRegistry.has(activeSlide.type);

	if (!isRegistered) {
		return (
			<div className={`flex flex-col items-center justify-center p-12 text-slate-400 ${className || ""}`}>
				<div className="rounded-lg border border-slate-700 bg-slate-800/80 p-6 text-center max-w-md">
					<h3 className="text-base font-semibold text-white mb-2">
						Modul Slide Belum Terdaftar
					</h3>
					<p className="text-xs text-slate-400 mb-4">
						Tipe slide <span className="font-mono text-emerald-400">"{activeSlide.type}"</span> belum memiliki modul workspace di registry.
					</p>
					<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
						ID: {activeSlide.id}
					</span>
				</div>
			</div>
		);
	}

	const module = slideRegistry.get(activeSlide.type);
	const WorkspaceComponent = module.WorkspaceComponent;

	return (
		<div className={`relative h-full w-full overflow-hidden ${className || ""}`}>
			<WorkspaceComponent
				key={activeSlide.id}
				slide={activeSlide}
				onUpdateMeta={(updater) => updateSlideMeta(activeSlide.id, updater)}
				onUpdateTitle={(title) => updateSlideTitle(activeSlide.id, title)}
				onUpdateDuration={(durationMs) => updateSlideDuration(activeSlide.id, durationMs)}
				canvasDimensions={project.canvas}
			/>
		</div>
	);
};
