import React, { useState } from "react";
import {
	ArrowsLeftRight,
	CaretLeft,
	CaretRight,
	FilmSlate,
	Lightning,
	Plus,
	Sparkle,
	Trash,
	VideoCamera,
} from "@phosphor-icons/react";
import { useSlideDeck } from "@/core/slides/SlideDeckContext";
import type { SlideType, TransitionType } from "@/core/slides/types";

interface SlideDeckBarProps {
	className?: string;
}

export const SlideDeckBar: React.FC<SlideDeckBarProps> = ({ className }) => {
	const {
		project,
		activeSlideId,
		setActiveSlideId,
		addSlide,
		removeSlide,
		reorderSlides,
		setTransition,
		getTransitionBetween,
	} = useSlideDeck();

	const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
	const [activeTransitionPair, setActiveTransitionPair] = useState<{
		fromId: string;
		toId: string;
	} | null>(null);

	const handleAddSlide = (type: SlideType) => {
		setIsAddMenuOpen(false);
		addSlide(type);
	};

	const getSlideTypeBadge = (type: SlideType) => {
		switch (type) {
			case "record":
				return {
					label: "Record",
					icon: VideoCamera,
					colorClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
				};
			case "video":
				return {
					label: "Video NLE",
					icon: FilmSlate,
					colorClass: "bg-blue-500/20 text-blue-400 border-blue-500/30",
				};
			case "keyframe":
				return {
					label: "Keyframe",
					icon: Sparkle,
					colorClass: "bg-purple-500/20 text-purple-400 border-purple-500/30",
				};
			case "remotion":
				return {
					label: "Remotion",
					icon: Lightning,
					colorClass: "bg-pink-500/20 text-pink-400 border-pink-500/30",
				};
			default:
				return {
					label: type,
					icon: FilmSlate,
					colorClass: "bg-slate-500/20 text-slate-400 border-slate-500/30",
				};
		}
	};

	return (
		<div
			className={`relative flex items-center border-t border-slate-800 bg-slate-950/90 px-4 py-2.5 backdrop-blur select-none ${
				className || ""
			}`}
		>
			{/* Slide Strip */}
			<div className="flex flex-1 items-center gap-2 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-slate-700">
				{project.slides.map((slide, index) => {
					const isActive = slide.id === activeSlideId;
					const badge = getSlideTypeBadge(slide.type);
					const Icon = badge.icon;
					const durationSec = (slide.durationMs / 1000).toFixed(1);
					const nextSlide = project.slides[index + 1];
					const transition = nextSlide ? getTransitionBetween(slide.id, nextSlide.id) : null;

					return (
						<React.Fragment key={slide.id}>
							{/* Slide Card */}
							<div
								onClick={() => setActiveSlideId(slide.id)}
								className={`group relative flex h-20 w-36 cursor-pointer flex-col justify-between rounded-lg border p-2 transition-all duration-150 ${
									isActive
										? "border-emerald-500 bg-slate-900 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-500/50"
										: "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80"
								}`}
							>
								{/* Card Top: Order & Type Badge */}
								<div className="flex items-center justify-between">
									<span
										className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
											isActive ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
										}`}
									>
										{index + 1}
									</span>

									<span
										className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase ${badge.colorClass}`}
									>
										<Icon size={10} weight="bold" />
										{badge.label}
									</span>
								</div>

								{/* Card Body: Title */}
								<div className="truncate px-0.5 text-xs font-medium text-slate-200" title={slide.title}>
									{slide.title}
								</div>

								{/* Card Bottom: Duration & Actions */}
								<div className="flex items-center justify-between text-[10px] text-slate-400">
									<span>{durationSec}s</span>

									{/* Hover Actions: Move Left/Right, Delete */}
									<div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
										{index > 0 && (
											<button
												type="button"
												title="Pindah ke kiri"
												onClick={(e) => {
													e.stopPropagation();
													reorderSlides(index, index - 1);
												}}
												className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
											>
												<CaretLeft size={12} />
											</button>
										)}
										{index < project.slides.length - 1 && (
											<button
												type="button"
												title="Pindah ke kanan"
												onClick={(e) => {
													e.stopPropagation();
													reorderSlides(index, index + 1);
												}}
												className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
											>
												<CaretRight size={12} />
											</button>
										)}
										{project.slides.length > 1 && (
											<button
												type="button"
												title="Hapus slide"
												onClick={(e) => {
													e.stopPropagation();
													removeSlide(slide.id);
												}}
												className="rounded p-0.5 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300"
											>
												<Trash size={12} />
											</button>
										)}
									</div>
								</div>
							</div>

							{/* Inter-Slide Transition Marker */}
							{nextSlide && (
								<div className="relative flex items-center justify-center">
									<button
										type="button"
										title={`Transisi: ${transition?.type || "none"}`}
										onClick={() =>
											setActiveTransitionPair(
												activeTransitionPair?.fromId === slide.id
													? null
													: { fromId: slide.id, toId: nextSlide.id },
											)
										}
										className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-colors ${
											transition && transition.type !== "none"
												? "border-sky-500/40 bg-sky-950/60 text-sky-400 hover:bg-sky-900/60"
												: "border-slate-800 bg-slate-900/60 text-slate-500 hover:border-slate-700 hover:text-slate-300"
										}`}
									>
										<ArrowsLeftRight size={13} weight="bold" />
									</button>

									{/* Transition Picker Popover */}
									{activeTransitionPair?.fromId === slide.id && (
										<div className="absolute bottom-9 z-50 flex w-36 flex-col gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-xl">
											<span className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">
												Pilih Transisi
											</span>
											{(
												[
													"none",
													"crossfade",
													"wipe-left",
													"slide-left",
													"zoom-in",
												] as TransitionType[]
											).map((type) => (
												<button
													key={type}
													type="button"
													onClick={() => {
														setTransition(slide.id, nextSlide.id, type);
														setActiveTransitionPair(null);
													}}
													className={`flex items-center justify-between rounded px-2 py-1 text-left text-xs capitalize ${
														(transition?.type || "none") === type
															? "bg-sky-500/20 font-medium text-sky-300"
															: "text-slate-300 hover:bg-slate-800"
													}`}
												>
													{type}
												</button>
											))}
										</div>
									)}
								</div>
							)}
						</React.Fragment>
					);
				})}

				{/* Add Slide Button & Menu */}
				<div className="relative">
					<button
						type="button"
						onClick={() => setIsAddMenuOpen((prev) => !prev)}
						className="flex h-20 w-28 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-800 bg-slate-900/30 text-slate-400 transition hover:border-slate-700 hover:bg-slate-900/60 hover:text-slate-200"
					>
						<Plus size={18} weight="bold" />
						<span className="text-[11px] font-medium">+ Add Slide</span>
					</button>

					{/* Add Slide Dropdown Menu */}
					{isAddMenuOpen && (
						<div className="absolute bottom-22 left-0 z-50 w-52 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl">
							<div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
								Pilih Tipe Slide
							</div>

							<button
								type="button"
								onClick={() => handleAddSlide("record")}
								className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800"
							>
								<div className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500/20 text-emerald-400">
									<VideoCamera size={16} weight="bold" />
								</div>
								<div>
									<div className="text-xs font-medium text-white">Record Slide</div>
									<div className="text-[10px] text-slate-400">Screen Studio, auto-zoom</div>
								</div>
							</button>

							<button
								type="button"
								onClick={() => handleAddSlide("video")}
								className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800"
							>
								<div className="flex h-7 w-7 items-center justify-center rounded bg-blue-500/20 text-blue-400">
									<FilmSlate size={16} weight="bold" />
								</div>
								<div>
									<div className="text-xs font-medium text-white">Video Slide</div>
									<div className="text-[10px] text-slate-400">CapCut multi-track NLE</div>
								</div>
							</button>

							<div className="my-1 border-t border-slate-800" />

							<div className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 opacity-50 cursor-not-allowed">
								<div className="flex items-center gap-2">
									<Sparkle size={14} className="text-purple-400" />
									<span className="text-xs text-slate-300">Keyframe Slide</span>
								</div>
								<span className="text-[9px] text-slate-500">Soon</span>
							</div>

							<div className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 opacity-50 cursor-not-allowed">
								<div className="flex items-center gap-2">
									<Lightning size={14} className="text-pink-400" />
									<span className="text-xs text-slate-300">Remotion Slide</span>
								</div>
								<span className="text-[9px] text-slate-500">Soon</span>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
