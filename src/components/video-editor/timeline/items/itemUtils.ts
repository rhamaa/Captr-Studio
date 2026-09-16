import glassStyles from "../ItemGlass.module.css";

export const ZOOM_LABELS: Record<number, string> = {
	1: "1.25×",
	2: "1.5×",
	3: "1.8×",
	4: "2.2×",
	5: "3.5×",
	6: "5×",
};

export function formatMs(ms: number): string {
	const totalSeconds = ms / 1000;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) {
		return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
	}
	return `${seconds.toFixed(1)}s`;
}

export function getGlassClass(
	variant: "zoom" | "trim" | "clip" | "annotation" | "speed" | "audio" | "layout" = "zoom",
): string {
	switch (variant) {
		case "zoom":
			return glassStyles.glassPurple;
		case "trim":
			return glassStyles.glassRed;
		case "clip":
			return glassStyles.glassCyan;
		case "layout":
			return glassStyles.glassPurple;
		case "speed":
			return glassStyles.glassAmber;
		case "audio":
			return glassStyles.glassDarkGreen;
		default:
			return glassStyles.glassYellow;
	}
}
