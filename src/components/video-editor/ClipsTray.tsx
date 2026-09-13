import {
	CaretLeft as ChevronLeft,
	CaretRight as ChevronRight,
	FilmStrip as Film,
	Plus,
	Trash as Trash2,
	VideoCamera as Video,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { ClipEntry } from "./types";
import { formatClipDuration, isRecordedClip } from "./clipsUtils";

export interface ClipsTrayProps {
	clips: ClipEntry[];
	selectedClipId: string | null;
	onSelectClip: (clipId: string) => void;
	onRecordNewTake: () => void;
	onImportMedia: () => void;
	onDeleteClip?: (clipId: string) => void;
	onReorderClip?: (clipId: string, direction: "left" | "right") => void;
	className?: string;
}

export function ClipsTray({
	clips,
	selectedClipId,
	onSelectClip,
	onRecordNewTake,
	onImportMedia,
	onDeleteClip,
	onReorderClip,
	className = "",
}: ClipsTrayProps) {
	return (
		<div
			className={`flex items-center gap-2 overflow-x-auto px-4 py-2 bg-editor-panel/70 border-b border-foreground/10 select-none scrollbar-thin scrollbar-thumb-foreground/10 ${className}`}
		>
			<div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pr-2 border-r border-foreground/10 shrink-0">
				<Film className="w-3.5 h-3.5 text-[#2563EB]" />
				<span>Takes ({clips.length})</span>
			</div>

			<div className="flex items-center gap-2 min-w-0">
				{clips.map((clip, index) => {
					const isSelected = selectedClipId === clip.id;
					const isRecorded = isRecordedClip(clip);
					const canMoveLeft = index > 0;
					const canMoveRight = index < clips.length - 1;

					return (
						<div
							key={clip.id}
							onClick={() => onSelectClip(clip.id)}
							className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
								isSelected
									? "bg-[#2563EB]/15 border-[#2563EB] shadow-[0_0_12px_rgba(37,99,235,0.25)] text-foreground"
									: "bg-foreground/[0.03] border-foreground/10 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
							}`}
						>
							<div className="flex items-center justify-center w-5 h-5 rounded-md bg-foreground/10 text-[11px] font-mono font-bold">
								{index + 1}
							</div>

							<div className="flex flex-col text-left min-w-[75px] max-w-[150px]">
								<div className="flex items-center gap-1.5">
									<span className="text-xs font-semibold truncate leading-tight">
										{clip.label || (isRecorded ? `Take ${index + 1}` : `Video ${index + 1}`)}
									</span>
									<span
										className={`text-[8px] leading-tight px-1 py-0.5 rounded font-mono font-bold tracking-wider ${
											isRecorded
												? "bg-red-500/20 text-red-400 border border-red-500/30"
												: "bg-blue-500/20 text-blue-400 border border-blue-500/30"
										}`}
									>
										{isRecorded ? "REC" : "FILE"}
									</span>
								</div>
								<div className="flex items-center gap-1 text-[10px] opacity-70 font-mono">
									<span>{formatClipDuration(clip.durationMs)}</span>
									{clip.webcamPath ? (
										<span className="text-[9px] text-amber-400 font-semibold" title="Companion webcam active">
											• CAM
										</span>
									) : null}
									{clip.microphoneAudioPath ? (
										<span className="text-[9px] text-emerald-400 font-semibold" title="Companion mic audio">
											• MIC
										</span>
									) : null}
								</div>
							</div>

							{/* Quick Reorder and Delete controls on hover */}
							<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
								{onReorderClip && canMoveLeft ? (
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onReorderClip(clip.id, "left");
										}}
										className="p-1 rounded hover:bg-foreground/15 text-muted-foreground hover:text-foreground"
										title="Move earlier"
									>
										<ChevronLeft className="w-3 h-3" />
									</button>
								) : null}

								{onReorderClip && canMoveRight ? (
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onReorderClip(clip.id, "right");
										}}
										className="p-1 rounded hover:bg-foreground/15 text-muted-foreground hover:text-foreground"
										title="Move later"
									>
										<ChevronRight className="w-3 h-3" />
									</button>
								) : null}

								{onDeleteClip && clips.length > 1 ? (
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onDeleteClip(clip.id);
										}}
										className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
										title="Delete take"
									>
										<Trash2 className="w-3 h-3" />
									</button>
								) : null}
							</div>
						</div>
					);
				})}
			</div>

			{/* Add Take Buttons */}
			<div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-foreground/10">
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={onRecordNewTake}
					className="h-7 px-2.5 text-xs font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 gap-1.5 rounded-lg border border-red-500/20"
					title="Record another take with screen and webcam"
				>
					<span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
					<span>Record Take</span>
				</Button>

				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={onImportMedia}
					className="h-7 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/10 gap-1.5 rounded-lg border border-foreground/10"
					title="Import video clip from file"
				>
					<Plus className="w-3 h-3" />
					<Video className="w-3 h-3" />
					<span>Add Video</span>
				</Button>
			</div>
		</div>
	);
}
