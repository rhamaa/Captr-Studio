import {
	BaseBoxShapeUtil,
	HTMLContainer,
	Rectangle2d,
	T,
	type TLBaseShape,
} from "@tldraw/tldraw";
import { useWhiteboardContext } from "../WhiteboardContext";
import { HyperframeCard } from "../../HyperframeCard";

export const HYPERFRAME_CARD_SHAPE_TYPE = "hyperframe-card" as const;

export type HyperframeCardShape = TLBaseShape<
	typeof HYPERFRAME_CARD_SHAPE_TYPE,
	{
		hyperframeId: string;
		w: number;
		h: number;
	}
>;

export class HyperframeCardShapeUtil extends BaseBoxShapeUtil<any> {
	static override type = HYPERFRAME_CARD_SHAPE_TYPE;
	static override props = {
		hyperframeId: T.string,
		w: T.number,
		h: T.number,
	};

	override canResize() {
		return false;
	}

	override canEdit() {
		return false;
	}

	override canBind() {
		return true;
	}

	override hideRotateHandle() {
		return true;
	}

	override hideResizeHandles() {
		return true;
	}

	override getDefaultProps(): HyperframeCardShape["props"] {
		return {
			hyperframeId: "",
			w: 640,
			h: 448,
		};
	}

	override getGeometry(shape: HyperframeCardShape) {
		const w = Math.max(120, Number(shape.props.w) || 640);
		const h = Math.max(120, Number(shape.props.h) || 448);
		return new Rectangle2d({
			width: w,
			height: h,
			isFilled: true,
		});
	}

	override getIndicatorPath(shape: HyperframeCardShape) {
		const w = Math.max(120, Number(shape.props.w) || 640);
		const h = Math.max(120, Number(shape.props.h) || 448);
		const path = new Path2D();
		path.rect(0, 0, w, h);
		return path;
	}

	override component(shape: HyperframeCardShape) {
		return <HyperframeCardComponent shape={shape} />;
	}

	override indicator(shape: HyperframeCardShape) {
		const w = Math.max(120, Number(shape.props.w) || 640);
		const h = Math.max(120, Number(shape.props.h) || 448);
		return (
			<rect
				width={w}
				height={h}
				rx={16}
				ry={16}
			/>
		);
	}
}

function HyperframeCardComponent({ shape }: { shape: HyperframeCardShape }) {
	const ctx = useWhiteboardContext();
	const hyperframeId = shape.props.hyperframeId;

	const hyperframe = ctx?.project?.hyperframes?.find(
		(h) => h.id === hyperframeId,
	);

	if (!ctx || !hyperframe) {
		return (
			<HTMLContainer style={{ pointerEvents: "all" }}>
				<div className="flex h-full w-full select-none items-center justify-center rounded-2xl border border-white/10 bg-[#15171C] p-4 text-xs text-zinc-400">
					Hyperframe tidak ditemukan
				</div>
			</HTMLContainer>
		);
	}

	const width = Math.max(120, Number(shape.props.w) || 640);
	const height = Math.max(120, Number(shape.props.h) || 448);

	return (
		<HTMLContainer
			style={{
				pointerEvents: "all",
				overflow: "visible",
				width: `${width}px`,
				height: `${height}px`,
			}}
			onPointerDown={(e) => {
				// Isolate pointer events on interactive controls (buttons, inputs, iframe preview)
				// so interacting with them does not trigger tldraw shape drag or selection.
				// Clicking header or card background bubbles to tldraw to allow selecting and dragging the card.
				const target = e.target as HTMLElement | null;
				if (
					target?.closest(
						"button, input, select, textarea, [role='button'], .repurpose-card-actions, iframe",
					)
				) {
					e.stopPropagation();
				}
			}}
		>
			<div className="w-full h-full flex flex-col" style={{ width, height }}>
				<HyperframeCard
					hyperframe={hyperframe}
					activePlayingId={ctx.activePlayingId}
					displayHeight={360}
					onPlayingChange={(isPlaying) =>
						ctx.setActivePlayingId(isPlaying ? hyperframe.id : null)
					}
					onOpenEditor={ctx.onOpenHyperframeEditor}
					onRemove={ctx.onRemoveHyperframe}
					onDuplicate={ctx.onDuplicateHyperframe}
					onRename={ctx.onRenameHyperframe}
				/>
			</div>
		</HTMLContainer>
	);
}
