import {
	Eye,
	EyeSlash,
	Lock,
	LockOpen,
	SpeakerSimpleHigh,
	SpeakerSimpleSlash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { AnnotationRegion } from "../types";

export interface AnnotationHeaderProps {
	annotation: AnnotationRegion;
	onLayerChange?: (changes: Partial<AnnotationRegion>) => void;
	t: (key: string, defaultVal?: string, params?: Record<string, string | number>) => string;
}

export function AnnotationHeader({
	annotation,
	onLayerChange,
	t,
}: AnnotationHeaderProps) {
	return (
		<div className="flex items-center justify-between mb-4">
			<span className="text-sm font-medium text-foreground">
				{t("annotations.settings")}
			</span>
			<div className="flex items-center gap-1.5">
				<button
					type="button"
					onClick={() =>
						onLayerChange?.({ visible: annotation.visible === false ? true : false })
					}
					className={cn(
						"p-1.5 rounded-lg border transition-all text-xs flex items-center justify-center",
						annotation.visible === false
							? "bg-amber-500/10 border-amber-500/30 text-amber-400"
							: "bg-foreground/5 border-foreground/10 text-muted-foreground hover:text-foreground",
					)}
					title={
						annotation.visible === false
							? "Hidden (Click to show)"
							: "Visible (Click to hide)"
					}
				>
					{annotation.visible === false ? (
						<EyeSlash className="w-3.5 h-3.5" />
					) : (
						<Eye className="w-3.5 h-3.5" />
					)}
				</button>
				<button
					type="button"
					onClick={() => onLayerChange?.({ locked: !annotation.locked })}
					className={cn(
						"p-1.5 rounded-lg border transition-all text-xs flex items-center justify-center",
						annotation.locked
							? "bg-amber-500/10 border-amber-500/30 text-amber-400"
							: "bg-foreground/5 border-foreground/10 text-muted-foreground hover:text-foreground",
					)}
					title={annotation.locked ? "Locked (Click to unlock)" : "Unlocked (Click to lock)"}
				>
					{annotation.locked ? (
						<Lock className="w-3.5 h-3.5" />
					) : (
						<LockOpen className="w-3.5 h-3.5" />
					)}
				</button>
				{annotation.videoFilePath && (
					<button
						type="button"
						onClick={() => onLayerChange?.({ muted: !annotation.muted })}
						className={cn(
							"p-1.5 rounded-lg border transition-all text-xs flex items-center justify-center",
							annotation.muted
								? "bg-red-500/10 border-red-500/30 text-red-400"
								: "bg-foreground/5 border-foreground/10 text-muted-foreground hover:text-foreground",
						)}
						title={
							annotation.muted
								? "Muted (Click to unmute)"
								: "Audio Active (Click to mute)"
						}
					>
						{annotation.muted ? (
							<SpeakerSimpleSlash className="w-3.5 h-3.5" />
						) : (
							<SpeakerSimpleHigh className="w-3.5 h-3.5" />
						)}
					</button>
				)}
				<span className="text-[10px] uppercase tracking-wider font-medium text-[#2563EB] bg-[#2563EB]/10 px-2 py-1 rounded-full">
					{t("annotations.active")}
				</span>
			</div>
		</div>
	);
}
