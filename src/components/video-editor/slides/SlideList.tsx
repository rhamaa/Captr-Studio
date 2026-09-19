import {
	ArrowsLeftRight,
	CaretDown,
	Check,
	Copy,
	FilmSlate,
	FilmStrip,
	MagnifyingGlassPlus,
	Plus,
	Scissors,
	Sparkle,
	Trash,
	VideoCamera,
	X,
} from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ClipEntry, ClipRegion, ClipTransitionType, SlideMode } from "../types";

export interface SlideListProps {
	slides: ClipEntry[];
	clipRegions: ClipRegion[];
	selectedSlideId: string | null;
	onSelectSlide: (id: string) => void;
	onAddSlide?: () => void;
	onAddRecordSlide?: () => void;
	onAddVideoSlide?: () => void;
	onDeleteSlide?: (id: string) => void;
	onDuplicateSlide?: (id: string) => void;
	onSplitSlide?: (id: string) => void;
	onReorderSlide?: (slideId: string, direction: "left" | "right") => void;
	onTransitionChange?: (
		slideId: string,
		transition: ClipTransitionType,
		durationMs: number,
	) => void;
	currentTimeMs?: number;
}

const TRANSITION_OPTIONS: Array<{
	id: ClipTransitionType;
	label: string;
	description: string;
	icon: typeof FilmStrip;
}> = [
	{ id: "none", label: "Cut (None)", description: "Instant cut between slides", icon: FilmStrip },
	{ id: "fade-black", label: "Fade Black", description: "Cinematic dip to black", icon: Sparkle },
	{ id: "fade-white", label: "Fade White", description: "Luminous flash transition", icon: Sparkle },
	{ id: "slide-left", label: "Slide Left", description: "Smooth horizontal push left", icon: ArrowsLeftRight },
	{ id: "slide-right", label: "Slide Right", description: "Smooth horizontal push right", icon: ArrowsLeftRight },
	{ id: "zoom-push", label: "Zoom Push", description: "Dynamic perspective zoom in", icon: MagnifyingGlassPlus },
];

const DURATION_PRESETS = [200, 400, 600, 800, 1000];

function formatSlideDuration(durationMs: number): string {
	if (!durationMs || durationMs <= 0) return "0:00";
	const totalSeconds = durationMs / 1000;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.floor(totalSeconds % 60);
	const tenths = Math.floor((totalSeconds % 1) * 10);
	return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
}

