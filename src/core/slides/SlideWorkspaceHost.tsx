import React from "react";
import type { SlideData, SlideType } from "./types";
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

	const renderWorkspace = <TType extends SlideType,>(slide: SlideData<TType>) => {
		const WorkspaceComponent = slideRegistry.get(slide.type).WorkspaceComponent;
		return (
			<WorkspaceComponent
				key={slide.id}
				slide={slide}
				onUpdateMeta={(updater) => updateSlideMeta(slide.id, slide.type, updater)}
				onUpdateTitle={(title) => updateSlideTitle(slide.id, title)}
				onUpdateDuration={(durationMs) => updateSlideDuration(slide.id, durationMs)}
				canvasDimensions={project.canvas}
			/>
		);
	};

	let workspace: React.ReactNode;
	switch (activeSlide.type) {
		case "record":
			workspace = renderWorkspace(activeSlide);
			break;
		case "video":
			workspace = renderWorkspace(activeSlide);
			break;
		case "motion":
			workspace = renderWorkspace(activeSlide);
			break;
		case "keyframe":
			workspace = renderWorkspace(activeSlide);
			break;
	}

	return (
		<div className={`relative h-full w-full overflow-hidden ${className || ""}`}>
			{workspace}
		</div>
	);
};
