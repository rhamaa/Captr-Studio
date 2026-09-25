import {
	BookOpen,
	Check,
	Clock,
	Code,
	Copy,
	FileCode,
	FileCss,
	FileHtml,
	FileJs,
	UploadSimple,
} from "@phosphor-icons/react";
import React, { useRef, useState } from "react";
import { MotionGuideTab } from "./MotionGuideTab";

export type MotionEditorTab = "document" | "html" | "css" | "js" | "guide";

interface MotionCodeEditorProps {
	activeTab: MotionEditorTab;
	onChangeTab: (tab: MotionEditorTab) => void;
	documentCode?: string;
	htmlCode: string;
	cssCode: string;
	jsCode: string;
	durationMs?: number;
	onChangeDuration?: (ms: number) => void;
	onChangeDocument?: (val: string) => void;
	onChangeHtml: (val: string) => void;
	onChangeCss: (val: string) => void;
	onChangeJs: (val: string) => void;
	onResetStarter: () => void;
	onImportDocument?: (rawContent: string, fileName?: string) => void;
	autoReload: boolean;
	isSidebarMode?: boolean;
}

export const MotionCodeEditor: React.FC<MotionCodeEditorProps> = ({
	activeTab,
	onChangeTab,
	documentCode,
	htmlCode,
	cssCode,
	jsCode,
	durationMs = 5000,
	onChangeDuration,
	onChangeDocument,
	onChangeHtml,
	onChangeCss,
	onChangeJs,
	onResetStarter,
	onImportDocument,
	autoReload,
	isSidebarMode = false,
}) => {
	const [isCopied, setIsCopied] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const activeCodeValue =
		activeTab === "document"
			? (documentCode ?? "")
			: activeTab === "html"
				? htmlCode
				: activeTab === "css"
					? cssCode
					: jsCode;

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

			if (activeTab === "document") onChangeDocument?.(newVal);
			else if (activeTab === "html") onChangeHtml(newVal);
			else if (activeTab === "css") onChangeCss(newVal);
			else if (activeTab === "js") onChangeJs(newVal);
		}
	};

	const handleCopy = () => {
		navigator.clipboard.writeText(activeCodeValue);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 1800);
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			const content = event.target?.result as string;
			if (content) {
				onImportDocument?.(content, file.name);
			}
		};
		reader.readAsText(file);
		e.target.value = "";
	};

	return (
		<div
			className={`flex flex-col select-none ${
				isSidebarMode
					? "w-full h-full bg-editor-surface/95 dark:bg-slate-950"
					: "w-[480px] shrink-0 border-l border-slate-800 bg-slate-900"
			}`}
		>
			<input
				ref={fileInputRef}
				type="file"
				accept=".html,.htm"
				className="hidden"
				onChange={handleFileSelect}
			/>

			{/* Sub-toolbar: Quick Actions & Duration */}
			<div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-foreground/10 bg-foreground/[0.02]">
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-[#2563EB]/10 hover:bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/20 transition cursor-pointer"
						title="Import file HTML dari komputer"
					>
						<UploadSimple size={12} weight="bold" />
						<span>Import HTML</span>
					</button>

					<button
						type="button"
						onClick={onResetStarter}
						title="Kembalikan Kode ke Template Starter"
						className="px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 border border-foreground/10 transition cursor-pointer"
					>
						Reset
					</button>
				</div>

				{onChangeDuration && (
					<div className="flex items-center gap-1.5">
						<Clock size={12} className="text-muted-foreground" />
						<select
							value={durationMs}
							onChange={(e) => onChangeDuration(Number(e.target.value))}
							className="rounded-md border border-foreground/10 bg-editor-surface px-2 py-0.5 text-[11px] text-foreground font-medium outline-none focus:border-[#2563EB] cursor-pointer"
						>
							<option value={3000}>3 Detik</option>
							<option value={5000}>5 Detik</option>
							<option value={7000}>7 Detik</option>
							<option value={10000}>10 Detik</option>
							<option value={15000}>15 Detik</option>
							<option value={20000}>20 Detik</option>
							<option value={30000}>30 Detik</option>
						</select>
					</div>
				)}
			</div>

			{/* Tabs Navigation */}
			<div className="flex h-10 items-center justify-between border-b border-foreground/10 px-3 bg-editor-surface/80 shrink-0">
				<div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-1">
					<button
						type="button"
						onClick={() => onChangeTab("document")}
						className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
							activeTab === "document"
								? "bg-[#2563EB] text-white shadow-sm font-semibold"
								: "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
						}`}
						title="File HTML Utuh (HTML + CSS + JS dalam 1 codebase)"
					>
						<FileCode size={13} weight="bold" />
						<span>HTML Code</span>
					</button>

					<button
						type="button"
						onClick={() => onChangeTab("html")}
						className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
							activeTab === "html"
								? "bg-[#2563EB] text-white shadow-sm font-semibold"
								: "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
						}`}
						title="Body HTML saja"
					>
						<FileHtml size={13} weight="bold" />
						<span>Body</span>
					</button>

					<button
						type="button"
						onClick={() => onChangeTab("css")}
						className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
							activeTab === "css"
								? "bg-[#2563EB] text-white shadow-sm font-semibold"
								: "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
						}`}
						title="CSS Stylesheet saja"
					>
						<FileCss size={13} weight="bold" />
						<span>CSS</span>
					</button>

					<button
						type="button"
						onClick={() => onChangeTab("js")}
						className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
							activeTab === "js"
								? "bg-[#2563EB] text-white shadow-sm font-semibold"
								: "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
						}`}
						title="JavaScript Timeline Hook saja"
					>
						<FileJs size={13} weight="bold" />
						<span>JS</span>
					</button>

					<button
						type="button"
						onClick={() => onChangeTab("guide")}
						className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
							activeTab === "guide"
								? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
								: "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
						}`}
					>
						<BookOpen size={13} weight="bold" />
						<span>Guide</span>
					</button>
				</div>

				{/* Copy Action */}
				<div className="flex items-center gap-1">
					{activeTab !== "guide" && (
						<button
							type="button"
							onClick={handleCopy}
							title="Salin Kode Tab Ini"
							className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition cursor-pointer"
						>
							{isCopied ? (
								<Check size={14} className="text-emerald-500 font-bold" />
							) : (
								<Copy size={14} />
							)}
						</button>
					)}
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
								if (activeTab === "document") onChangeDocument?.(val);
								else if (activeTab === "html") onChangeHtml(val);
								else if (activeTab === "css") onChangeCss(val);
								else if (activeTab === "js") onChangeJs(val);
							}}
							onKeyDown={handleKeyDown}
							spellCheck={false}
							autoCapitalize="off"
							autoComplete="off"
							className="h-full w-full resize-none bg-slate-950 p-3 font-mono text-[12px] leading-relaxed text-slate-100 outline-none focus:ring-0 select-text scrollbar-thin scrollbar-thumb-slate-700"
							placeholder={
								activeTab === "document"
									? "Tulis atau paste kode file HTML utuh Anda (HTML + <style> + <script>)..."
									: `Masukkan kode ${activeTab.toUpperCase()} Anda di sini...`
							}
						/>
					</div>
				)}
			</div>

			{/* Editor Status Bar */}
			<div className="flex h-7 items-center justify-between border-t border-foreground/10 bg-slate-950 px-3 text-[10px] text-slate-400">
				<div className="flex items-center gap-2">
					<Code size={12} />
					<span className="uppercase">
						{activeTab === "document" ? "Single Codebase" : `${activeTab} Mode`}
					</span>
					<span>•</span>
					<span>{activeCodeValue.split("\n").length} Baris</span>
				</div>
				<div className="flex items-center gap-2">
					<span
						className={`inline-block h-1.5 w-1.5 rounded-full ${
							autoReload
								? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
								: "bg-slate-500"
						}`}
					/>
					<span className={autoReload ? "text-emerald-400" : "text-slate-400"}>
						{autoReload ? "Live Sync Active" : "Live Sync Off"}
					</span>
				</div>
			</div>
		</div>
	);
};