export function SlideList({
	slides,
	clipRegions,
	selectedSlideId,
	onSelectSlide,
	onAddSlide,
	onAddRecordSlide,
	onAddVideoSlide,
	onDeleteSlide,
	onDuplicateSlide,
	onSplitSlide,
	onReorderSlide: _onReorderSlide,
	onTransitionChange,
}: SlideListProps) {
	const [activeTransitionSlideId, setActiveTransitionSlideId] = useState<string | null>(null);
	const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

	const handleAddRecord = () => {
		setIsAddMenuOpen(false);
		if (onAddRecordSlide) {
			onAddRecordSlide();
		} else if (onAddSlide) {
			onAddSlide();
		}
	};

	const handleAddVideo = () => {
		setIsAddMenuOpen(false);
		if (onAddVideoSlide) {
			onAddVideoSlide();
		} else if (onAddSlide) {
			onAddSlide();
		}
	};

	return (
		<div className="flex flex-col w-full bg-editor-surface/75 border-t border-b border-foreground/10 px-3 py-2 backdrop-blur-md select-none">
			{/* Top bar info */}
			<div className="flex items-center justify-between mb-1.5">
				<div className="flex items-center gap-2">
					<FilmStrip className="w-3.5 h-3.5 text-primary" weight="bold" />
					<span className="text-xs font-bold tracking-tight text-foreground">
						Slides
					</span>
					<span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-semibold font-mono">
						{slides.length}
					</span>
				</div>

				{/* Add Slide Popover Dropdown */}
				<Popover open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-6 px-2.5 text-[11px] font-medium border-foreground/15 bg-foreground/5 hover:bg-foreground/10 text-foreground gap-1.5 rounded-lg shadow-xs cursor-pointer"
							title="Add new slide (Record mode or Video Editor mode)"
						>
							<Plus className="w-3 h-3 text-primary" weight="bold" />
							<span>Add Slide</span>
							<CaretDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
						</Button>
					</PopoverTrigger>

					<PopoverContent
						align="end"
						sideOffset={6}
						className="w-64 p-2 bg-editor-surface-alt/95 border border-foreground/15 rounded-xl shadow-2xl backdrop-blur-2xl text-foreground"
					>
						<div className="space-y-1">
							<div className="px-2 py-1 border-b border-foreground/10 mb-1">
								<h4 className="text-[11px] font-bold text-foreground">Add New Slide</h4>
								<p className="text-[10px] text-muted-foreground">Select slide editing mode</p>
							</div>

							{/* Option 1: Record Slide */}
							<button
								type="button"
								onClick={handleAddRecord}
								className="w-full flex items-start gap-2.5 p-2 rounded-lg text-left hover:bg-foreground/10 transition-colors cursor-pointer group"
							>
								<div className="p-1.5 rounded-md bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20 group-hover:text-rose-300 mt-0.5">
									<VideoCamera className="w-4 h-4" weight="fill" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-1.5">
										<span className="text-xs font-semibold text-foreground">Record Slide</span>
										<span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/15 text-rose-400 font-bold font-mono">
											REC
										</span>
									</div>
									<p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
										Screen, webcam & cursor telemetry
									</p>
								</div>
							</button>

							{/* Option 2: Video Slide */}
							<button
								type="button"
								onClick={handleAddVideo}
								className="w-full flex items-start gap-2.5 p-2 rounded-lg text-left hover:bg-foreground/10 transition-colors cursor-pointer group"
							>
								<div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 mt-0.5">
									<FilmSlate className="w-4 h-4" weight="fill" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-1.5">
										<span className="text-xs font-semibold text-foreground">Video Slide</span>
										<span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-400 font-bold font-mono">
											VID
										</span>
									</div>
									<p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
										Filmora / CapCut style media editor
									</p>
								</div>
							</button>
						</div>
					</PopoverContent>
				</Popover>
			</div>

			{/* Horizontal filmstrip scroll */}
			<div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 custom-scrollbar min-h-[66px]">
				{slides.map((slide, index) => {
					const isSelected = slide.id === selectedSlideId;
					const region = clipRegions.find((r) => r.id === slide.id);
					const transitionIn = region?.transitionIn ?? "none";
					const transitionInDurationMs = region?.transitionInDurationMs ?? 400;
					const hasTransitionBefore = index > 0;

					const slideMode: SlideMode =
						slide.slideMode ?? (slide.origin === "uploaded" ? "video" : "record");
					const isVideoMode = slideMode === "video";

					return (
						<div key={`${slide.id}-${index}`} className="flex items-center gap-1.5 flex-shrink-0">
							{/* Inter-Slide Transition Node between slide[index-1] and slide[index] */}
							{hasTransitionBefore && (
								<Popover
									open={activeTransitionSlideId === slide.id}
									onOpenChange={(open) => setActiveTransitionSlideId(open ? slide.id : null)}
								>
									<PopoverTrigger asChild>
										<button
											type="button"
											className={cn(
												"group relative flex items-center justify-center h-6 w-6 rounded-md border transition-all cursor-pointer",
												transitionIn !== "none"
													? "border-primary/50 bg-primary/20 text-primary shadow-[0_0_8px_rgba(37,99,235,0.3)]"
													: "border-foreground/10 bg-foreground/[0.03] text-muted-foreground/50 hover:text-foreground hover:border-foreground/25 hover:bg-foreground/10",
											)}
											title={
												transitionIn !== "none"
													? `Transition: ${transitionIn} (${transitionInDurationMs / 1000}s)`
													: "Add transition to this slide"
											}
										>
											{transitionIn !== "none" ? (
												<Sparkle className="w-3 h-3" weight="fill" />
											) : (
												<Plus className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
											)}
										</button>
									</PopoverTrigger>

									<PopoverContent
										align="center"
										sideOffset={8}
										className="w-72 p-3 bg-editor-surface-alt/95 border border-foreground/15 rounded-2xl shadow-2xl backdrop-blur-2xl text-foreground"
									>
										<div className="space-y-3">
											<div className="flex items-center justify-between border-b border-foreground/10 pb-2">
												<div>
													<h4 className="text-xs font-bold text-foreground">
														Transition to Slide {index + 1}
													</h4>
													<p className="text-[10px] text-muted-foreground">
														Choose visual transition effect
													</p>
												</div>
												<button
													type="button"
													onClick={() => setActiveTransitionSlideId(null)}
													className="text-muted-foreground hover:text-foreground p-1 rounded-md cursor-pointer"
												>
													<X className="w-3.5 h-3.5" />
												</button>
											</div>

											{/* Transition Types Grid */}
											<div className="grid grid-cols-2 gap-1.5">
												{TRANSITION_OPTIONS.map((opt) => {
													const isCurrent = transitionIn === opt.id;
													const IconComponent = opt.icon;
													return (
														<button
															key={opt.id}
															type="button"
															onClick={() => {
																onTransitionChange?.(
																	slide.id,
																	opt.id,
																	transitionInDurationMs,
																);
															}}
															className={cn(
																"flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer",
																isCurrent
																	? "border-primary/40 bg-primary/15 text-primary shadow-sm"
																	: "border-foreground/8 bg-foreground/[0.02] hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground",
															)}
														>
															<IconComponent className="w-3.5 h-3.5 flex-shrink-0" />
															<div className="min-w-0">
																<div className="text-[11px] font-semibold truncate">
																	{opt.label}
																</div>
															</div>
															{isCurrent && (
																<Check className="w-3 h-3 ml-auto text-primary flex-shrink-0" />
															)}
														</button>
													);
												})}
											</div>

											{/* Duration Selector */}
											{transitionIn !== "none" && (
												<div className="space-y-1.5 pt-1 border-t border-foreground/10">
													<div className="flex items-center justify-between text-[11px]">
														<span className="text-muted-foreground font-medium">Duration</span>
														<span className="font-mono text-primary font-bold">
															{transitionInDurationMs / 1000}s
														</span>
													</div>
													<div className="flex items-center gap-1">
														{DURATION_PRESETS.map((dur) => (
															<button
																key={dur}
																type="button"
																onClick={() => {
																	onTransitionChange?.(slide.id, transitionIn, dur);
																}}
																className={cn(
																	"flex-1 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer",
																	transitionInDurationMs === dur
																		? "bg-primary text-white shadow-xs"
																		: "bg-foreground/5 text-muted-foreground hover:bg-foreground/10",
																)}
															>
																{dur / 1000}s
															</button>
														))}
													</div>
												</div>
											)}

											{/* Quick Remove Action */}
											{transitionIn !== "none" && (
												<div className="pt-1 flex justify-end">
													<button
														type="button"
														onClick={() => {
															onTransitionChange?.(slide.id, "none", 400);
															setActiveTransitionSlideId(null);
														}}
														className="text-[10px] text-red-400 hover:text-red-300 font-medium cursor-pointer"
													>
														Remove Transition
													</button>
												</div>
											)}
										</div>
									</PopoverContent>
								</Popover>
							)}

							{/* Compact Slide Card */}
							<div
								onClick={() => onSelectSlide(slide.id)}
								className={cn(
									"group relative flex flex-col justify-between w-32 h-14 rounded-lg border p-1.5 cursor-pointer transition-all select-none overflow-hidden",
									isSelected
										? "border-primary bg-primary/[0.10] shadow-[0_0_12px_rgba(37,99,235,0.22)] ring-1 ring-primary/40"
										: "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-foreground/20",
								)}
							>
								{/* Top Header of Slide Card */}
								<div className="flex items-center justify-between z-10">
									<div className="flex items-center gap-1">
										<span
											className={cn(
												"text-[9px] px-1 py-0.2 rounded font-bold font-mono tracking-tight",
												isSelected
													? "bg-primary text-white"
													: "bg-foreground/10 text-muted-foreground",
											)}
										>
											#{index + 1}
										</span>

										{/* Slide kind is fixed; editing one kind never reconfigures another. */}
										<span title={isVideoMode ? "Video Editor Mode" : "Record Mode"} className="text-[9px] font-bold px-1 text-muted-foreground">
											{isVideoMode ? "VID" : "REC"}
										</span>
									</div>

									{/* Action buttons on hover */}
									<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
										{onDuplicateSlide && (
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													onDuplicateSlide(slide.id);
												}}
												className="p-0.5 rounded hover:bg-foreground/20 text-muted-foreground hover:text-foreground cursor-pointer"
												title="Duplicate Slide"
											>
												<Copy className="w-2.5 h-2.5" />
											</button>
										)}
										{onSplitSlide && (
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													onSplitSlide(slide.id);
												}}
												className="p-0.5 rounded hover:bg-foreground/20 text-muted-foreground hover:text-foreground cursor-pointer"
												title="Split Slide"
											>
												<Scissors className="w-2.5 h-2.5" />
											</button>
										)}
										{onDeleteSlide && slides.length > 1 && (
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													onDeleteSlide(slide.id);
												}}
												className="p-0.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 cursor-pointer"
												title="Delete Slide"
											>
												<Trash className="w-2.5 h-2.5" />
											</button>
										)}
									</div>
								</div>

								{/* Bottom info of Slide Card */}
								<div className="flex items-end justify-between z-10 mt-auto">
									<p className="text-[10px] font-medium text-foreground truncate max-w-[65px]">
										{slide.label || (isVideoMode ? `Video ${index + 1}` : `Take ${index + 1}`)}
									</p>
									<span className="text-[9px] font-mono text-muted-foreground font-semibold flex-shrink-0">
										{formatSlideDuration(slide.durationMs)}
									</span>
								</div>

								{/* Subtle decorative background gradient */}
								<div
									className={cn(
										"absolute inset-0 pointer-events-none opacity-20",
										isSelected
											? isVideoMode
												? "bg-gradient-to-br from-cyan-500/20 to-blue-600/10"
												: "bg-gradient-to-br from-primary/30 to-rose-600/10"
											: "bg-gradient-to-br from-transparent to-foreground/[0.02]",
									)}
								/>
							</div>
						</div>
					);
				})}

				{/* Quick Add Pill at the end of filmstrip */}
				<button
					type="button"
					onClick={() => setIsAddMenuOpen(true)}
					className="flex-shrink-0 flex items-center justify-center w-8 h-14 rounded-lg border border-dashed border-foreground/20 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all cursor-pointer"
					title="Add new slide"
				>
					<Plus className="w-3.5 h-3.5" weight="bold" />
				</button>
			</div>
		</div>
	);
}
