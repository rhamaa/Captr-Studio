import type {
	ExportEncodingMode,
	ExportFormat,
	ExportMp4FrameRate,
	ExportQuality,
	GifFrameRate,
	GifSizePreset,
} from "@/lib/exporter";

export interface ExportQuickPreset {
	id: "4k-ultra" | "1080p-web" | "720p-draft" | "gif-social";
	name: string;
	shortLabel: string;
	badge: string;
	description: string;
	iconName: "crown" | "globe" | "lightning" | "gif";
	format: ExportFormat;
	quality?: ExportQuality;
	mp4FrameRate?: ExportMp4FrameRate;
	encodingMode?: ExportEncodingMode;
	gifConfig?: {
		frameRate: GifFrameRate;
		sizePreset: GifSizePreset;
		loop: boolean;
	};
}

export const EXPORT_QUICK_PRESETS: readonly ExportQuickPreset[] = [
	{
		id: "4k-ultra",
		name: "4K 60fps Ultra",
		shortLabel: "4K Ultra",
		badge: "Cinema",
		description: "Maximum resolution & quality encoding at 60 fps for pro video",
		iconName: "crown",
		format: "mp4",
		quality: "source",
		mp4FrameRate: 60,
		encodingMode: "quality",
	},
	{
		id: "1080p-web",
		name: "1080p Web Balanced",
		shortLabel: "1080p Web",
		badge: "YouTube",
		description: "Standard 1080p 60 fps with balanced file size for web & social feeds",
		iconName: "globe",
		format: "mp4",
		quality: "high",
		mp4FrameRate: 60,
		encodingMode: "balanced",
	},
	{
		id: "720p-draft",
		name: "720p Fast Draft",
		shortLabel: "720p Fast",
		badge: "Draft",
		description: "Ultra-fast 30 fps render with minimal file size for instant reviews",
		iconName: "lightning",
		format: "mp4",
		quality: "medium",
		mp4FrameRate: 30,
		encodingMode: "fast",
	},
	{
		id: "gif-social",
		name: "Lightweight GIF",
		shortLabel: "Social GIF",
		badge: "30 FPS",
		description: "Smooth 30 fps loop optimized for Discord, Slack, PRs & docs",
		iconName: "gif",
		format: "gif",
		gifConfig: {
			frameRate: 30,
			sizePreset: "medium",
			loop: true,
		},
	},
];

export function isMatchingQuickPreset(
	preset: ExportQuickPreset,
	current: {
		format: ExportFormat;
		quality: ExportQuality;
		mp4FrameRate: ExportMp4FrameRate;
		encodingMode: ExportEncodingMode;
		gifFrameRate: GifFrameRate;
		gifSizePreset: GifSizePreset;
		gifLoop: boolean;
	},
): boolean {
	if (preset.format !== current.format) {
		return false;
	}

	if (preset.format === "mp4") {
		return (
			preset.quality === current.quality &&
			preset.mp4FrameRate === current.mp4FrameRate &&
			preset.encodingMode === current.encodingMode
		);
	}

	if (preset.format === "gif" && preset.gifConfig) {
		return (
			preset.gifConfig.frameRate === current.gifFrameRate &&
			preset.gifConfig.sizePreset === current.gifSizePreset &&
			preset.gifConfig.loop === current.gifLoop
		);
	}

	return false;
}
