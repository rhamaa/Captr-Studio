import React from "react";
import type {
	CursorStyle,
	WebcamCorner,
	WebcamOverlaySettings,
	WebcamPositionPreset,
	ZoomDepth,
	ZoomRegion,
} from "@/components/video-editor/types";
import { RecordCameraTab } from "./RecordCameraTab";
import { RecordCanvasTab } from "./RecordCanvasTab";
import { RecordCursorTab } from "./RecordCursorTab";
import { RecordWebcamTab } from "./RecordWebcamTab";
import { RecordZoomTab } from "./RecordZoomTab";

export type RecordInspectorTab = "zoom" | "cursor" | "camera" | "canvas" | "webcam";

export interface RecordInspectorPanelProps {
	title: string;
	onUpdateTitle?: (title: string) => void;
	activeTab: RecordInspectorTab;
	onSelectTab: (tab: RecordInspectorTab) => void;

	// Zoom Tab Props
	zoomRegions: ZoomRegion[];
	selectedZoomId: string | null;
	connectZooms: boolean;
	hasVideo: boolean;
	onAutoSuggestZooms: () => void;
	onToggleConnectZooms: () => void;
	onSelectZoom: (id: string) => void;
	onSeekToZoom: (startMs: number, id: string) => void;
	onDeleteZoom: (id: string) => void;
	onUpdateZoomDepth: (id: string, depth: ZoomDepth) => void;

	// Cursor Tab Props
	showCursor: boolean;
	cursorStyle: CursorStyle;
	cursorSmoothing: number;
	cursorSize: number;
	cursorClickBounce: number;
	onToggleShowCursor: () => void;
	onUpdateCursorStyle: (style: CursorStyle) => void;
	onUpdateCursorSmoothing: (val: number) => void;
	onUpdateCursorSize: (val: number) => void;
	onUpdateCursorClickBounce: (val: number) => void;

	// Camera Tab Props
	cameraPerspectiveTilt: number;
	zoomMotionBlur: number;
	onUpdateCameraPerspectiveTilt: (val: number) => void;
	onUpdateZoomMotionBlur: (val: number) => void;

	// Canvas Tab Props
	frame: string | null;
	wallpaper: string;
	borderRadius: number;
	shadowIntensity: number;
	onUpdateFrame: (frame: string | null) => void;
	onUpdateWallpaper: (wallpaper: string) => void;
	onUpdateBorderRadius: (radius: number) => void;
	onUpdateShadowIntensity: (intensity: number) => void;

	// Webcam Tab Props
	webcam: WebcamOverlaySettings | undefined;
	isWebcamDodging: boolean;
	dodgedToPreset: WebcamPositionPreset | null;
	onToggleWebcam: () => void;
	onSelectCorner: (corner: WebcamCorner) => void;
	onToggleAutoDodge: () => void;
	onSelectShapeRadius: (radius: number) => void;
	onUpdateSize: (size: number) => void;
	onToggleMirror: () => void;
	onPickWebcamSource: () => void;
	onClearWebcamSource: () => void;
}

