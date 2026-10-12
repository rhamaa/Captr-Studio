export type LoopPattern = "dot-noise" | "film-grain" | "orbit";

export interface PatternRenderSettings {
	pattern: LoopPattern;
	width: number;
	height: number;
	phase: number;
	seed: number;
	backgroundColor: string;
	accentColor: string;
	density: number;
	scale: number;
	speed: number;
}

export type PatternPrimitive =
	| {
			kind: "circle";
			x: number;
			y: number;
			radius: number;
			color: string;
			opacity: number;
	  }
	| {
			kind: "ellipse";
			x: number;
			y: number;
			radiusX: number;
			radiusY: number;
			color: string;
			opacity: number;
	  };

export interface PatternFrame {
	width: number;
	height: number;
	backgroundColor: string;
	primitives: PatternPrimitive[];
}

const TAU = Math.PI * 2;

function normalizePhase(phase: number): number {
	return ((phase % 1) + 1) % 1;
}

function seededRandom(seed: number): () => number {
	let state = seed | 0 || 1;
	return () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return (state >>> 0) / 0x1_0000_0000;
	};
}

function getCount(settings: PatternRenderSettings): number {
	const area = Math.max(1, settings.width) * Math.max(1, settings.height);
	const density = Math.max(0.05, Math.min(settings.density, 1.5));
	return Math.max(1, Math.round((area / 9000) * density));
}

function getCycles(speed: number): number {
	return Math.min(4, Math.max(1, Math.round(Math.abs(speed) || 1)));
}

function buildDotNoise(settings: PatternRenderSettings, phase: number): PatternPrimitive[] {
	const random = seededRandom(settings.seed);
	const count = getCount(settings);
	const cycles = getCycles(settings.speed);
	const scale = Math.max(0.25, settings.scale);
	const primitives: PatternPrimitive[] = [];
	for (let index = 0; index < count; index++) {
		const baseX = random() * settings.width;
		const baseY = random() * settings.height;
		const offset = random() * TAU;
		const radius = (1.5 + random() * 3.5) * scale;
		const angle = TAU * phase * cycles + offset;
		const sway = Math.min(settings.width, settings.height) * 0.018 * scale;
		primitives.push({
			kind: "circle",
			x: baseX + Math.cos(angle) * sway,
			y: baseY + Math.sin(angle) * sway,
			radius,
			color: settings.accentColor,
			opacity: 0.25 + (Math.sin(angle + offset) + 1) * 0.35,
		});
	}
	return primitives;
}

function buildFilmGrain(settings: PatternRenderSettings, phase: number): PatternPrimitive[] {
	const random = seededRandom(settings.seed ^ 0x45d9f3b);
	const count = getCount(settings) * 3;
	const cycles = getCycles(settings.speed);
	const scale = Math.max(0.25, settings.scale);
	const primitives: PatternPrimitive[] = [];
	for (let index = 0; index < count; index++) {
		const baseX = random() * settings.width;
		const baseY = random() * settings.height;
		const offset = random() * TAU;
		const angle = TAU * phase * cycles + offset;
		const jitter = scale * 0.6;
		primitives.push({
			kind: "circle",
			x: baseX + Math.cos(angle) * jitter,
			y: baseY + Math.sin(angle) * jitter,
			radius: Math.max(0.4, (0.45 + random() * 0.8) * scale),
			color: settings.accentColor,
			opacity: 0.12 + (Math.sin(angle * 2 + offset) + 1) * 0.28,
		});
	}
	return primitives;
}

function buildOrbit(settings: PatternRenderSettings, phase: number): PatternPrimitive[] {
	const random = seededRandom(settings.seed ^ 0x27d4eb2d);
	const count = Math.max(3, Math.round(3 + settings.density * 5));
	const cycles = getCycles(settings.speed);
	const centerX = settings.width / 2;
	const centerY = settings.height / 2;
	const minDimension = Math.min(settings.width, settings.height);
	const scale = Math.max(0.25, settings.scale);
	const primitives: PatternPrimitive[] = [];
	for (let index = 0; index < count; index++) {
		const radiusX = minDimension * (0.12 + random() * 0.34) * scale;
		const radiusY = radiusX * (0.45 + random() * 0.8);
		const offset = random() * TAU;
		primitives.push({
			kind: "ellipse",
			x: centerX,
			y: centerY,
			radiusX,
			radiusY,
			color: settings.accentColor,
			opacity: 0.12 + random() * 0.2,
		});
		const angle = TAU * phase * cycles + offset;
		primitives.push({
			kind: "circle",
			x: centerX + Math.cos(angle) * radiusX,
			y: centerY + Math.sin(angle) * radiusY,
			radius: (2 + random() * 4) * scale,
			color: settings.accentColor,
			opacity: 0.45 + random() * 0.45,
		});
	}
	return primitives;
}

export function buildPatternFrame(settings: PatternRenderSettings): PatternFrame {
	const safeSettings = {
		...settings,
		width: Math.max(1, Math.floor(settings.width)),
		height: Math.max(1, Math.floor(settings.height)),
	};
	const phase = normalizePhase(settings.phase);
	const primitives =
		safeSettings.pattern === "dot-noise"
			? buildDotNoise(safeSettings, phase)
			: safeSettings.pattern === "film-grain"
				? buildFilmGrain(safeSettings, phase)
				: buildOrbit(safeSettings, phase);
	return {
		width: safeSettings.width,
		height: safeSettings.height,
		backgroundColor: safeSettings.backgroundColor,
		primitives,
	};
}

export function drawPatternFrame(
	context: Pick<
		CanvasRenderingContext2D,
		| "clearRect"
		| "fillRect"
		| "beginPath"
		| "arc"
		| "ellipse"
		| "fill"
		| "fillStyle"
		| "globalAlpha"
	>,
	settings: PatternRenderSettings,
): void {
	const frame = buildPatternFrame(settings);
	context.clearRect(0, 0, frame.width, frame.height);
	context.fillStyle = frame.backgroundColor;
	context.fillRect(0, 0, frame.width, frame.height);
	for (const primitive of frame.primitives) {
		context.beginPath();
		context.fillStyle = primitive.color;
		context.globalAlpha = primitive.opacity;
		if (primitive.kind === "circle") {
			context.arc(primitive.x, primitive.y, primitive.radius, 0, TAU);
		} else {
			context.ellipse(
				primitive.x,
				primitive.y,
				primitive.radiusX,
				primitive.radiusY,
				0,
				0,
				TAU,
			);
		}
		context.fill();
	}
	context.globalAlpha = 1;
}
