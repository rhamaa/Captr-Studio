import { ArrowsClockwise, Lightning, UploadSimple } from "@phosphor-icons/react";
import React from "react";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import { useMotionSlideWorkspace } from "../hooks/useMotionSlideWorkspace";
import type { MotionSlideMeta } from "../schema";
import { MotionCodeEditor } from "./MotionCodeEditor";
import { MotionModeModal } from "./MotionModeModal";
import { MotionPreviewMonitor } from "./MotionPreviewMonitor";
import { MotionTimelineBar } from "./MotionTimelineBar";

export { parseHtmlFileContent } from "../motionDocument";

export const MotionSlideWorkspace: React.FC<SlideWorkspaceProps<MotionSlideMeta>> = (props) => {
	const workspace = useMotionSlideWorkspace(props);
	const {
		meta,
		showModeModal,
		setShowModeModal,
		sourceFileName,
		fileInputRef,
		activeTab,
		setActiveTab,
		htmlCode,
		setHtmlCode,
		cssCode,
		setCssCode,
		jsCode,
		setJsCode,
		autoReload,
		setAutoReload,
		compiledSrcDoc,
		isPlaying,
		setIsPlaying,
		currentTimeMs,
		setCurrentTimeMs,
		isLoop,
		setIsLoop,
		durationMs,
		iframeRef,
		targetAspect,
		handleSelectEditorMode,
		handleTriggerFileInput,
		handleFileChange,
		handleIframeLoad,
		handleManualReload,
		handleResetStarter,
		handleChangeDuration,
	} = workspace;

	return (
		<div className="flex h-full w-full bg-slate-950 text-slate-100 select-none overflow-hidden">
			<div className="flex flex-1 flex-col border-r border-slate-800/80 bg-slate-950 overflow-hidden">
				<div className="flex h-12 items-center justify-between border-b border-slate-800/80 px-4 bg-slate-900/60 backdrop-blur">
					<div className="flex items-center gap-2">
						<div className="flex h-6 w-6 items-center justify-center rounded bg-amber-500/20 text-amber-400">
							<Lightning size={15} weight="bold" />
						</div>
						<span className="text-xs font-semibold text-slate-200">Live Motion Preview</span>
						<span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono text-amber-400 border border-amber-500/20">
							HTML5
						</span>
						{sourceFileName && (
							<span
								className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300 border border-sky-500/20 truncate max-w-[150px]"
								title={sourceFileName}
							>
								📄 {sourceFileName}
							</span>
						)}
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleTriggerFileInput}
							title="Import file HTML dari komputer"
							className="flex items-center gap-1.5 rounded border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-xs text-sky-300 hover:bg-sky-500/25 hover:text-white transition shadow-xs cursor-pointer font-medium"
						>
							<UploadSimple size={13} weight="bold" />
							<span>Import HTML</span>
						</button>

						<button
							type="button"
							onClick={() => setShowModeModal(true)}
							title="Pilih template atau panduan animasi"
							className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/90 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition shadow-xs cursor-pointer"
						>
							<span>Template</span>
						</button>

						<div className="h-4 w-[1px] bg-slate-800" />

						<label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
							<input
								type="checkbox"
								checked={autoReload}
								onChange={(event) => setAutoReload(event.target.checked)}
								className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 accent-amber-500 cursor-pointer"
							/>
							<span className="text-[11px] text-slate-400">Auto-reload</span>
						</label>

						<button
							type="button"
							onClick={handleManualReload}
							title="Reload Preview Sandbox"
							className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 transition cursor-pointer"
						>
							<ArrowsClockwise size={13} weight="bold" />
							<span>Reload</span>
						</button>
					</div>
				</div>

				<div className="flex items-center justify-between gap-3 px-4 py-2 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/15 text-xs shrink-0">
					<div className="flex items-center gap-2 text-slate-300 min-w-0">
						<Lightning className="w-3.5 h-3.5 text-amber-400 shrink-0" weight="fill" />
						<span className="truncate text-[11px]">
							<strong className="text-amber-300 font-semibold">Motion Studio:</strong>{" "}
							Edit kode langsung di tab (HTML/CSS/JS), atau{" "}
							<button
								type="button"
								onClick={handleTriggerFileInput}
								className="underline text-sky-400 hover:text-sky-300 cursor-pointer font-medium"
							>
								upload file HTML
							</button>
							, atau{" "}
							<button
								type="button"
								onClick={() => setShowModeModal(true)}
								className="underline text-amber-400 hover:text-amber-300 cursor-pointer font-medium"
							>
								pilih template
							</button>
							.
						</span>
					</div>
					<button
						type="button"
						onClick={handleTriggerFileInput}
						className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 border border-sky-500/30 transition cursor-pointer"
					>
						<UploadSimple size={12} weight="bold" />
						<span>Upload HTML</span>
					</button>
				</div>

				<MotionPreviewMonitor
					iframeRef={iframeRef}
					srcDoc={compiledSrcDoc}
					aspectRatio={targetAspect}
					onIframeLoad={handleIframeLoad}
				/>

				<MotionTimelineBar
					currentTimeMs={currentTimeMs}
					durationMs={durationMs}
					isPlaying={isPlaying}
					isLoop={isLoop}
					onSeek={setCurrentTimeMs}
					onTogglePlay={() => setIsPlaying((playing) => !playing)}
					onRewind={() => setCurrentTimeMs(0)}
					onToggleLoop={() => setIsLoop((looping) => !looping)}
					onChangeDuration={handleChangeDuration}
				/>
			</div>

			<MotionCodeEditor
				activeTab={activeTab}
				onChangeTab={setActiveTab}
				htmlCode={htmlCode}
				cssCode={cssCode}
				jsCode={jsCode}
				onChangeHtml={setHtmlCode}
				onChangeCss={setCssCode}
				onChangeJs={setJsCode}
				onResetStarter={handleResetStarter}
				autoReload={autoReload}
			/>

			<MotionModeModal
				isOpen={showModeModal}
				hasSelectedModeBefore={Boolean(meta.modeSelected)}
				onSelectEditor={handleSelectEditorMode}
				onTriggerImport={handleTriggerFileInput}
				onClose={() => setShowModeModal(false)}
			/>

			<input
				ref={fileInputRef}
				type="file"
				accept=".html,.htm"
				onChange={handleFileChange}
				className="hidden"
			/>
		</div>
	);
};