export const RecordInspectorPanel: React.FC<RecordInspectorPanelProps> = ({
	title,
	onUpdateTitle,
	activeTab,
	onSelectTab,

	// Zoom
	zoomRegions,
	selectedZoomId,
	connectZooms,
	hasVideo,
	onAutoSuggestZooms,
	onToggleConnectZooms,
	onSelectZoom,
	onSeekToZoom,
	onDeleteZoom,
	onUpdateZoomDepth,

	// Cursor
	showCursor,
	cursorStyle,
	cursorSmoothing,
	cursorSize,
	cursorClickBounce,
	onToggleShowCursor,
	onUpdateCursorStyle,
	onUpdateCursorSmoothing,
	onUpdateCursorSize,
	onUpdateCursorClickBounce,

	// Camera
	cameraPerspectiveTilt,
	zoomMotionBlur,
	onUpdateCameraPerspectiveTilt,
	onUpdateZoomMotionBlur,

	// Canvas
	frame,
	wallpaper,
	borderRadius,
	shadowIntensity,
	onUpdateFrame,
	onUpdateWallpaper,
	onUpdateBorderRadius,
	onUpdateShadowIntensity,

	// Webcam
	webcam,
	isWebcamDodging,
	dodgedToPreset,
	onToggleWebcam,
	onSelectCorner,
	onToggleAutoDodge,
	onSelectShapeRadius,
	onUpdateSize,
	onToggleMirror,
	onPickWebcamSource,
	onClearWebcamSource,
}) => {
	return (
		<div className="w-80 border-l border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-4 overflow-y-auto backdrop-blur-md">
			{/* Slide Title Section */}
			<div>
				<div className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
					Screen Studio Inspector
				</div>
				<input
					type="text"
					value={title}
					onChange={(e) => onUpdateTitle?.(e.target.value)}
					className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none transition-colors"
					placeholder="Judul Slide"
				/>
			</div>

			{/* Tab Navigation */}
			<div className="grid grid-cols-5 gap-1 p-1 bg-slate-800/70 rounded-xl border border-slate-700/60 text-xs font-medium">
				{(["zoom", "cursor", "camera", "canvas", "webcam"] as RecordInspectorTab[]).map(
					(tab) => {
						const label =
							tab === "zoom"
								? "Zoom"
								: tab === "cursor"
									? "Cursor"
									: tab === "camera"
										? "3D"
										: tab === "canvas"
											? "Canvas"
											: "Webcam";
						const isActive = activeTab === tab;
						return (
							<button
								key={tab}
								type="button"
								onClick={() => onSelectTab(tab)}
								className={`py-1 rounded-lg text-center transition-all cursor-pointer ${
									isActive
										? "bg-emerald-600 text-white shadow-sm font-semibold"
										: "text-slate-400 hover:text-white"
								}`}
							>
								{label}
							</button>
						);
					},
				)}
			</div>

			{/* TAB CONTENT */}
			{activeTab === "zoom" && (
				<RecordZoomTab
					zoomRegions={zoomRegions}
					selectedZoomId={selectedZoomId}
					connectZooms={connectZooms}
					hasVideo={hasVideo}
					onAutoSuggestZooms={onAutoSuggestZooms}
					onToggleConnectZooms={onToggleConnectZooms}
					onSelectZoom={onSelectZoom}
					onSeekToZoom={onSeekToZoom}
					onDeleteZoom={onDeleteZoom}
					onUpdateZoomDepth={onUpdateZoomDepth}
				/>
			)}

			{activeTab === "cursor" && (
				<RecordCursorTab
					showCursor={showCursor}
					cursorStyle={cursorStyle}
					cursorSmoothing={cursorSmoothing}
					cursorSize={cursorSize}
					cursorClickBounce={cursorClickBounce}
					onToggleShowCursor={onToggleShowCursor}
					onUpdateCursorStyle={onUpdateCursorStyle}
					onUpdateCursorSmoothing={onUpdateCursorSmoothing}
					onUpdateCursorSize={onUpdateCursorSize}
					onUpdateCursorClickBounce={onUpdateCursorClickBounce}
				/>
			)}

			{activeTab === "camera" && (
				<RecordCameraTab
					cameraPerspectiveTilt={cameraPerspectiveTilt}
					zoomMotionBlur={zoomMotionBlur}
					onUpdateCameraPerspectiveTilt={onUpdateCameraPerspectiveTilt}
					onUpdateZoomMotionBlur={onUpdateZoomMotionBlur}
				/>
			)}

			{activeTab === "canvas" && (
				<RecordCanvasTab
					frame={frame}
					wallpaper={wallpaper}
					borderRadius={borderRadius}
					shadowIntensity={shadowIntensity}
					onUpdateFrame={onUpdateFrame}
					onUpdateWallpaper={onUpdateWallpaper}
					onUpdateBorderRadius={onUpdateBorderRadius}
					onUpdateShadowIntensity={onUpdateShadowIntensity}
				/>
			)}

			{activeTab === "webcam" && (
				<RecordWebcamTab
					webcam={webcam}
					isWebcamDodging={isWebcamDodging}
					dodgedToPreset={dodgedToPreset}
					onToggleWebcam={onToggleWebcam}
					onSelectCorner={onSelectCorner}
					onToggleAutoDodge={onToggleAutoDodge}
					onSelectShapeRadius={onSelectShapeRadius}
					onUpdateSize={onUpdateSize}
					onToggleMirror={onToggleMirror}
					onPickWebcamSource={onPickWebcamSource}
					onClearWebcamSource={onClearWebcamSource}
				/>
			)}
		</div>
	);
};
