import { Trash, UploadSimple, UserSquare } from "@phosphor-icons/react";
import React from "react";
import type {
	WebcamCorner,
	WebcamOverlaySettings,
	WebcamPositionPreset,
} from "@/components/video-editor/types";

export interface RecordWebcamTabProps {
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

export const RecordWebcamTab: React.FC<RecordWebcamTabProps> = ({
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
	const isEnabled = webcam?.enabled ?? false;

	return (
		<div className="flex flex-col gap-4">
			{/* Master PiP Toggle */}
			<div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-3">
				<div className="flex items-center gap-2 text-xs font-semibold text-white">
					<UserSquare size={16} className="text-emerald-400" />
					<span>Webcam PiP</span>
				</div>
				<button
					type="button"
					onClick={onToggleWebcam}
					className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
						isEnabled
							? "bg-emerald-600 text-white"
							: "bg-slate-800 text-slate-400 border border-slate-700"
					}`}
				>
					{isEnabled ? "ON" : "OFF"}
				</button>
			</div>

			{isEnabled && (
				<div className="space-y-4">
					{/* Base Corner Position Selection */}
					<div>
						<div className="text-[11px] text-slate-400 mb-1.5 font-medium">
							Posisi Dasar PiP
						</div>
						<div className="grid grid-cols-2 gap-1.5">
							{[
								{ id: "top-left", label: "Top Left" },
								{ id: "top-right", label: "Top Right" },
								{ id: "bottom-left", label: "Bottom Left" },
								{ id: "bottom-right", label: "Bottom Right" },
							].map((corner) => {
								const currentCorner =
									webcam?.positionPreset ?? webcam?.corner ?? "bottom-right";
								const isSelected = currentCorner === corner.id;
								return (
									<button
										key={corner.id}
										type="button"
										onClick={() => onSelectCorner(corner.id as WebcamCorner)}
										className={`py-1.5 px-2 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
											isSelected
												? "border-emerald-500 bg-emerald-500/15 text-white shadow-sm"
												: "border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white hover:border-slate-700"
										}`}
									>
										{corner.label}
									</button>
								);
							})}
						</div>
					</div>

					{/* Webcam Auto-Dodge Zoom Collision Guard */}
					<div className="p-3 rounded-xl border border-slate-800 bg-slate-800/40 flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-xs font-semibold text-white flex items-center gap-1.5">
									<span>Auto-Dodge Zoom</span>
								</div>
								<div className="text-[10px] text-slate-400">
									Pindah sudut otomatis saat zoom
								</div>
							</div>
							<button
								type="button"
								onClick={onToggleAutoDodge}
								className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
									webcam?.reactToZoom !== false
										? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
										: "bg-slate-800 text-slate-500 border border-slate-700"
								}`}
							>
								{webcam?.reactToZoom !== false ? "ON" : "OFF"}
							</button>
						</div>

						{/* Real-time Dodge Status Indicator */}
						{isWebcamDodging ? (
							<div className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-500/15 px-2.5 py-1.5 rounded-lg border border-amber-500/30 font-medium">
								<span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
								<span>
									Menghindar dari fokus zoom: dipindah ke{" "}
									<strong className="text-amber-200 uppercase">
										{dodgedToPreset}
									</strong>
								</span>
							</div>
						) : webcam?.reactToZoom !== false ? (
							<div className="text-[10px] text-slate-500 leading-tight">
								Webcam otomatis meluncur ke sudut lain jika playhead memasuki zoom
								di sudut yang sama.
							</div>
						) : null}
					</div>

					{/* PiP Shape / Corner Radius */}
					<div>
						<div className="text-[11px] text-slate-400 mb-1.5 font-medium">
							Bentuk PiP
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{[
								{ label: "Squircle", radius: 24 },
								{ label: "Circle", radius: 50 },
								{ label: "Rounded", radius: 12 },
							].map((shape) => {
								const currentRad = webcam?.cornerRadius ?? 50;
								const isSelected = Math.abs(currentRad - shape.radius) < 6;
								return (
									<button
										key={shape.label}
										type="button"
										onClick={() => onSelectShapeRadius(shape.radius)}
										className={`py-1 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
											isSelected
												? "border-emerald-500 bg-emerald-500/15 text-white"
												: "border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white"
										}`}
									>
										{shape.label}
									</button>
								);
							})}
						</div>
					</div>

					{/* PiP Size Slider */}
					<div>
						<div className="flex justify-between text-[11px] text-slate-400 mb-1">
							<span>Ukuran PiP</span>
							<span className="font-mono text-white">
								{Math.round(webcam?.size ?? 25)}%
							</span>
						</div>
						<input
							type="range"
							min="15"
							max="45"
							step="2"
							value={webcam?.size ?? 25}
							onChange={(e) => onUpdateSize(Number(e.target.value))}
							className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
						/>
					</div>

					{/* Mirror PiP Toggle */}
					<div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-800/40">
						<div className="text-xs font-medium text-white">Mirror Kamera PiP</div>
						<button
							type="button"
							onClick={onToggleMirror}
							className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
								webcam?.mirror !== false
									? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
									: "bg-slate-800 text-slate-500"
							}`}
						>
							{webcam?.mirror !== false ? "ON" : "OFF"}
						</button>
					</div>

					{/* Webcam Video Source Picker */}
					<div className="pt-1">
						<div className="text-[11px] text-slate-400 mb-1.5 font-medium">
							File Rekaman Kamera
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={onPickWebcamSource}
								className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
							>
								<UploadSimple size={13} />
								<span>
									{webcam?.sourcePath ? "Ganti File PiP" : "Pilih File Webcam"}
								</span>
							</button>
							{webcam?.sourcePath && (
								<button
									type="button"
									onClick={onClearWebcamSource}
									className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
									title="Hapus file webcam terpisah"
								>
									<Trash size={13} />
								</button>
							)}
						</div>
						{webcam?.sourcePath && (
							<div className="mt-1 text-[10px] text-slate-500 font-mono truncate">
								{webcam.sourcePath.split(/[/\\]/).pop()}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
