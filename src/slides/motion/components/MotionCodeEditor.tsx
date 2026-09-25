import { BookOpen, Check, Code, Copy, FileCss, FileHtml, FileJs } from "@phosphor-icons/react";
import React, { useState } from "react";
import { MotionGuideTab } from "./MotionGuideTab";

export type MotionEditorTab = "html" | "css" | "js" | "guide";

interface MotionCodeEditorProps {
	activeTab: MotionEditorTab;
	onChangeTab: (tab: MotionEditorTab) => void;
	htmlCode: string;
	cssCode: string;
	jsCode: string;
	onChangeHtml: (val: string) => void;
	onChangeCss: (val: string) => void;
	onChangeJs: (val: string) => void;
	onResetStarter: () => void;
	autoReload: boolean;
}

export const MotionCodeEditor: React.FC<MotionCodeEditorProps> = ({
	activeTab,
	onChangeTab,
	htmlCode,
	cssCode,
	jsCode,
	onChangeHtml,
	onChangeCss,
	onChangeJs,
	onResetStarter,
	autoReload,
}) => {
	const [isCopied, setIsCopied] = useState(false);

	const activeCodeValue =
		activeTab === "html" ? htmlCode : activeTab === "css" ? cssCode : jsCode;

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Tab") {
			e.preventDefault();
			const target = e.currentTarget;
			const start = target.selectionStart;
			const end = target.selectionEnd;
			const val = target.value;

			const newVal = `${val.substring(0, start)}  ${val.substring(end)}`;
			target.value = newVal;
			target.selectionStart = target.selectionEnd = start + 2;

			if (activeTab === "html") onChangeHtml(newVal);
			else if (activeTab === "css") onChangeCss(newVal);
			else if (activeTab === "js") onChangeJs(newVal);
		}
	};

	const handleCopy = () => {
		navigator.clipboard.writeText(activeCodeValue);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 1800);
	};

	return (
		<div className="flex w-[480px] shrink-0 flex-col bg-slate-900 border-l border-slate-800 select-none">
			{/* Tabs Navigation */}
			<div className="flex h-12 items-center justify-between border-b border-slate-800 px-3 bg-slate-900/90">
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => onChangeTab("html")}
						className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
							activeTab === "html"
								? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
								: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
						}`}
					>
						<FileHtml size={14} weight="bold" />
						<span>HTML</span>
					</button>

					<button
						type="button"
						onClick={() => onChangeTab("css")}
						className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
							activeTab === "css"
								? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
								: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
						}`}
					>
						<FileCss size={14} weight="bold" />
						<span>CSS</span>
					</button>

					<button
						type="button"
						onClick={() => onChangeTab("js")}
						className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
							activeTab === "js"
								? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
								: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
						}`}
					>
						<FileJs size={14} weight="bold" />
						<span>JS</span>
					</button>

					<button
						type="button"
						onClick={() => onChangeTab("guide")}
						className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
							activeTab === "guide"
								? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
								: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
						}`}
					>
						<BookOpen size={14} weight="bold" />
						<span>Panduan</span>
					</button>
				</div>

				{/* Copy / Reset Actions */}
				<div className="flex items-center gap-1">
					{activeTab !== "guide" && (
						<button
							type="button"
							onClick={handleCopy}
							title="Salin Kode Tab Ini"
							className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition cursor-pointer"
						>
							{isCopied ? (
								<Check size={14} className="text-emerald-400" />
							) : (
								<Copy size={14} />
							)}
						</button>
					)}

					<button
						type="button"
						onClick={onResetStarter}
						title="Kembalikan Template ke Starter Awal"
						className="rounded border border-slate-700/80 bg-slate-800/80 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
					>
						Reset Starter
					</button>
				</div>
			</div>

			{/* Code Editor Body */}
			<div className="relative flex flex-1 flex-col overflow-hidden bg-slate-950 font-mono text-xs">
				{activeTab === "guide" ? (
					<MotionGuideTab />
				) : (
					<div className="relative flex-1 flex flex-col h-full overflow-hidden">
						<textarea
							value={activeCodeValue}
							onChange={(e) => {
								const val = e.target.value;
								if (activeTab === "html") onChangeHtml(val);
								else if (activeTab === "css") onChangeCss(val);
								else if (activeTab === "js") onChangeJs(val);
							}}
							onKeyDown={handleKeyDown}
							spellCheck={false}
							autoCapitalize="off"
							autoComplete="off"
							className="h-full w-full resize-none bg-slate-950 p-4 font-mono text-[12px] leading-relaxed text-slate-200 outline-none focus:ring-0 select-text scrollbar-thin scrollbar-thumb-slate-700"
							placeholder={`Masukkan kode ${activeTab.toUpperCase()} Anda di sini...`}
						/>
					</div>
				)}
			</div>

			{/* Editor Status Bar */}
			<div className="flex h-7 items-center justify-between border-t border-slate-800 bg-slate-950 px-3 text-[10px] text-slate-500">
				<div className="flex items-center gap-2">
					<Code size={12} />
					<span className="uppercase">{activeTab} Mode</span>
					<span>•</span>
					<span>{activeCodeValue.split("\n").length} Baris</span>
				</div>
				<div className="flex items-center gap-2">
					<span
						className={`inline-block h-1.5 w-1.5 rounded-full ${
							autoReload ? "bg-emerald-500" : "bg-slate-500"
						}`}
					/>
					<span className={autoReload ? "text-emerald-400" : "text-slate-400"}>
						{autoReload ? "Auto-Reload Active" : "Auto-Reload Off"}
					</span>
				</div>
			</div>
		</div>
	);
};
