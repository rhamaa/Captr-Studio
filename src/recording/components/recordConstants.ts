import type { CursorStyle } from "@/components/video-editor/types";

export function formatTime(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const tenths = Math.floor((ms % 1000) / 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

export const WALLPAPER_PRESETS = [
	{ label: "Dark Space", value: "#090d16" },
	{ label: "Deep Slate", value: "#0f172a" },
	{ label: "Midnight", value: "#171717" },
	{ label: "Emerald Deep", value: "#064e3b" },
	{ label: "Indigo Mist", value: "#1e1b4b" },
	{ label: "Gradient Blue", value: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)" },
	{ label: "Tahoe Light", value: "wallpapers/tahoe-light.jpg" },
];

export const FRAME_PRESETS = [
	{ id: null, label: "None" },
	{ id: "mac-dark", label: "macOS Dark" },
	{ id: "mac-light", label: "macOS Light" },
	{ id: "glass", label: "Glassy" },
];

export const CURSOR_STYLES: Array<{ id: CursorStyle; label: string }> = [
	{ id: "macos", label: "macOS" },
	{ id: "windows", label: "Windows" },
	{ id: "circle", label: "Dot Circle" },
	{ id: "glow", label: "Glow" },
];
