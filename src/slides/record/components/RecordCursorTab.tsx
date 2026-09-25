import { CursorClick } from "@phosphor-icons/react";
import React from "react";
import type { CursorStyle } from "@/components/video-editor/types";
import { CURSOR_STYLES } from "./recordConstants";

export interface RecordCursorTabProps {
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
}

export const RecordCursorTab: React.FC<RecordCursorTabProps> = ({
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
}) => {
	return (
		<div className="flex flex-col gap-4">
			{/* Cursor toggle */}
			<div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-3">
				<div className="flex items-center gap-2 text-xs font-semibold text-white">
					<CursorClick size={16} className="text-blue-400" />
					<span>Tampilkan Kursor</span>
				</div>
				<button
					type="button"
					onClick={onToggleShowCursor}
					className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
						showCursor
							? "bg-blue-600 text-white"
							: "bg-slate-800 text-slate-400 border border-slate-700"
					}`}
				>
					{showCursor ? "ON" : "OFF"}
				</button>
			</div>

			{/* Cursor Style */}
			<div>
				<div className="text-[11px] text-slate-400 mb-1.5">Gaya Kursor</div>
				<div className="grid grid-cols-2 gap-1.5">
					{CURSOR_STYLES.map((st) => (
						<button
							key={st.id}
							type="button"
							onClick={() => onUpdateCursorStyle(st.id)}
							className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
								cursorStyle === st.id
									? "border-blue-500 bg-blue-500/10 text-white"
									: "border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700"
							}`}
						>
							{st.label}
						</button>
					))}
				</div>
			</div>

			{/* Cursor Smoothing Slider */}
			<div>
				<div className="flex justify-between text-[11px] text-slate-400 mb-1">
					<span>Spring Smoothing</span>
					<span className="font-mono text-white">
						{Math.round(cursorSmoothing * 100)}%
					</span>
				</div>
				<input
					type="range"
					min="0.1"
					max="1.0"
					step="0.05"
					value={cursorSmoothing}
					onChange={(e) => onUpdateCursorSmoothing(Number(e.target.value))}
					className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
				/>
			</div>

			{/* Cursor Scale Slider */}
			<div>
				<div className="flex justify-between text-[11px] text-slate-400 mb-1">
					<span>Ukuran Kursor</span>
					<span className="font-mono text-white">{cursorSize.toFixed(1)}x</span>
				</div>
				<input
					type="range"
					min="1.0"
					max="4.0"
					step="0.2"
					value={cursorSize}
					onChange={(e) => onUpdateCursorSize(Number(e.target.value))}
					className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
				/>
			</div>

			{/* Click Bounce Slider */}
			<div>
				<div className="flex justify-between text-[11px] text-slate-400 mb-1">
					<span>Click Bounce Effect</span>
					<span className="font-mono text-white">{cursorClickBounce.toFixed(1)}</span>
				</div>
				<input
					type="range"
					min="0"
					max="5.0"
					step="0.5"
					value={cursorClickBounce}
					onChange={(e) => onUpdateCursorClickBounce(Number(e.target.value))}
					className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
				/>
			</div>
		</div>
	);
};
