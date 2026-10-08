import {
	BaseBoxShapeUtil,
	HTMLContainer,
	Rectangle2d,
	T,
	type TLBaseShape,
} from "@tldraw/tldraw";
import { useWhiteboardContext } from "../WhiteboardContext";
import { RepurposeArtboardCard } from "../../RepurposeArtboardCard";

export const ARTBOARD_CARD_SHAPE_TYPE = "artboard-card" as const;

export type ArtboardCardShape = TLBaseShape<
	typeof ARTBOARD_CARD_SHAPE_TYPE,
	{
		artboardId: string;
		w: number;
		h: number;
	}
>;

export class ArtboardCardShapeUtil extends BaseBoxShapeUtil<any> {
	static override type = ARTBOARD_CARD_SHAPE_TYPE;
	static override props = {
		artboardId: T.string,
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

	override getDefaultProps(): ArtboardCardShape["props"] {
		return {
			artboardId: "",
			w: 202,
			h: 448,
		};
	}

	override getGeometry(shape: ArtboardCardShape) {
		const w = Math.max(120, Number(shape.props.w) || 202);
		const h = Math.max(120, Number(shape.props.h) || 448);
		return new Rectangle2d({
			width: w,
			height: h,
			isFilled: true,
		});
	}

	override getIndicatorPath(shape: ArtboardCardShape) {
		const w = Math.max(120, Number(shape.props.w) || 202);
		const h = Math.max(120, Number(shape.props.h) || 448);
		const path = new Path2D();
		path.rect(0, 0, w, h);
		return path;
	}

	override component(shape: ArtboardCardShape) {
		return <ArtboardCardComponent shape={shape} />;
	}

	override indicator(shape: ArtboardCardShape) {
		const w = Math.max(120, Number(shape.props.w) || 202);
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

function ArtboardCardComponent({ shape }: { shape: ArtboardCardShape }) {
	const ctx = useWhiteboardContext();
	const artboardId = shape.props.artboardId;

	const artboard = ctx?.boardProject?.repurposeBoard?.artboards.find(
		(a) => a.id === artboardId,
	);

	if (!ctx || !artboard) {
		return (
			<HTMLContainer style={{ pointerEvents: "all" }}>
				<div className="flex h-full w-full select-none items-center justify-center rounded-2xl border border-white/10 bg-[#15171C] p-4 text-xs text-zinc-400">
					Artboard tidak ditemukan
				</div>
			</HTMLContainer>
		);
	}

	const artboardProject = ctx.artboardProjectViews.get(artboardId);
	const width = Math.max(120, Number(shape.props.w) || 202);
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
				// Isolate pointer events on interactive controls (buttons, inputs, scrubber, camera framing viewport)
				// so interacting with them does not trigger tldraw shape drag or selection.
				// Clicking header or card background bubbles to tldraw to allow selecting and dragging the card.
				const target = e.target as HTMLElement | null;
				if (
					target?.closest(
						"button, input, select, textarea, [role='button'], .repurpose-card-actions, .repurpose-card-scrubber, .repurpose-card-viewport",
					)
				) {
					e.stopPropagation();
				}
			}}
		>
			<div className="w-full h-full flex flex-col" style={{ width, height }}>
				<RepurposeArtboardCard
					artboard={artboard}
					rootProject={ctx.boardProject}
					artboardProject={artboardProject}
					activePlayingId={ctx.activePlayingId}
					displayHeight={360}
					onPlayingChange={(isPlaying) =>
						ctx.setActivePlayingId(isPlaying ? artboard.id : null)
					}
					onOpenArtboardEditor={ctx.onOpenArtboardEditor}
					onUpdateFraming={(patch) => ctx.onUpdateFraming(artboard.id, patch)}
					onResetFraming={() => ctx.onResetFraming(artboard.id)}
					onRemove={() => ctx.onRemoveArtboard(artboard.id)}
					onDuplicate={() => ctx.onDuplicateArtboard(artboard.id)}
					onRename={(newName) => ctx.onRenameArtboard(artboard.id, newName)}
					onDropAsset={(assetId) => ctx.onDropAsset?.(artboard.id, assetId)}
				/>
			</div>
		</HTMLContainer>
	);
}
