import { clipDurationUs, type MediaAsset, type MediaSource, type TimelineProject } from "./types";

function requireValue(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
const integer = (v: unknown): v is number =>
	typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
export function assertSafeMediaPath(value: unknown): asserts value is string {
	requireValue(
		typeof value === "string" &&
			value.trim().length > 0 &&
			!value.includes("\0") &&
			!value.split(/[\\/]/).includes(".."),
		"Invalid media path",
	);
	requireValue(
		!/^[a-z]+:\/\//i.test(value) && !value.startsWith("\\\\"),
		"Remote media path is unsupported",
	);
}
function source(s: MediaSource | undefined, required = false) {
	requireValue(!required || s, "Missing required media source");
	if (!s) return;
	assertSafeMediaPath(s.path);
	requireValue(
		integer(s.durationUs) && s.durationUs > 0 && Number.isSafeInteger(s.offsetUs),
		"Invalid source clock",
	);
}
function serializable(value: unknown, seen = new Set<unknown>()) {
	if (
		value === undefined ||
		value === null ||
		typeof value === "string" ||
		typeof value === "boolean"
	)
		return;
	if (typeof value === "number") {
		requireValue(Number.isFinite(value), "Non-finite settings");
		return;
	}
	requireValue(typeof value === "object" && !seen.has(value), "Invalid settings value");
	seen.add(value);
	for (const v of Object.values(value)) serializable(v, seen);
	seen.delete(value);
}
function textOverlay(value: unknown) {
	const text = value as Partial<import("./types").TextOverlay> | null;
	requireValue(
		text &&
			typeof text.content === "string" &&
			text.content.length <= 20_000 &&
			typeof text.fontFamily === "string" &&
			text.fontFamily.trim().length > 0 &&
			text.fontFamily.length <= 120 &&
			integer(text.fontSizePx) &&
			text.fontSizePx >= 1 &&
			text.fontSizePx <= 1000 &&
			integer(text.fontWeight) &&
			text.fontWeight >= 100 &&
			text.fontWeight <= 900 &&
			text.fontWeight % 100 === 0 &&
			typeof text.color === "string" &&
			/^#[0-9a-fA-F]{6}$/.test(text.color) &&
			["left", "center", "right"].includes(text.align ?? ""),
		"Invalid text overlay",
	);
	serializable(text);
}
function clipKeyframes(value: unknown) {
	if (value === undefined) return;
	requireValue(Array.isArray(value), "Invalid clip keyframes");
	const kfIds = new Set<string>();
	for (const item of value as Array<unknown>) {
		const kf = item as Record<string, unknown> | null | undefined;
		requireValue(
			kf &&
				typeof kf === "object" &&
				typeof kf.id === "string" &&
				kf.id.length > 0 &&
				!kfIds.has(kf.id) &&
				typeof kf.timeMs === "number" &&
				Number.isFinite(kf.timeMs) &&
				kf.timeMs >= 0 &&
				typeof kf.property === "string" &&
				["position", "scale", "rotation", "opacity"].includes(kf.property) &&
				typeof kf.easing === "string" &&
				[
					"linear",
					"ease-in",
					"ease-out",
					"ease-in-out",
					"spring-bounce",
					"cubic-bezier",
				].includes(kf.easing),
			"Invalid clip keyframe format",
		);
		kfIds.add(kf.id as string);
		if (kf.property === "position") {
			const pos = kf.value as { x?: unknown; y?: unknown } | null | undefined;
			requireValue(
				pos &&
					typeof pos === "object" &&
					typeof pos.x === "number" &&
					Number.isFinite(pos.x) &&
					typeof pos.y === "number" &&
					Number.isFinite(pos.y),
				"Invalid position keyframe value",
			);
		} else {
			requireValue(
				typeof kf.value === "number" && Number.isFinite(kf.value),
				"Invalid numeric keyframe value",
			);
		}
		if (kf.bezier !== undefined) {
			requireValue(
				Array.isArray(kf.bezier) &&
					kf.bezier.length === 4 &&
					kf.bezier.every((n: unknown) => typeof n === "number" && Number.isFinite(n)),
				"Invalid keyframe bezier",
			);
		}
	}
	serializable(value);
}
const transitionEasings = ["linear", "ease-in", "ease-out", "ease-in-out"] as const;
const directions = ["left", "right", "up", "down"] as const;
const hexColor = (value: unknown): value is string =>
	typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
function object(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function shapeStyle(value: unknown) {
	requireValue(object(value), "Invalid shape style");
	requireValue(value.fill === null || hexColor(value.fill), "Invalid shape fill color");
	if (value.stroke !== null) {
		requireValue(
			object(value.stroke) &&
				hexColor(value.stroke.color) &&
				positive(value.stroke.width),
			"Invalid shape stroke color or width",
		);
	}
}
function shapePoint(value: unknown, width: number, height: number) {
	requireValue(
		object(value) &&
			typeof value.x === "number" &&
			Number.isFinite(value.x) &&
			value.x >= 0 &&
			value.x <= width &&
			typeof value.y === "number" &&
			Number.isFinite(value.y) &&
			value.y >= 0 &&
			value.y <= height,
		"Invalid shape geometry point",
	);
}
function shapeAsset(asset: MediaAsset) {
	const definition = asset.shapeDefinition;
	requireValue(
		definition && object(definition) &&
			integer(asset.durationUs) && asset.durationUs === 5_000_000 &&
			integer(asset.width) && asset.width > 0 &&
			integer(asset.height) && asset.height > 0 &&
			!asset.source && !asset.packageId,
		"Invalid pathless shape asset",
	);
	if (definition.kind === "rectangle" || definition.kind === "ellipse") {
		requireValue(
			positive(definition.width) && positive(definition.height) &&
			asset.width === Math.ceil(definition.width) &&
			asset.height === Math.ceil(definition.height),
		"Invalid shape geometry dimensions",
		);
		shapeStyle(definition.style);
		return;
	}
	requireValue(definition.kind === "line" || definition.kind === "arrow", "Invalid shape definition");
	shapePoint(definition.from, asset.width, asset.height);
	shapePoint(definition.to, asset.width, asset.height);
	requireValue(
		definition.from.x !== definition.to.x || definition.from.y !== definition.to.y,
		"Invalid shape line geometry: endpoints must differ",
	);
	if (definition.kind === "arrow")
		requireValue(positive(definition.headLength), "Invalid shape arrow head length");
	shapeStyle({ fill: null, stroke: definition.style?.stroke });
}
function componentAnimation(value: unknown) {
	requireValue(object(value), "Invalid component animation");
	const animation = value;
	requireValue(
		["fade", "slide", "scale-pop", "wipe-reveal"].includes(animation.preset as string),
		"Invalid component animation preset",
	);
	requireValue(
		integer(animation.durationUs) && animation.durationUs > 0 && animation.durationUs <= 2_000_000,
		"Invalid component animation duration",
	);
	requireValue(transitionEasings.includes(animation.easing as (typeof transitionEasings)[number]), "Invalid component animation easing");
	const directional = animation.preset === "slide" || animation.preset === "wipe-reveal";
	if (directional)
		requireValue(directions.includes(animation.direction as (typeof directions)[number]), "Invalid component animation direction");
	else requireValue(animation.direction === undefined, "Unexpected component animation direction");
	return animation.durationUs;
}
function clipTransitionPreset(value: unknown) {
	requireValue(object(value), "Invalid transition preset");
	switch (value.kind) {
		case "cross-dissolve":
			return;
		case "fade-through":
			requireValue(value.color === "black" || value.color === "white", "Invalid transition color");
			return;
		case "wipe":
		case "push":
			requireValue(directions.includes(value.direction as (typeof directions)[number]), "Invalid transition direction");
			return;
		default:
			requireValue(false, "Invalid transition preset");
	}
}
export function validateTimelineProject(value: unknown): TimelineProject {
	requireValue(value && typeof value === "object", "Invalid timeline project");
	const p = value as TimelineProject;
	requireValue(
		p.version === 3 &&
			typeof p.projectId === "string" &&
			/^[a-zA-Z0-9_-]+$/.test(p.projectId) &&
			typeof p.title === "string",
		"Invalid timeline identity",
	);
	requireValue(
		p.canvas &&
			integer(p.canvas.width) &&
			p.canvas.width > 0 &&
			integer(p.canvas.height) &&
			p.canvas.height > 0 &&
			positive(p.canvas.fps),
		"Invalid canvas",
	);
	for (const key of ["assets", "packages", "compositions", "tracks"] as const)
		requireValue(Array.isArray(p[key]), `Invalid ${key}`);
	const compositionOwners = new Set<string>();
	const ids = new Set<string>();
	const id = (v: string) => {
		requireValue(
			typeof v === "string" && /^[a-zA-Z0-9_-]+$/.test(v) && !ids.has(v),
			"Duplicate or invalid ID",
		);
		ids.add(v);
	};
	for (const r of p.packages) {
		id(r.id);
		requireValue(
			r.schemaVersion === 1 && typeof r.captureId === "string" && r.captureId.length > 0,
			"Invalid recording identity",
		);
		requireValue(
			integer(r.durationUs) &&
				r.durationUs > 0 &&
				integer(r.width) &&
				r.width > 0 &&
				integer(r.height) &&
				r.height > 0,
			"Invalid recording duration/dimensions",
		);
		source(r.screen, true);
		requireValue(
			r.screen.offsetUs === 0 && r.screen.durationUs >= r.durationUs,
			"Invalid recording screen range",
		);
		source(r.webcam);
		source(r.microphone);
		source(r.system);
		if (r.cursorPath) assertSafeMediaPath(r.cursorPath);
		requireValue(r.settings && typeof r.settings === "object", "Invalid recording settings");
		serializable(r.settings);
	}
	requireValue(
		new Set(p.packages.map((r) => r.captureId)).size === p.packages.length,
		"Duplicate capture ID",
	);
	for (const a of p.assets) {
		id(a.id);
		requireValue(
			["video", "image", "audio", "recording", "text", "shape"].includes(a.kind) &&
				typeof a.name === "string" &&
				integer(a.durationUs) &&
				a.durationUs > 0 &&
				integer(a.width) &&
				integer(a.height),
			"Invalid asset",
		);
		if (a.kind === "recording") {
			const pkg = p.packages.find((r) => r.id === a.packageId);
			requireValue(
				pkg && a.durationUs === pkg.durationUs,
				"Invalid recording asset reference",
			);
		} else if (a.kind === "text") {
			textOverlay(a.text);
			requireValue(!a.source && !a.packageId && !a.shapeDefinition, "Unexpected text asset metadata");
		} else if (a.kind === "shape") shapeAsset(a);
		else {
			requireValue(!a.shapeDefinition, "Unexpected shape definition");
			source(a.source, true);
		}
	}
	for (const c of p.compositions) {
		id(c.id);
		const pkg = p.packages.find((r) => r.id === c.packageId);
		requireValue(
			pkg &&
				integer(c.durationUs) &&
				c.durationUs > 0 &&
				integer(c.revision) &&
				Array.isArray(c.timeMap) &&
				c.timeMap.length > 0,
			"Invalid composition",
		);
		let end = 0,
			sourceEnd = 0;
		for (const s of c.timeMap) {
			requireValue(
				integer(s.outputStartUs) &&
					s.outputStartUs === end &&
					integer(s.outputEndUs) &&
					s.outputEndUs > s.outputStartUs &&
					integer(s.sourceStartUs) &&
					s.sourceStartUs >= sourceEnd &&
					positive(s.rate),
				"Invalid composition clock",
			);
			requireValue(
				s.sourceStartUs + (s.outputEndUs - s.outputStartUs) * s.rate <= pkg.durationUs + 1,
				"Composition exceeds recording",
			);
			sourceEnd = s.sourceStartUs + (s.outputEndUs - s.outputStartUs) * s.rate;
			end = s.outputEndUs;
		}
		requireValue(end === c.durationUs, "Composition duration mismatch");
		serializable(c.settings);
	}
	for (const t of p.tracks) {
		id(t.id);
		requireValue(
			["visual", "audio"].includes(t.kind) &&
				Array.isArray(t.clips) &&
				[t.locked, t.muted, t.hidden].every((v) => typeof v === "boolean"),
			"Invalid track",
		);
		let end = 0;
		for (const c of [...t.clips].sort((a, b) => a.startUs - b.startUs)) {
			id(c.id);
			const a = p.assets.find((a) => a.id === c.assetId);
			requireValue(a, "Missing clip asset");
			requireValue((t.kind === "audio") === (a.kind === "audio"), "Incompatible asset track");
			const composition = c.compositionId
				? p.compositions.find((e) => e.id === c.compositionId)
				: undefined;
			requireValue(
				a.kind !== "recording" || (composition && composition.packageId === a.packageId),
				"Missing clip composition",
			);
			requireValue(a.kind === "recording" || !c.compositionId, "Unexpected clip composition");
			if (a.kind === "text") textOverlay(c.text ?? a.text);
			else requireValue(!c.text, "Unexpected clip text overlay");
			if (composition) {
				requireValue(
					!compositionOwners.has(composition.id),
					"Shared clip composition ownership",
				);
				compositionOwners.add(composition.id);
			}
			const duration = composition?.durationUs ?? a.durationUs;
			requireValue(
				integer(c.startUs) &&
					integer(c.sourceInUs) &&
					integer(c.sourceOutUs) &&
					c.sourceOutUs > c.sourceInUs &&
					c.sourceOutUs <= duration &&
					positive(c.rate) &&
					c.rate >= 0.125 &&
					c.rate <= 8 &&
					clipDurationUs(c) > 0,
				"Invalid clip clock or rate",
			);
			requireValue(c.startUs >= end, "Clip overlap on track");
			end = c.startUs + clipDurationUs(c);
			requireValue(Number.isSafeInteger(end), "Unsafe clip end");
			requireValue(
				c.transform &&
					[
						c.transform.x,
						c.transform.y,
						c.transform.scale,
						c.transform.rotation,
						c.transform.opacity,
					].every((v) => typeof v === "number" && Number.isFinite(v)) &&
					c.transform.scale > 0 &&
					c.transform.opacity >= 0 &&
					c.transform.opacity <= 1 &&
					typeof c.gain === "number" &&
					Number.isFinite(c.gain) &&
					c.gain >= 0 &&
					typeof c.enabled === "boolean",
				"Invalid clip transform/gain",
			);
			clipKeyframes(c.keyframes);
			if (c.componentAnimation !== undefined) {
				requireValue(t.kind === "visual" && a.kind !== "audio", "Component animation requires a visual clip");
				requireValue(object(c.componentAnimation), "Invalid component animation settings");
				const enter = c.componentAnimation.enter === undefined ? 0 : componentAnimation(c.componentAnimation.enter);
				const exit = c.componentAnimation.exit === undefined ? 0 : componentAnimation(c.componentAnimation.exit);
				requireValue(enter + exit <= clipDurationUs(c), "Component animations overlap");
			}
			if (c.shapeStyleOverride !== undefined) {
				requireValue(a.kind === "shape", "Shape style override requires a shape asset");
				shapeStyle(c.shapeStyleOverride);
			}
		}
	}
	if (p.clipTransitions !== undefined) {
		requireValue(Array.isArray(p.clipTransitions), "Invalid clip transitions");
		const boundaries = new Set<string>();
		for (const rawTransition of p.clipTransitions) {
			requireValue(object(rawTransition), "Invalid clip transition");
			const transition = rawTransition;
			id(transition.id as string);
			const track = p.tracks.find((candidate) => candidate.id === transition.trackId);
			requireValue(track?.kind === "visual", "Transition must reference a visual track");
			const ordered = [...track.clips].sort((a, b) => a.startUs - b.startUs);
			const fromIndex = ordered.findIndex((clip) => clip.id === transition.fromClipId);
			const from = ordered[fromIndex];
			const to = ordered[fromIndex + 1];
			requireValue(
				fromIndex >= 0 && to && to.id === transition.toClipId &&
					from.enabled && to.enabled &&
					from.startUs + clipDurationUs(from) === to.startUs,
				"Invalid transition clip references or non-adjacent clips",
			);
			const boundary = `${transition.trackId}:${transition.fromClipId}:${transition.toClipId}`;
			requireValue(!boundaries.has(boundary), "Duplicate transition boundary");
			boundaries.add(boundary);
			requireValue(
				integer(transition.durationUs) && transition.durationUs > 0,
				"Invalid transition duration",
			);
			requireValue(
				transitionEasings.includes(transition.easing as (typeof transitionEasings)[number]),
				"Invalid transition easing",
			);
			clipTransitionPreset(transition.preset);
		}
		const projectEndUs = p.tracks.reduce(
			(endUs, track) => Math.max(endUs, ...track.clips.map((clip) => clip.startUs + clipDurationUs(clip))),
			0,
		);
		for (const transition of p.clipTransitions) {
			const track = p.tracks.find((candidate) => candidate.id === transition.trackId)!;
			const from = track.clips.find((clip) => clip.id === transition.fromClipId)!;
			const to = track.clips.find((clip) => clip.id === transition.toClipId)!;
			const fromAsset = p.assets.find((asset) => asset.id === from.assetId)!;
			const toAsset = p.assets.find((asset) => asset.id === to.assetId)!;
			const fromComposition = from.compositionId
				? p.compositions.find((composition) => composition.id === from.compositionId)
				: undefined;
			const outgoingTailUs = fromAsset.kind === "shape" || fromAsset.kind === "image"
				? Number.POSITIVE_INFINITY
				: Math.max(0, ((fromComposition?.durationUs ?? fromAsset.durationUs) - from.sourceOutUs) / from.rate);
			const incomingHeadUs = toAsset.kind === "shape" || toAsset.kind === "image"
				? Number.POSITIVE_INFINITY
				: to.sourceInUs / to.rate;
			const boundaryUs = to.startUs;
			let maximumUs = Math.min(outgoingTailUs, incomingHeadUs, boundaryUs, Math.max(0, projectEndUs - boundaryUs));
			maximumUs = Number.isFinite(maximumUs)
				? Math.max(0, Math.floor(maximumUs * 2))
				: Number.MAX_SAFE_INTEGER;
			for (const other of p.clipTransitions) {
				if (other.id === transition.id || other.trackId !== transition.trackId) continue;
				const otherBoundaryUs = track.clips.find((clip) => clip.id === other.toClipId)!.startUs;
				maximumUs = Math.min(
					maximumUs,
					Math.max(0, 2 * Math.abs(boundaryUs - otherBoundaryUs) - other.durationUs),
				);
			}
			requireValue(
				transition.durationUs <= maximumUs,
				"Transition exceeds available source handles or overlaps an adjacent transition",
			);
		}
	}
	return p;
}
