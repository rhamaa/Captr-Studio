import { UploadSimple as Upload, X } from "@phosphor-icons/react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { FrameInstance } from "@/lib/extensions";
import { cn } from "@/lib/utils";
import { BUILT_IN_WALLPAPERS, isVideoWallpaperSource } from "@/lib/wallpapers";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { type EditorPreferences, saveEditorPreferences } from "../../editorPreferences";
import { SliderControl } from "../../SliderControl";
import type { CropRegion, Padding } from "../../types";
import { SectionLabel } from "../components/SettingsSectionLabel";
import { WallpaperVideoPreview } from "../components/WallpaperVideoPreview";
import { BackgroundTab, GRADIENTS, isHexWallpaper, WallpaperTile } from "../utils/wallpaperUtils";

const DEFAULT_PADDING: Padding = {
	top: 50,
	bottom: 50,
	left: 50,
	right: 50,
	linked: true,
};

export interface SceneSectionProps {
	selected: string;
	onWallpaperChange?: (wallpaper: string) => void;
	backgroundBlur: number;
	onBackgroundBlurChange?: (blur: number) => void;
	shadowIntensity?: number;
	onShadowChange?: (shadow: number) => void;
	borderRadius?: number;
	onBorderRadiusChange?: (radius: number) => void;
	padding?: Padding;
	onPaddingChange?: (padding: Padding) => void;
	frame?: string | null;
	onFrameChange?: (frame: string | null) => void;
	cropRegion?: CropRegion;
	onCropChange?: (crop: CropRegion) => void;
	aspectRatio?: AspectRatio;
	onAspectRatioChange?: (ratio: AspectRatio) => void;
	initialEditorPreferences: EditorPreferences;
	builtInWallpapers: Array<{ id: string; label: string; publicPath: string }>;
	builtInWallpaperPaths: string[];
	wallpaperPreviewPaths: string[];
	extensionWallpapers: Array<{
		id: string;
		wallpaper: { label: string };
		resolvedUrl: string;
		resolvedThumbnailUrl?: string;
	}>;
	extensionWallpaperPaths: string[];
	extensionWallpaperPreviewUrls: Record<string, string>;
	colorPalette: string[];
	availableFrames: FrameInstance[];
	tSettings: (key: string, fallback?: string) => string;
	t: (key: string, fallback?: string) => string;
	renderExtensionPanels?: () => React.ReactNode;
}

