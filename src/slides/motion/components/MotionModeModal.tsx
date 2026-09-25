import { Code, Lightning, UploadSimple, X } from "@phosphor-icons/react";
import React from "react";

interface MotionModeModalProps {
	isOpen: boolean;
	hasSelectedModeBefore: boolean;
	onSelectEditor: () => void;
	onTriggerImport: () => void;
	onClose: () => void;
}

export const MotionModeModal: React.FC<MotionModeModalProps> = ({
	isOpen,
	hasSelectedModeBefore,
	onSelectEditor,
	onTriggerImport,
	onClose,
}) => {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
			<div className="relative w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-200 overflow-hidden">
				{/* Ambient Glow */}
				<div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

				{/* Header */}
				<div className="flex items-start justify-between pb-4 border-b border-slate-800">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
							<Lightning size={22} weight="bold" />
						</div>
						<div>
							<h3 className="text-base font-bold text-white">Mulai Slide Motion</h3>
							<p className="text-xs text-slate-400 mt-0.5">
								Pilih bagaimana Anda ingin memulai slide animasi HTML ini:
							</p>
						</div>
					</div>
					{hasSelectedModeBefore && (
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition cursor-pointer"
						>
							<X size={16} />
						</button>
					)}
				</div>

				{/* Options Grid */}
				<div className="grid grid-cols-2 gap-3.5 my-5">
					{/* Option 1: Langsung di Editor */}
					<button
						type="button"
						onClick={onSelectEditor}
						className="group relative flex flex-col justify-between rounded-xl border border-slate-700/80 bg-slate-800/40 p-4 text-left transition hover:border-amber-500/60 hover:bg-amber-500/5 cursor-pointer shadow-sm"
					>
						<div>
							<div className="flex items-center justify-between mb-2.5">
								<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform">
									<Code size={18} weight="bold" />
								</div>
								<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
									INTERAKTIF
								</span>
							</div>
							<h4 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
								Langsung di Editor
							</h4>
							<p className="text-xs text-slate-400 mt-1 leading-relaxed">
								Mulai dengan Starter Template. Tulis kode HTML, CSS & JS langsung
								dengan auto-reload dan timeline control.
							</p>
						</div>
						<div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-amber-400 group-hover:translate-x-0.5 transition-transform">
							<span>Buka Code Editor</span>
							<span>→</span>
						</div>
					</button>

					{/* Option 2: Parsing dari File HTML */}
					<button
						type="button"
						onClick={onTriggerImport}
						className="group relative flex flex-col justify-between rounded-xl border border-slate-700/80 bg-slate-800/40 p-4 text-left transition hover:border-sky-500/60 hover:bg-sky-500/5 cursor-pointer shadow-sm"
					>
						<div>
							<div className="flex items-center justify-between mb-2.5">
								<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 group-hover:scale-105 transition-transform">
									<UploadSimple size={18} weight="bold" />
								</div>
								<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/20">
									IMPORT FILE
								</span>
							</div>
							<h4 className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors">
								Parsing dari File HTML
							</h4>
							<p className="text-xs text-slate-400 mt-1 leading-relaxed">
								Pilih file .html yang sudah ada. Captr Studio otomatis mengekstrak
								&lt;style&gt;, &lt;script&gt;, dan elemen body ke workspace.
							</p>
						</div>
						<div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-sky-400 group-hover:translate-x-0.5 transition-transform">
							<span>Pilih File HTML...</span>
							<span>→</span>
						</div>
					</button>
				</div>

				{/* Footer Note */}
				<div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px] text-slate-500">
					<span>Anda dapat berganti mode atau mengimpor file lain kapan saja.</span>
					{hasSelectedModeBefore && (
						<button
							type="button"
							onClick={onClose}
							className="text-slate-400 hover:text-slate-200 cursor-pointer"
						>
							Tutup
						</button>
					)}
				</div>
			</div>
		</div>
	);
};
