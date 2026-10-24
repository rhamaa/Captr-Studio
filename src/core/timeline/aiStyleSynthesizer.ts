import type { RecordingFrameAppearance, WindowHeaderStyle } from "@/recording/schema";

export interface SynthesizedFrameStyle {
	appearance: RecordingFrameAppearance;
	wallpaper?: string;
	explanation: string;
}

interface SemanticThemeBase {
	name: string;
	borderColor: string;
	borderWidth: number;
	borderOpacity: number;
	cornerRadius: number;
	surfaceColor: string;
	surfaceOpacity: number;
	backdropBlur: number;
	headerStyle: WindowHeaderStyle;
	shadow: {
		color: string;
		opacity: number;
		blur: number;
		offsetX: number;
		offsetY: number;
	};
	wallpaper: string;
}

const THEME_PRESETS: Record<string, SemanticThemeBase> = {
	cyberpunk: {
		name: "Cyberpunk Neon",
		borderColor: "#ff007f",
		borderWidth: 4,
		borderOpacity: 0.95,
		cornerRadius: 12,
		surfaceColor: "#0d061a",
		surfaceOpacity: 0.85,
		backdropBlur: 16,
		headerStyle: "macos",
		shadow: {
			color: "#ff007f",
			opacity: 0.55,
			blur: 32,
			offsetX: 0,
			offsetY: 8,
		},
		wallpaper: "/wallpapers/energy-19.jpg",
	},
	matrix: {
		name: "Matrix Hacker",
		borderColor: "#00ff66",
		borderWidth: 3,
		borderOpacity: 0.95,
		cornerRadius: 4,
		surfaceColor: "#051208",
		surfaceOpacity: 0.9,
		backdropBlur: 0,
		headerStyle: "windows",
		shadow: {
			color: "#00ff66",
			opacity: 0.45,
			blur: 26,
			offsetX: 0,
			offsetY: 6,
		},
		wallpaper: "/wallpapers/midnight-8.jpg",
	},
	minimal: {
		name: "Minimalist Modern",
		borderColor: "#ffffff",
		borderWidth: 1.5,
		borderOpacity: 0.18,
		cornerRadius: 16,
		surfaceColor: "#18181b",
		surfaceOpacity: 0.8,
		backdropBlur: 20,
		headerStyle: "none",
		shadow: {
			color: "#000000",
			opacity: 0.35,
			blur: 24,
			offsetX: 0,
			offsetY: 8,
		},
		wallpaper: "/wallpapers/tahoe-dark.jpg",
	},
	glass: {
		name: "Glassmorphism",
		borderColor: "#ffffff",
		borderWidth: 1.5,
		borderOpacity: 0.35,
		cornerRadius: 20,
		surfaceColor: "#ffffff",
		surfaceOpacity: 0.12,
		backdropBlur: 28,
		headerStyle: "macos",
		shadow: {
			color: "#000000",
			opacity: 0.25,
			blur: 30,
			offsetX: 0,
			offsetY: 10,
		},
		wallpaper: "/wallpapers/glassmorphism-3.jpg",
	},
	brutalism: {
		name: "Neo-Brutalism",
		borderColor: "#ffffff",
		borderWidth: 5,
		borderOpacity: 1,
		cornerRadius: 0,
		surfaceColor: "#000000",
		surfaceOpacity: 1,
		backdropBlur: 0,
		headerStyle: "none",
		shadow: {
			color: "#000000",
			opacity: 1,
			blur: 0,
			offsetX: 8,
			offsetY: 8,
		},
		wallpaper: "/wallpapers/tahoe-dark.jpg",
	},
	sunset: {
		name: "Sunset Horizon",
		borderColor: "#ff7849",
		borderWidth: 3,
		borderOpacity: 0.85,
		cornerRadius: 16,
		surfaceColor: "#1a0e08",
		surfaceOpacity: 0.88,
		backdropBlur: 14,
		headerStyle: "macos",
		shadow: {
			color: "#ff5722",
			opacity: 0.45,
			blur: 28,
			offsetX: 0,
			offsetY: 8,
		},
		wallpaper: "/wallpapers/sonoma-horizon.jpg",
	},
	ocean: {
		name: "Deep Ocean",
		borderColor: "#38bdf8",
		borderWidth: 3,
		borderOpacity: 0.85,
		cornerRadius: 16,
		surfaceColor: "#081320",
		surfaceOpacity: 0.9,
		backdropBlur: 18,
		headerStyle: "macos",
		shadow: {
			color: "#0284c7",
			opacity: 0.4,
			blur: 28,
			offsetX: 0,
			offsetY: 8,
		},
		wallpaper: "/wallpapers/sequoia-blue.jpg",
	},
	pastel: {
		name: "Pastel Dream",
		borderColor: "#f472b6",
		borderWidth: 3,
		borderOpacity: 0.8,
		cornerRadius: 24,
		surfaceColor: "#221526",
		surfaceOpacity: 0.85,
		backdropBlur: 18,
		headerStyle: "macos",
		shadow: {
			color: "#ec4899",
			opacity: 0.35,
			blur: 24,
			offsetX: 0,
			offsetY: 6,
		},
		wallpaper: "/wallpapers/iridescent-9.jpg",
	},
};

