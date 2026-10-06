import {
	FilmStrip,
	Image as ImageIcon,
	MusicNote,
	Tag,
	TextT,
	X,
} from "@phosphor-icons/react";
import { type ChangeEvent, type KeyboardEvent, useRef, useState } from "react";
import type { MediaAsset } from "@/core/timeline/types";

export interface HyperframePromptInputProps {
	value: string;
	onChange: (value: string) => void;
	assets: MediaAsset[];
	taggedAssets: MediaAsset[];
	onTaggedAssetsChange: (assets: MediaAsset[]) => void;
	placeholder?: string;
	disabled?: boolean;
	onSubmit?: () => void;
}

export function HyperframePromptInput({
	value,
	onChange,
	assets,
	taggedAssets,
	onTaggedAssetsChange,
	placeholder = "Describe animation, layout, or modifications (type @ to tag project assets)...",
	disabled = false,
	onSubmit,
}: HyperframePromptInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const dropdownRef = useRef<HTMLDivElement | null>(null);

	const [showSuggestions, setShowSuggestions] = useState(false);
	const [mentionQuery, setMentionQuery] = useState("");
	const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
	const [selectedIndex, setSelectedIndex] = useState(0);

	// Filter assets matching the query
	const filteredAssets = assets.filter((asset) => {
		if (!mentionQuery) return true;
		return (
			asset.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
			asset.kind.toLowerCase().includes(mentionQuery.toLowerCase())
		);
	});

	// Check if cursor is right after an '@' mention
	const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value;
		onChange(newValue);

		const cursor = e.target.selectionStart ?? newValue.length;
		const textBeforeCursor = newValue.slice(0, cursor);
		const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\-.]*)$/);

		if (atMatch) {
			setMentionQuery(atMatch[1]);
			setMentionStartIndex(cursor - atMatch[0].length);
			setShowSuggestions(true);
			setSelectedIndex(0);
		} else {
			setShowSuggestions(false);
		}
	};

	const handleSelectAsset = (asset: MediaAsset) => {
		const textarea = textareaRef.current;
		const currentText = value;
		let updatedText = currentText;

		if (mentionStartIndex >= 0 && textarea) {
			const cursor = textarea.selectionStart ?? currentText.length;
			const before = currentText.slice(0, mentionStartIndex);
			const after = currentText.slice(cursor);
			updatedText = `${before}@${asset.name} ${after}`;
		} else {
			updatedText = currentText ? `${currentText} @${asset.name} ` : `@${asset.name} `;
		}

		onChange(updatedText);
		setShowSuggestions(false);

		// Add to tagged assets list if not already present
		if (!taggedAssets.some((a) => a.id === asset.id)) {
			onTaggedAssetsChange([...taggedAssets, asset]);
		}

		textarea?.focus();
	};

	const handleRemoveTaggedAsset = (assetId: string) => {
		onTaggedAssetsChange(taggedAssets.filter((a) => a.id !== assetId));
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (showSuggestions && filteredAssets.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev + 1) % filteredAssets.length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev - 1 + filteredAssets.length) % filteredAssets.length);
				return;
			}
			if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault();
				handleSelectAsset(filteredAssets[selectedIndex]);
				return;
			}
			if (e.key === "Escape") {
				e.preventDefault();
				setShowSuggestions(false);
				return;
			}
		}

		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			onSubmit?.();
		}
	};

	const getAssetIcon = (kind: MediaAsset["kind"]) => {
		switch (kind) {
			case "video":
			case "recording":
				return <FilmStrip size={14} className="text-[#6FA8FF]" />;
			case "image":
				return <ImageIcon size={14} className="text-[#8DDB9B]" />;
			case "audio":
				return <MusicNote size={14} className="text-[#A879F5]" />;
			case "text":
				return <TextT size={14} className="text-[#F6C768]" />;
			default:
				return <Tag size={14} className="text-[#A8AFBD]" />;
		}
	};

	return (
		<div className="relative flex flex-col space-y-2">
			{/* Tagged Asset Chips */}
			{taggedAssets.length > 0 && (
				<div className="flex flex-wrap items-center gap-1.5 pb-1">
					<span className="text-[10px] font-semibold text-[#A8AFBD] uppercase tracking-wider">
						Tagged Media:
					</span>
					{taggedAssets.map((asset) => (
						<span
							key={asset.id}
							className="tagged-asset-chip inline-flex items-center gap-1.5 rounded-lg border border-[#A879F5]/40 bg-[#A879F5]/15 px-2 py-0.5 text-xs font-medium text-white shadow-sm transition"
						>
							{getAssetIcon(asset.kind)}
							<span className="font-mono text-[11px] text-[#e0d0fc]">@{asset.name}</span>
							<button
								type="button"
								onClick={() => handleRemoveTaggedAsset(asset.id)}
								className="rounded p-0.5 text-[#A8AFBD] hover:bg-white/10 hover:text-white transition"
								title={`Remove @${asset.name}`}
							>
								<X size={10} weight="bold" />
							</button>
						</span>
					))}
				</div>
			)}

			{/* Prompt Textarea */}
			<div className="relative">
				<textarea
					ref={textareaRef}
					rows={4}
					value={value}
					onChange={handleTextChange}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					placeholder={placeholder}
					className="w-full resize-none rounded-xl border border-[#343A46] bg-[#15171C] p-3 text-xs leading-relaxed text-white placeholder-[#717887] outline-none transition focus:border-[#6FA8FF]"
				/>

				{/* Bottom Bar Hints & Quick Tag Button */}
				<div className="flex items-center justify-between pt-1">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setShowSuggestions((v) => !v)}
							className="inline-flex items-center gap-1 rounded-md border border-[#343A46] bg-[#1C1F26] px-2 py-0.5 text-[11px] font-medium text-[#c5a7fb] hover:border-[#A879F5]/50 hover:bg-[#A879F5]/10 transition"
							title="Click to tag a project asset in prompt"
						>
							<Tag size={12} weight="bold" />
							<span>@ Tag Asset</span>
						</button>
						<span className="text-[10px] text-[#717887]">
							({assets.length} available)
						</span>
					</div>

					<span className="text-[10px] text-[#717887]">
						Ctrl+Enter to run
					</span>
				</div>

				{/* Autocomplete Suggestions Popover */}
				{showSuggestions && (
					<div
						ref={dropdownRef}
						className="absolute bottom-full left-0 mb-1 w-full max-h-56 overflow-y-auto rounded-xl border border-[#343A46] bg-[#1C1F26] p-1.5 shadow-2xl z-50 backdrop-blur-md"
					>
						<div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#A8AFBD] flex items-center justify-between border-b border-[#343A46] mb-1">
							<span>Select Asset to Tag (@)</span>
							<button
								type="button"
								onClick={() => setShowSuggestions(false)}
								className="text-[#717887] hover:text-white"
							>
								✕
							</button>
						</div>

						{filteredAssets.length === 0 ? (
							<div className="p-3 text-center text-xs text-[#717887]">
								No assets matching "{mentionQuery}"
							</div>
						) : (
							filteredAssets.map((asset, index) => {
								const isSelected = index === selectedIndex;
								return (
									<button
										key={asset.id}
										type="button"
										onClick={() => handleSelectAsset(asset)}
										onMouseEnter={() => setSelectedIndex(index)}
										className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
											isSelected
												? "bg-[#6FA8FF]/20 text-white"
												: "text-[#A8AFBD] hover:bg-white/5 hover:text-white"
										}`}
									>
										<div className="flex items-center gap-2">
											{getAssetIcon(asset.kind)}
											<span className="font-semibold text-white">{asset.name}</span>
										</div>
										<div className="flex items-center gap-2 font-mono text-[10px] text-[#717887]">
											<span>{asset.kind}</span>
											{asset.width && asset.height && (
												<span>
													{asset.width}x{asset.height}
												</span>
											)}
										</div>
									</button>
								);
							})
						)}
					</div>
				)}
			</div>
		</div>
	);
}
