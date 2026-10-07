import { BaseBoxShapeUtil, HTMLContainer, T, type TLBaseShape } from "@tldraw/tldraw";
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

	override getDefaultProps(): ArtboardCardShape["props"] {
		return {
			artboardId: "",
			w: 202,
			h: 448,
		};
	}

	override getIndicatorPath(shape: ArtboardCardShape) {
		const path = new Path2D();
		path.rect(0, 0, shape.props.w, shape.props.h);
		return path;
	}

	override component(shape: ArtboardCardShape) {
		return <ArtboardCardComponent shape={shape} />;
	}

	override indicator(shape: ArtboardCardShape) {
		return (
			<rect
				width={shape.props.w}
				height={shape.props.h}
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

	return (
		<HTMLContainer
			style={{
				pointerEvents: "all",
				overflow: "visible",
				width: `${shape.props.w}px`,
				height: `${shape.props.h}px`,
			}}
			onPointerDown={(e) => {
				// Prevent canvas selection/pan when interacting directly with card controls
				e.stopPropagation();
			}}
		>
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
		</HTMLContainer>
	);
}