export const SceneSection: React.FC<SceneSectionProps> = ({
	selected,
	onWallpaperChange,
	backgroundBlur,
	onBackgroundBlurChange,
	shadowIntensity = 0.67,
	onShadowChange,
	borderRadius = 12.5,
	onBorderRadiusChange,
	padding = DEFAULT_PADDING,
	onPaddingChange,
	frame = null,
	onFrameChange,
	cropRegion,
	onCropChange,
	aspectRatio,
	onAspectRatioChange,
	initialEditorPreferences,
	builtInWallpapers,
	builtInWallpaperPaths,
	wallpaperPreviewPaths,
	extensionWallpapers,
	extensionWallpaperPaths,
	extensionWallpaperPreviewUrls,
	colorPalette,
	availableFrames,
	tSettings,
	t,
	renderExtensionPanels,
}) => {
	const [customImages, setCustomImages] = useState<string[]>(() => {
		return (initialEditorPreferences.customWallpapers ?? []).filter(
			(url: string) => !isVideoWallpaperSource(url),
		);
	});
	const [customVideoWallpapers, setCustomVideoWallpapers] = useState<string[]>(() => {
		return (initialEditorPreferences.customWallpapers ?? []).filter((url: string) =>
			isVideoWallpaperSource(url),
		);
	});

	const [backgroundTab, setBackgroundTab] = useState<BackgroundTab>(() => {
		if (selected.startsWith("#") || isHexWallpaper(selected)) return "color";
		if (selected.startsWith("linear-gradient")) return "gradient";
		if (isVideoWallpaperSource(selected)) return "video";
		return "image";
	});

	const removeBackgroundStateRef = useRef<{
		aspectRatio?: AspectRatio;
		padding?: Padding;
	} | null>(null);

	const removeBackgroundEnabled = Boolean(
		padding.top === 0 &&
			padding.bottom === 0 &&
			padding.left === 0 &&
			padding.right === 0 &&
			(aspectRatio === "native" || !aspectRatio),
	);

	useEffect(() => {
		if (selected.startsWith("data:image")) {
			setCustomImages((prev) => (prev.includes(selected) ? prev : [selected, ...prev]));
			return;
		}

		const isKnownWallpaper =
			builtInWallpaperPaths.includes(selected) ||
			wallpaperPreviewPaths.includes(selected) ||
			extensionWallpaperPaths.includes(selected);

		if (!isKnownWallpaper && isVideoWallpaperSource(selected)) {
			setCustomImages((prev) => (prev.includes(selected) ? prev : [selected, ...prev]));
		}
	}, [builtInWallpaperPaths, extensionWallpaperPaths, selected, wallpaperPreviewPaths]);

	const imageWallpaperTiles = useMemo<WallpaperTile[]>(() => {
		const imageWallpapers = builtInWallpapers.filter(
			(wallpaper) => !isVideoWallpaperSource(wallpaper.publicPath),
		);
		const builtInTiles = (
			wallpaperPreviewPaths.length > 0 ? wallpaperPreviewPaths : builtInWallpaperPaths
		)
			.filter((path) => !isVideoWallpaperSource(path))
			.map((previewPath, index) => {
				const wallpaper = imageWallpapers[index];
				return {
					key: wallpaper ? `builtin/${wallpaper.id}` : previewPath,
					label: wallpaper?.label ?? `Wallpaper ${index + 1}`,
					value: wallpaper?.publicPath ?? previewPath,
					previewUrl: previewPath,
				};
			});

		const extensionTiles = extensionWallpapers
			.filter((wallpaper) => !isVideoWallpaperSource(wallpaper.resolvedUrl))
			.map((wallpaper) => ({
				key: wallpaper.id,
				label: wallpaper.wallpaper.label,
				value: wallpaper.resolvedUrl,
				previewUrl:
					extensionWallpaperPreviewUrls[wallpaper.id] ?? wallpaper.resolvedThumbnailUrl,
			}));

		return [...builtInTiles, ...extensionTiles];
	}, [
		builtInWallpaperPaths,
		builtInWallpapers,
		extensionWallpaperPreviewUrls,
		extensionWallpapers,
		wallpaperPreviewPaths,
	]);

	const videoWallpaperTiles = useMemo<WallpaperTile[]>(() => {
		const builtInTiles = builtInWallpapers
			.filter((wallpaper) => isVideoWallpaperSource(wallpaper.publicPath))
			.map((wallpaper) => ({
				key: `builtin/${wallpaper.id}`,
				label: wallpaper.label,
				value: wallpaper.publicPath,
				previewUrl: wallpaper.publicPath,
			}));

		const extensionTiles = extensionWallpapers
			.filter((wallpaper) => isVideoWallpaperSource(wallpaper.resolvedUrl))
			.map((wallpaper) => ({
				key: wallpaper.id,
				label: wallpaper.wallpaper.label,
				value: wallpaper.resolvedUrl,
				previewUrl:
					extensionWallpaperPreviewUrls[wallpaper.id] ?? wallpaper.resolvedThumbnailUrl,
			}));

		return [...builtInTiles, ...extensionTiles];
	}, [builtInWallpapers, extensionWallpaperPreviewUrls, extensionWallpapers]);

	useEffect(() => {
		saveEditorPreferences({ customWallpapers: customImages });
	}, [customImages]);

	const handleRemoveBackgroundToggle = (checked: boolean) => {
		if (checked) {
			removeBackgroundStateRef.current = {
				aspectRatio,
				padding,
			};
			onAspectRatioChange?.("native");
			onPaddingChange?.({ top: 0, bottom: 0, left: 0, right: 0, linked: padding.linked });
			return;
		}

		const previousState = removeBackgroundStateRef.current;
		if (previousState) {
			if (previousState.aspectRatio) onAspectRatioChange?.(previousState.aspectRatio);
			if (previousState.padding) onPaddingChange?.(previousState.padding);
			removeBackgroundStateRef.current = null;
			return;
		}

		if (initialEditorPreferences.aspectRatio) {
			onAspectRatioChange?.(initialEditorPreferences.aspectRatio);
		}
		onPaddingChange?.({ ...DEFAULT_PADDING });
	};

	const togglePaddingLink = () => {
		const isLinked = padding.linked !== false;
		const nextLinked = !isLinked;
		if (nextLinked) {
			const avg = Math.round(
				(padding.top + padding.bottom + padding.left + padding.right) / 4,
			);
			onPaddingChange?.({
				top: avg,
				bottom: avg,
				left: avg,
				right: avg,
				linked: true,
			});
		} else {
			onPaddingChange?.({
				...padding,
				linked: false,
			});
		}
	};

	const handlePaddingSideChange = (side: keyof Padding, value: number) => {
		if (padding.linked !== false) {
			onPaddingChange?.({
				top: value,
				bottom: value,
				left: value,
				right: value,
				linked: true,
			});
		} else {
			onPaddingChange?.({
				...padding,
				[side]: value,
			});
		}
	};

	const getWallpaperTileState = (candidateValue: string, previewPath?: string) => {
		if (!selected) return false;
		if (selected === candidateValue || (previewPath && selected === previewPath)) return true;
		try {
			const clean = (s: string) => s.replace(/^file:\/\//, "").replace(/^\//, "");
			if (clean(selected).endsWith(clean(candidateValue))) return true;
			if (clean(candidateValue).endsWith(clean(selected))) return true;
			if (previewPath && clean(selected).endsWith(clean(previewPath))) return true;
			if (previewPath && clean(previewPath).endsWith(clean(selected))) return true;
		} catch {
			return false;
		}
		return false;
	};

	const wallpaperTileClass = (isSelected: boolean) =>
		cn(
			"group relative aspect-square w-full overflow-hidden rounded-[10px] border bg-editor-bg transition-colors duration-150",
			isSelected
				? "border-[#2563EB] bg-foreground/[0.08]"
				: "border-foreground/10 bg-foreground/[0.045] hover:border-foreground/20 hover:bg-foreground/[0.07]",
		);

	const renderWallpaperImageTile = (
		wallpaperUrl: string,
		isSelected: boolean,
		props?: {
			key?: string;
			ariaLabel?: string;
			title?: string;
			onClick?: () => void;
			children?: React.ReactNode;
		},
	) => (
		<div
			key={props?.key}
			className={wallpaperTileClass(isSelected)}
			aria-label={props?.ariaLabel}
			title={props?.title}
			onClick={props?.onClick}
			role="button"
		>
			<div className="absolute inset-[1px] overflow-hidden rounded-[8px] bg-editor-dialog">
				{isVideoWallpaperSource(wallpaperUrl) ? (
					<WallpaperVideoPreview src={wallpaperUrl} />
				) : (
					<img
						src={wallpaperUrl}
						alt={
							props?.title ??
							props?.ariaLabel ??
							tSettings("background.wallpaperPreview", "Wallpaper preview")
						}
						className="h-full w-full select-none object-cover [transform:translateZ(0)]"
						draggable={false}
					/>
				)}
			</div>
			{props?.children}
		</div>
	);

	const crop = cropRegion ?? {
		x: 0,
		y: 0,
		width: 1,
		height: 1,
	};
	const cropTop = Math.round(crop.y * 100);
	const cropLeft = Math.round(crop.x * 100);
	const cropBottom = Math.round((1 - crop.y - crop.height) * 100);
	const cropRight = Math.round((1 - crop.x - crop.width) * 100);
	const isCropped = cropTop > 0 || cropBottom > 0 || cropLeft > 0 || cropRight > 0;

	const setCropInset = (side: "top" | "bottom" | "left" | "right", pct: number) => {
		const val = Math.max(0, Math.min(50, pct)) / 100;
		let { x, y, width, height } = crop;
		if (side === "top") {
			const bottomInset = 1 - y - height;
			y = val;
			height = Math.max(0.1, 1 - y - bottomInset);
		} else if (side === "bottom") {
			height = Math.max(0.1, 1 - y - val);
		} else if (side === "left") {
			const rightInset = 1 - x - width;
			x = val;
			width = Math.max(0.1, 1 - x - rightInset);
		} else if (side === "right") {
			width = Math.max(0.1, 1 - x - val);
		}
		onCropChange?.({ x, y, width, height });
	};

	const resetBackgroundSection = () => {
		onWallpaperChange?.(initialEditorPreferences.wallpaper);
		onBackgroundBlurChange?.(initialEditorPreferences.backgroundBlur);
	};

	const resetFrameSection = () => {
		onShadowChange?.(initialEditorPreferences.shadowIntensity);
		onBorderRadiusChange?.(initialEditorPreferences.borderRadius);
		onPaddingChange?.({
			top: DEFAULT_PADDING.top,
			bottom: DEFAULT_PADDING.bottom,
			left: DEFAULT_PADDING.left,
			right: DEFAULT_PADDING.right,
			linked: true,
		});
		onFrameChange?.(null);
	};

	const resetCropSection = () => {
		onCropChange?.({ x: 0, y: 0, width: 1, height: 1 });
	};

	const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const electronPath = (file as unknown as { path?: string }).path;
		if (electronPath && typeof electronPath === "string") {
			const localUrl = `file://${electronPath.replace(/\\/g, "/")}`;
			setCustomImages((prev) => [
				localUrl,
				...prev.filter((item: string) => item !== localUrl),
			]);
			onWallpaperChange?.(localUrl);
			event.target.value = "";
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (typeof result === "string") {
				setCustomImages((prev) => [
					result,
					...prev.filter((item: string) => item !== result),
				]);
				onWallpaperChange?.(result);
			}
		};
		reader.readAsDataURL(file);
		event.target.value = "";
	};

	const handleVideoUpload = async () => {
		try {
			const result = await window.electronAPI.openVideoFilePicker();
			if (!result?.success || !result.path) return;
			const filePath = result.path;
			if (!isVideoWallpaperSource(filePath)) {
				toast.error("Unsupported format", {
					description: "Please select a video file (mp4, webm, mov, etc.)",
				});
				return;
			}
			setCustomVideoWallpapers((prev) => [filePath, ...prev]);
			onWallpaperChange?.(filePath);
			toast.success("Video background added");
		} catch {
			toast.error("Failed to import video background");
		}
	};

	const handleRemoveCustomImage = (imageUrl: string, event: React.MouseEvent) => {
		event.stopPropagation();
		const updated = customImages.filter((img) => img !== imageUrl);
		setCustomImages(updated);
		if (selected === imageUrl) {
			onWallpaperChange?.(
				builtInWallpaperPaths[0] ??
					extensionWallpaperPaths[0] ??
					BUILT_IN_WALLPAPERS[0]?.publicPath ??
					"",
			);
		}
	};

	const visibleColorPalette = colorPalette.slice(0, 15);

	return (
		<div className="space-y-4">
			{/* Background Controls */}
			<section className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-3">
					<SectionLabel>{tSettings("background.title", "Background")}</SectionLabel>
					<button
						type="button"
						onClick={resetBackgroundSection}
						className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80 cursor-pointer"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				</div>
				<SliderControl
					label={tSettings("effects.backgroundBlur", "Background Blur")}
					value={backgroundBlur}
					defaultValue={initialEditorPreferences.backgroundBlur}
					min={0}
					max={8}
					step={0.25}
					onChange={(v: number) => onBackgroundBlurChange?.(v)}
					formatValue={(v: number) => `${v.toFixed(1)}px`}
					parseInput={(text: string) => parseFloat(text.replace(/px$/, "")) || 0}
				/>
			</section>

			{/* Tab Switcher */}
			<div className="w-full">
				<LayoutGroup id="scene-background-picker-switcher">
					<div className="grid h-8 w-full grid-cols-4 rounded-xl border border-foreground/10 bg-foreground/[0.04] p-1">
						{(
							[
								{ value: "image", label: tSettings("background.image", "Image") },
								{ value: "video", label: tSettings("background.video", "Video") },
								{ value: "color", label: tSettings("background.color", "Color") },
								{
									value: "gradient",
									label: tSettings("background.gradient", "Gradient"),
								},
							] as const
						).map((option) => {
							const isActive = backgroundTab === option.value;
							return (
								<button
									key={option.value}
									type="button"
									onClick={() => setBackgroundTab(option.value)}
									className="relative rounded-lg text-[10px] font-semibold tracking-wide transition-colors cursor-pointer"
								>
									{isActive ? (
										<motion.span
											layoutId="scene-background-picker-pill"
											className="absolute inset-0 rounded-lg bg-[#2563EB]"
											transition={{
												type: "spring",
												stiffness: 420,
												damping: 34,
											}}
										/>
									) : null}
									<span
										className={cn(
											"relative z-10",
											isActive
												? "text-white"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										{option.label}
									</span>
								</button>
							);
						})}
					</div>
				</LayoutGroup>

				<div className="pt-2">
					<AnimatePresence mode="wait" initial={false}>
						<motion.div
							key={backgroundTab}
							initial={{ opacity: 0, y: 3 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -3 }}
							transition={{ duration: 0.15 }}
						>
							{backgroundTab === "image" && (
								<div className="flex flex-col gap-2">
									<div className="grid grid-cols-5 gap-1.5">
										<label
											className={cn(
												wallpaperTileClass(false),
												"flex flex-col items-center justify-center gap-1 border-dashed cursor-pointer",
											)}
										>
											<input
												type="file"
												accept="image/*"
												onChange={handleImageUpload}
												className="hidden"
											/>
											<Upload className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5" />
											<span className="text-[8px] font-medium text-muted-foreground">
												{tSettings("background.custom", "Upload")}
											</span>
										</label>

										{customImages.map((customImg, idx) => {
											const isSelected = getWallpaperTileState(customImg);
											return renderWallpaperImageTile(customImg, isSelected, {
												key: `custom-${idx}`,
												title: "Custom Wallpaper",
												onClick: () => onWallpaperChange?.(customImg),
												children: (
													<button
														type="button"
														onClick={(e) =>
															handleRemoveCustomImage(customImg, e)
														}
														className="absolute right-1 top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white/80 opacity-0 transition-opacity hover:bg-black hover:text-white group-hover:opacity-100"
													>
														<X className="h-2.5 w-2.5" />
													</button>
												),
											});
										})}

										{imageWallpaperTiles.map((tile) => {
											const isSelected = getWallpaperTileState(
												tile.value,
												tile.previewUrl,
											);
											return renderWallpaperImageTile(
												tile.previewUrl ?? tile.value,
												isSelected,
												{
													key: tile.key,
													title: tile.label,
													onClick: () => onWallpaperChange?.(tile.value),
												},
											);
										})}
									</div>
								</div>
							)}

							{backgroundTab === "video" && (
								<div className="flex flex-col gap-2">
									<div className="grid grid-cols-5 gap-1.5">
										<button
											type="button"
											onClick={handleVideoUpload}
											className={cn(
												wallpaperTileClass(false),
												"flex flex-col items-center justify-center gap-1 border-dashed cursor-pointer",
											)}
										>
											<Upload className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5" />
											<span className="text-[8px] font-medium text-muted-foreground">
												{tSettings("background.customVideo", "Upload MP4")}
											</span>
										</button>

										{customVideoWallpapers.map((customVid, idx) => {
											const isSelected = getWallpaperTileState(customVid);
											return renderWallpaperImageTile(customVid, isSelected, {
												key: `custom-vid-${idx}`,
												title: "Custom Video",
												onClick: () => onWallpaperChange?.(customVid),
											});
										})}

										{videoWallpaperTiles.map((tile) => {
											const isSelected = getWallpaperTileState(
												tile.value,
												tile.previewUrl,
											);
											return renderWallpaperImageTile(
												tile.previewUrl ?? tile.value,
												isSelected,
												{
													key: tile.key,
													title: tile.label,
													onClick: () => onWallpaperChange?.(tile.value),
												},
											);
										})}
									</div>
								</div>
							)}

							{backgroundTab === "color" && (
								<div className="flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<input
											type="color"
											value={selected.startsWith("#") ? selected : "#000000"}
											onChange={(e) => onWallpaperChange?.(e.target.value)}
											className="h-7 w-10 cursor-pointer rounded-lg border border-foreground/10 bg-transparent p-0.5"
										/>
										<span className="text-[11px] font-mono text-muted-foreground uppercase">
											{selected.startsWith("#") ? selected : "#000000"}
										</span>
									</div>
									<div className="grid grid-cols-5 gap-1.5">
										{visibleColorPalette.map((color) => {
											const isSelected =
												selected.toLowerCase() === color.toLowerCase();
											return (
												<button
													key={color}
													type="button"
													onClick={() => onWallpaperChange?.(color)}
													className={cn(
														"aspect-square rounded-[8px] border transition-all cursor-pointer",
														isSelected
															? "border-[#2563EB] ring-2 ring-[#2563EB]/40 scale-105"
															: "border-foreground/10 hover:scale-105",
													)}
													style={{ backgroundColor: color }}
													title={color}
												/>
											);
										})}
									</div>
								</div>
							)}

							{backgroundTab === "gradient" && (
								<div className="grid grid-cols-5 gap-1.5">
									{GRADIENTS.map((grad, idx) => {
										const isSelected = selected === grad;
										return (
											<button
												key={idx}
												type="button"
												onClick={() => onWallpaperChange?.(grad)}
												className={cn(
													"aspect-square rounded-[8px] border transition-all cursor-pointer",
													isSelected
														? "border-[#2563EB] ring-2 ring-[#2563EB]/40 scale-105"
														: "border-foreground/10 hover:scale-105",
												)}
												style={{ background: grad }}
												title={`Gradient ${idx + 1}`}
											/>
										);
									})}
								</div>
							)}
						</motion.div>
					</AnimatePresence>
				</div>

				<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5 mt-2">
					<span className="text-[10px] text-muted-foreground">
						{tSettings("effects.removeBackground", "Remove Background")}
					</span>
					<Switch
						checked={removeBackgroundEnabled}
						onCheckedChange={handleRemoveBackgroundToggle}
						className="data-[state=checked]:bg-[#2563EB] scale-75"
					/>
				</div>

				{/* Frame Picker */}
				{availableFrames.length > 0 && (
					<div className="flex flex-col gap-1.5 mt-2">
						<div className="flex items-center justify-between">
							<span className="text-[10px] text-muted-foreground font-medium">
								Frame
							</span>
							{frame && (
								<button
									type="button"
									onClick={() => onFrameChange?.(null)}
									className="text-[9px] text-[#2563EB] hover:opacity-80 cursor-pointer"
								>
									Remove
								</button>
							)}
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{availableFrames.map((f) => {
								const isSelected = frame === f.id;
								return (
									<button
										key={f.id}
										type="button"
										onClick={() => onFrameChange?.(isSelected ? null : f.id)}
										className={cn(
											"flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all text-center cursor-pointer",
											isSelected
												? "border-[#2563EB]/50 bg-[#2563EB]/10 ring-1 ring-[#2563EB]/30"
												: "border-foreground/[0.06] bg-white/[0.02] hover:bg-foreground/[0.05]",
										)}
									>
										<div className="w-full aspect-video rounded bg-foreground/10 overflow-hidden flex items-center justify-center">
											<img
												src={f.thumbnailPath}
												alt={f.label}
												className="w-full h-full object-contain"
												draggable={false}
											/>
										</div>
										<span className="text-[8px] text-muted-foreground truncate w-full leading-tight">
											{f.label}
										</span>
									</button>
								);
							})}
						</div>
					</div>
				)}
			</div>

			{/* Frame & Border Radius Controls */}
			<section className="flex flex-col gap-2 pt-2 border-t border-foreground/[0.06]">
				<div className="flex items-center justify-between gap-3">
					<SectionLabel>{tSettings("sections.frame", "Frame")}</SectionLabel>
					<button
						type="button"
						onClick={resetFrameSection}
						className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80 cursor-pointer"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				</div>
				<div className="flex flex-col gap-1.5">
					<SliderControl
						label={tSettings("effects.shadow", "Shadow")}
						value={shadowIntensity}
						defaultValue={initialEditorPreferences.shadowIntensity}
						min={0}
						max={1}
						step={0.01}
						onChange={(v: number) => onShadowChange?.(v)}
						formatValue={(v: number) => `${Math.round(v * 100)}%`}
						parseInput={(text: string) => parseFloat(text.replace(/%$/, "")) / 100 || 0}
					/>
					<SliderControl
						label={tSettings("effects.radius", "Corner Radius")}
						value={borderRadius}
						defaultValue={initialEditorPreferences.borderRadius}
						min={0}
						max={200}
						step={0.5}
						onChange={(v: number) => onBorderRadiusChange?.(v)}
						formatValue={(v: number) => `${v}px`}
						parseInput={(text: string) => parseFloat(text.replace(/px$/, "")) || 0}
					/>

					{/* Padding */}
					<div className="flex flex-col gap-1.5 pt-0.5">
						<div className="flex items-center justify-between">
							<SectionLabel>{tSettings("effects.padding", "Padding")}</SectionLabel>
							<button
								type="button"
								onClick={togglePaddingLink}
								aria-pressed={padding.linked === false}
								className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80 cursor-pointer"
							>
								{padding.linked === false
									? tSettings("effects.paddingAdvancedHide", "Simple")
									: tSettings("effects.paddingAdvancedShow", "Advanced")}
							</button>
						</div>

						{padding.linked !== false ? (
							<SliderControl
								label=""
								value={padding.top}
								defaultValue={DEFAULT_PADDING.top}
								min={0}
								max={100}
								step={1}
								onChange={(v: number) => handlePaddingSideChange("top", v)}
								formatValue={(v: number) => `${v}%`}
								parseInput={(text: string) =>
									parseFloat(text.replace(/%$/, "")) || 0
								}
							/>
						) : (
							<div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
								<SliderControl
									label={tSettings("effects.paddingTop", "Top")}
									value={padding.top}
									defaultValue={DEFAULT_PADDING.top}
									min={0}
									max={100}
									step={1}
									onChange={(v: number) => handlePaddingSideChange("top", v)}
									formatValue={(v: number) => `${v}%`}
									parseInput={(text: string) =>
										parseFloat(text.replace(/%$/, "")) || 0
									}
								/>
								<SliderControl
									label={tSettings("effects.paddingBottom", "Bottom")}
									value={padding.bottom}
									defaultValue={DEFAULT_PADDING.bottom}
									min={0}
									max={100}
									step={1}
									onChange={(v: number) => handlePaddingSideChange("bottom", v)}
									formatValue={(v: number) => `${v}%`}
									parseInput={(text: string) =>
										parseFloat(text.replace(/%$/, "")) || 0
									}
								/>
								<SliderControl
									label={tSettings("effects.paddingLeft", "Left")}
									value={padding.left}
									defaultValue={DEFAULT_PADDING.left}
									min={0}
									max={100}
									step={1}
									onChange={(v: number) => handlePaddingSideChange("left", v)}
									formatValue={(v: number) => `${v}%`}
									parseInput={(text: string) =>
										parseFloat(text.replace(/%$/, "")) || 0
									}
								/>
								<SliderControl
									label={tSettings("effects.paddingRight", "Right")}
									value={padding.right}
									defaultValue={DEFAULT_PADDING.right}
									min={0}
									max={100}
									step={1}
									onChange={(v: number) => handlePaddingSideChange("right", v)}
									formatValue={(v: number) => `${v}%`}
									parseInput={(text: string) =>
										parseFloat(text.replace(/%$/, "")) || 0
									}
								/>
							</div>
						)}
					</div>
				</div>
			</section>

			{/* Crop Section */}
			<section className="flex flex-col gap-2 pt-2 border-t border-foreground/[0.06]">
				<div className="flex items-center justify-between gap-3">
					<SectionLabel>{tSettings("sections.crop", "Crop Inset")}</SectionLabel>
					{isCropped && (
						<button
							type="button"
							onClick={resetCropSection}
							className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80 cursor-pointer"
						>
							{t("common.actions.reset", "Reset")}
						</button>
					)}
				</div>
				<div className="flex flex-col gap-1.5">
					<SliderControl
						label={tSettings("crop.top", "Top")}
						value={cropTop}
						defaultValue={0}
						min={0}
						max={50}
						step={1}
						onChange={(v: number) => setCropInset("top", v)}
						formatValue={(v: number) => `${Math.round(v)}%`}
						parseInput={(text: string) => parseFloat(text.replace(/%$/, "")) || 0}
					/>
					<SliderControl
						label={tSettings("crop.bottom", "Bottom")}
						value={cropBottom}
						defaultValue={0}
						min={0}
						max={50}
						step={1}
						onChange={(v: number) => setCropInset("bottom", v)}
						formatValue={(v: number) => `${Math.round(v)}%`}
						parseInput={(text: string) => parseFloat(text.replace(/%$/, "")) || 0}
					/>
					<SliderControl
						label={tSettings("crop.left", "Left")}
						value={cropLeft}
						defaultValue={0}
						min={0}
						max={50}
						step={1}
						onChange={(v: number) => setCropInset("left", v)}
						formatValue={(v: number) => `${Math.round(v)}%`}
						parseInput={(text: string) => parseFloat(text.replace(/%$/, "")) || 0}
					/>
					<SliderControl
						label={tSettings("crop.right", "Right")}
						value={cropRight}
						defaultValue={0}
						min={0}
						max={50}
						step={1}
						onChange={(v: number) => setCropInset("right", v)}
						formatValue={(v: number) => `${Math.round(v)}%`}
						parseInput={(text: string) => parseFloat(text.replace(/%$/, "")) || 0}
					/>
				</div>
			</section>

			{/* Extension Panels (if any) */}
			{renderExtensionPanels?.()}
		</div>
	);
};
export default SceneSection;
