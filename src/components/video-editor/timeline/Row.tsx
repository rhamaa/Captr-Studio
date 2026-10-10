import type { RowDefinition } from "dnd-timeline";
import { useRow } from "dnd-timeline";
import { cn } from "@/lib/utils";
import { TIMELINE_DEFAULT_ROW_CONTENT_MIN_HEIGHT_PX, TIMELINE_ROW_GAP_PX } from "./timelineLayout";

interface RowProps extends RowDefinition {
	children: React.ReactNode;
	label?: string;
	hint?: string;
	isEmpty?: boolean;
	labelColor?: string;
	minHeight?: number;
	className?: string;
	onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
	onMouseMove?: React.MouseEventHandler<HTMLDivElement>;
	onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
	onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
	onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export default function Row({
	id,
	children,
	label,
	hint,
	isEmpty,
	labelColor = "#666",
	minHeight,
	className,
	onMouseEnter,
	onMouseMove,
	onMouseLeave,
	onMouseDown,
	onClick,
}: RowProps) {
	const { setNodeRef, rowWrapperStyle, rowStyle } = useRow({ id });

	return (
		<div
			className={cn("bg-transparent relative flex-1", className)}
			style={{
				...rowWrapperStyle,
				minHeight: minHeight ?? TIMELINE_DEFAULT_ROW_CONTENT_MIN_HEIGHT_PX,
				marginBottom: TIMELINE_ROW_GAP_PX,
			}}
		>
			{label && (
				<div
					className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold uppercase tracking-widest z-20 pointer-events-none select-none"
					style={{ color: labelColor, writingMode: "horizontal-tb" }}
				>
					{label}
				</div>
			)}
			{isEmpty && hint && (
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
					<span className="text-[11px] text-foreground/15 font-medium">{hint}</span>
				</div>
			)}
			<div
				ref={setNodeRef}
				className="relative h-full overflow-hidden"
				style={{
					...rowStyle,
					minHeight: minHeight ?? TIMELINE_DEFAULT_ROW_CONTENT_MIN_HEIGHT_PX,
				}}
				onMouseEnter={onMouseEnter}
				onMouseMove={onMouseMove}
				onMouseLeave={onMouseLeave}
				onMouseDown={onMouseDown}
				onClick={onClick}
			>
				{children}
			</div>
		</div>
	);
}