const COLOR_NAME_MAP: Record<string, string> = {
	magenta: "#ff007f",
	pink: "#ec4899",
	kuning: "#facc15",
	yellow: "#facc15",
	emas: "#eab308",
	gold: "#eab308",
	merah: "#ef4444",
	red: "#ef4444",
	biru: "#3b82f6",
	blue: "#3b82f6",
	cyan: "#06b6d4",
	toska: "#06b6d4",
	hijau: "#22c55e",
	green: "#22c55e",
	ungu: "#a855f7",
	purple: "#a855f7",
	putih: "#ffffff",
	white: "#ffffff",
	hitam: "#000000",
	black: "#000000",
	oranye: "#f97316",
	orange: "#f97316",
};

/**
 * Synthesizes dynamic, generative frame appearance and wallpaper from natural language prompt.
 * Seamlessly handles Indonesian & English aesthetic descriptions, color overrides, and dimensions.
 */
export function synthesizeGenerativeFrameStyle(
	prompt: string,
	currentAppearance?: Partial<RecordingFrameAppearance>,
): SynthesizedFrameStyle {
	const lower = prompt.toLowerCase();

	// 1. Identify theme anchor
	let themeKey = "minimal";
	if (lower.includes("cyberpunk") || lower.includes("neon") || lower.includes("synthwave")) {
		themeKey = "cyberpunk";
	} else if (
		lower.includes("matrix") ||
		lower.includes("hacker") ||
		lower.includes("retro") ||
		lower.includes("terminal")
	) {
		themeKey = "matrix";
	} else if (lower.includes("brutalism") || lower.includes("brutal")) {
		themeKey = "brutalism";
	} else if (
		lower.includes("glass") ||
		lower.includes("kaca") ||
		lower.includes("transparan") ||
		lower.includes("transparent")
	) {
		themeKey = "glass";
	} else if (
		lower.includes("sunset") ||
		lower.includes("warm") ||
		lower.includes("senja") ||
		lower.includes("fire") ||
		lower.includes("api")
	) {
		themeKey = "sunset";
	} else if (
		lower.includes("ocean") ||
		lower.includes("laut") ||
		lower.includes("aquatic") ||
		lower.includes("cool")
	) {
		themeKey = "ocean";
	} else if (
		lower.includes("pastel") ||
		lower.includes("playful") ||
		lower.includes("cute") ||
		lower.includes("lembut")
	) {
		themeKey = "pastel";
	}

	const base = THEME_PRESETS[themeKey];
	const result: RecordingFrameAppearance = {
		framePadding: currentAppearance?.framePadding ?? 0,
		borderWidth: base.borderWidth,
		borderColor: base.borderColor,
		borderOpacity: base.borderOpacity,
		cornerRadius: base.cornerRadius,
		surfaceColor: base.surfaceColor,
		surfaceOpacity: base.surfaceOpacity,
		backdropBlur: base.backdropBlur,
		headerStyle: base.headerStyle,
		shadow: { ...base.shadow },
	};
	let wallpaper = base.wallpaper;

	// 2. Explicit color detection: Hex or named color
	const hexMatch = /#([0-9a-fA-F]{3,8})\b/.exec(prompt);
	if (hexMatch) {
		result.borderColor = hexMatch[0];
		// If glowing theme, match shadow color to border
		if (themeKey === "cyberpunk" || themeKey === "matrix" || lower.includes("glow")) {
			result.shadow.color = hexMatch[0];
		}
	} else {
		for (const [colorName, hexVal] of Object.entries(COLOR_NAME_MAP)) {
			const colorRegex = new RegExp(`\\b${colorName}\\b`, "i");
			if (colorRegex.test(lower)) {
				result.borderColor = hexVal;
				if (themeKey === "cyberpunk" || themeKey === "matrix" || lower.includes("glow")) {
					result.shadow.color = hexVal;
				}
				break;
			}
		}
	}

	// Strip hex codes for numeric dimension parsing so digits inside #3b82f6 are not parsed as px
	const textWithoutHex = lower.replace(/#[0-9a-f]{3,8}\b/gi, "");

	// 3. Border width overrides
	const borderPxMatch = /(?:border|garis)[^0-9\n]*?(\d+)\s*(?:px|pixel)?/i.exec(textWithoutHex);
	if (borderPxMatch) {
		result.borderWidth = Math.max(0, Math.min(24, parseInt(borderPxMatch[1], 10)));
	} else if (lower.includes("border tebal") || lower.includes("thick border")) {
		result.borderWidth = 6;
	} else if (lower.includes("border tipis") || lower.includes("thin border")) {
		result.borderWidth = 1.5;
	} else if (lower.includes("tanpa border") || lower.includes("borderless")) {
		result.borderWidth = 0;
	}

	// 4. Corner radius overrides
	const cornerPxMatch = /(?:sudut|radius|corner)[^0-9\n]*?(\d+)\s*(?:px|pixel)?/i.exec(textWithoutHex);
	if (cornerPxMatch) {
		result.cornerRadius = Math.max(0, Math.min(48, parseInt(cornerPxMatch[1], 10)));
	} else if (
		lower.includes("kotak") ||
		lower.includes("tajam") ||
		lower.includes("sharp") ||
		lower.includes("persegi")
	) {
		result.cornerRadius = 0;
	} else if (lower.includes("sangat bulat") || lower.includes("pill")) {
		result.cornerRadius = 32;
	} else if (lower.includes("membulat") || lower.includes("rounded") || lower.includes("bulat")) {
		result.cornerRadius = 22;
	}

	// 5. Header style overrides
	if (lower.includes("macos") || lower.includes("mac") || lower.includes("apple")) {
		result.headerStyle = "macos";
	} else if (lower.includes("windows") || lower.includes("win")) {
		result.headerStyle = "windows";
	} else if (lower.includes("linux")) {
		result.headerStyle = "linux";
	} else if (lower.includes("tanpa header") || lower.includes("no header")) {
		result.headerStyle = "none";
	}

	// 6. Shadow & Glow overrides
	if (lower.includes("glow") || lower.includes("berpendar")) {
		result.shadow.color = result.borderColor;
		result.shadow.blur = Math.max(30, result.shadow.blur);
		result.shadow.opacity = 0.6;
		result.shadow.offsetX = 0;
		result.shadow.offsetY = 0;
	} else if (lower.includes("tanpa bayangan") || lower.includes("no shadow") || lower.includes("flat")) {
		result.shadow.blur = 0;
		result.shadow.opacity = 0;
	}

	// 7. Wallpaper affinity
	if (lower.includes("midnight") || lower.includes("gelap gulita")) {
		wallpaper = "/wallpapers/midnight-8.jpg";
	} else if (lower.includes("energy") || lower.includes("energi")) {
		wallpaper = "/wallpapers/energy-19.jpg";
	} else if (lower.includes("sequoia") || lower.includes("biru laut")) {
		wallpaper = "/wallpapers/sequoia-blue.jpg";
	} else if (lower.includes("glass") || lower.includes("kaca")) {
		wallpaper = "/wallpapers/glassmorphism-3.jpg";
	}

	const explanation = `Synthesized ${base.name} frame: border ${result.borderWidth}px (${result.borderColor}), radius ${result.cornerRadius}px, header ${result.headerStyle ?? "none"}.`;

	return {
		appearance: result,
		wallpaper,
		explanation,
	};
}
