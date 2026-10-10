import {
	clipDurationUs,
	type MediaAsset,
	type MediaSource,
	type TimelineProject,
	type StoryClipContent,
} from "./types";
import { resolveClipSource } from "./clipSource";
import { getStoryProject } from "./storyOwnership";

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
function sameMetadata(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
	if (Array.isArray(a) || Array.isArray(b))
		return (
			Array.isArray(a) &&
			Array.isArray(b) &&
			a.length === b.length &&
			a.every((value, index) => sameMetadata(value, b[index]))
		);
	const left = a as Record<string, unknown>,
		right = b as Record<string, unknown>;
	const keys = Object.keys(left).filter((key) => left[key] !== undefined);
	return (
		keys.length === Object.keys(right).filter((key) => right[key] !== undefined).length &&
		keys.every((key) => sameMetadata(left[key], right[key]))
	);
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
			object(value.stroke) && hexColor(value.stroke.color) && positive(value.stroke.width),
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
		definition &&
			object(definition) &&
			integer(asset.durationUs) &&
			asset.durationUs === 5_000_000 &&
			integer(asset.width) &&
			asset.width > 0 &&
			integer(asset.height) &&
			asset.height > 0 &&
			!asset.source &&
			!asset.packageId,
		"Invalid pathless shape asset",
	);
	if (definition.kind === "rectangle" || definition.kind === "ellipse") {
		requireValue(
			positive(definition.width) &&
				positive(definition.height) &&
				asset.width === Math.ceil(definition.width) &&
				asset.height === Math.ceil(definition.height),
			"Invalid shape geometry dimensions",
		);
		shapeStyle(definition.style);
		return;
	}
	requireValue(
		definition.kind === "line" || definition.kind === "arrow",
		"Invalid shape definition",
	);
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
		integer(animation.durationUs) &&
			animation.durationUs > 0 &&
			animation.durationUs <= 2_000_000,
		"Invalid component animation duration",
	);
	requireValue(
		transitionEasings.includes(animation.easing as (typeof transitionEasings)[number]),
		"Invalid component animation easing",
	);
	const directional = animation.preset === "slide" || animation.preset === "wipe-reveal";
	if (directional)
		requireValue(
			directions.includes(animation.direction as (typeof directions)[number]),
			"Invalid component animation direction",
		);
	else
		requireValue(animation.direction === undefined, "Unexpected component animation direction");
	return animation.durationUs;
}
function clipTransitionPreset(value: unknown) {
	requireValue(object(value), "Invalid transition preset");
	switch (value.kind) {
		case "cross-dissolve":
			return;
		case "fade-through":
			requireValue(
				value.color === "black" || value.color === "white",
				"Invalid transition color",
			);
			return;
		case "wipe":
		case "push":
			requireValue(
				directions.includes(value.direction as (typeof directions)[number]),
				"Invalid transition direction",
			);
			return;
		default:
			requireValue(false, "Invalid transition preset");
	}
}
function inlineContent(value: StoryClipContent, width: number, height: number) {
	requireValue(
		object(value) && integer(value.durationUs) && value.durationUs > 0,
		"Invalid inline source extent",
	);
	if (value.kind === "text") {
		textOverlay(value.text);
		requireValue(!("shapeDefinition" in value), "Unexpected inline shape definition");
	} else {
		requireValue(
			value.kind === "shape" && object(value.shapeDefinition),
			"Invalid inline source kind",
		);
		requireValue(!("text" in value), "Unexpected inline text");
		const definition = value.shapeDefinition;
		if (definition.kind === "rectangle" || definition.kind === "ellipse") {
			width = Math.ceil(definition.width);
			height = Math.ceil(definition.height);
		} else if (definition.kind === "line" || definition.kind === "arrow") {
			requireValue(
				object(definition.from) && object(definition.to),
				"Invalid shape endpoints",
			);
			width = Math.max(1, Math.ceil(Math.max(definition.from.x, definition.to.x)));
			height = Math.max(1, Math.ceil(Math.max(definition.from.y, definition.to.y)));
		}
		// Reuse geometric validation; legacy shape Assets alone fix the source extent to five seconds.
		shapeAsset({
			id: "inline",
			kind: "shape",
			name: "Shape",
			width,
			height,
			durationUs: 5_000_000,
			shapeDefinition: definition,
		});
	}
	serializable(value);
}

export type TimelineValidationOptions = { mode: "legacy" | "canonical" };
/** Legacy is a bounded ingress/old-command compatibility mode; editable normalized output uses canonical. */
export function validateTimelineProject(
	value: unknown,
	options: TimelineValidationOptions = { mode: "legacy" },
): TimelineProject {
	requireValue(value && typeof value === "object", "Invalid timeline project");
	const p = value as TimelineProject;
	serializable(p);
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
	const privateLibraries = [
		p.localAssets,
		...(p.repurposeBoard?.artboards ?? []).map((ab) => ab.localAssets),
	];
	for (const library of privateLibraries) {
		if (library === undefined) continue;
		requireValue(Array.isArray(library), "Invalid private media library");
		for (const asset of library)
			requireValue(
				["video", "image", "audio"].includes(asset.kind),
				"Private media must be video, image, or audio",
			);
	}
	if (options.mode === "canonical")
		for (const asset of p.assets)
			requireValue(
				!["text", "shape"].includes(asset.kind),
				"Canonical global assets cannot contain designs",
			);
	for (const a of [...p.assets, ...privateLibraries.flatMap((library) => library ?? [])]) {
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
			requireValue(
				!a.source && !a.packageId && !a.shapeDefinition,
				"Unexpected text asset metadata",
			);
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
	function validateSequence(
		view: TimelineProject,
		id: (value: string) => void,
		compositionOwners: Set<string>,
	) {
		for (const t of view.tracks) {
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
				if (c.content !== undefined)
					inlineContent(c.content, view.canvas.width, view.canvas.height);
				const resolved = resolveClipSource(view, c);
				const a = resolved.media ?? {
					...resolved,
					packageId: undefined,
					text: c.content?.kind === "text" ? c.content.text : undefined,
				};
				if (options.mode === "canonical" || c.content !== undefined)
					requireValue(c.text === undefined, "Unexpected legacy clip text overlay");
				requireValue(
					(t.kind === "audio") === (a.kind === "audio"),
					"Incompatible asset track",
				);
				const composition = c.compositionId
					? view.compositions.find((e) => e.id === c.compositionId)
					: undefined;
				requireValue(
					a.kind !== "recording" ||
						(composition && composition.packageId === a.packageId),
					"Missing clip composition",
				);
				requireValue(
					a.kind === "recording" || !c.compositionId,
					"Unexpected clip composition",
				);
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
					requireValue(
						t.kind === "visual" && a.kind !== "audio",
						"Component animation requires a visual clip",
					);
					requireValue(
						object(c.componentAnimation),
						"Invalid component animation settings",
					);
					const enter =
						c.componentAnimation.enter === undefined
							? 0
							: componentAnimation(c.componentAnimation.enter);
					const exit =
						c.componentAnimation.exit === undefined
							? 0
							: componentAnimation(c.componentAnimation.exit);
					requireValue(enter + exit <= clipDurationUs(c), "Component animations overlap");
				}
				if (c.shapeStyleOverride !== undefined) {
					requireValue(a.kind === "shape", "Shape style override requires a shape asset");
					shapeStyle(c.shapeStyleOverride);
				}
			}
		}
		if (view.clipTransitions !== undefined) {
			requireValue(Array.isArray(view.clipTransitions), "Invalid clip transitions");
			const boundaries = new Set<string>();
			for (const rawTransition of view.clipTransitions) {
				requireValue(object(rawTransition), "Invalid clip transition");
				const transition = rawTransition;
				id(transition.id as string);
				const track = view.tracks.find((candidate) => candidate.id === transition.trackId);
				requireValue(track?.kind === "visual", "Transition must reference a visual track");
				const ordered = [...track.clips].sort((a, b) => a.startUs - b.startUs);
				const fromIndex = ordered.findIndex((clip) => clip.id === transition.fromClipId);
				const from = ordered[fromIndex];
				const to = ordered[fromIndex + 1];
				requireValue(
					fromIndex >= 0 &&
						to &&
						to.id === transition.toClipId &&
						from.enabled &&
						to.enabled &&
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
					transitionEasings.includes(
						transition.easing as (typeof transitionEasings)[number],
					),
					"Invalid transition easing",
				);
				clipTransitionPreset(transition.preset);
			}
			const projectEndUs = view.tracks.reduce(
				(endUs, track) =>
					Math.max(
						endUs,
						...track.clips.map((clip) => clip.startUs + clipDurationUs(clip)),
					),
				0,
			);
			for (const transition of view.clipTransitions) {
				const track = view.tracks.find((candidate) => candidate.id === transition.trackId)!;
				const from = track.clips.find((clip) => clip.id === transition.fromClipId)!;
				const to = track.clips.find((clip) => clip.id === transition.toClipId)!;
				const fromAsset = resolveClipSource(view, from);
				const toAsset = resolveClipSource(view, to);
				const fromComposition = from.compositionId
					? view.compositions.find((composition) => composition.id === from.compositionId)
					: undefined;
				const outgoingTailUs =
					!fromAsset.content && (fromAsset.kind === "shape" || fromAsset.kind === "image")
						? Number.POSITIVE_INFINITY
						: Math.max(
								0,
								((fromComposition?.durationUs ?? fromAsset.durationUs) -
									from.sourceOutUs) /
									from.rate,
							);
				const incomingHeadUs =
					!toAsset.content && (toAsset.kind === "shape" || toAsset.kind === "image")
						? Number.POSITIVE_INFINITY
						: to.sourceInUs / to.rate;
				const boundaryUs = to.startUs;
				let maximumUs = Math.min(
					outgoingTailUs,
					incomingHeadUs,
					boundaryUs,
					Math.max(0, projectEndUs - boundaryUs),
				);
				maximumUs = Number.isFinite(maximumUs)
					? Math.max(0, Math.floor(maximumUs * 2))
					: Number.MAX_SAFE_INTEGER;
				for (const other of view.clipTransitions) {
					if (other.id === transition.id || other.trackId !== transition.trackId)
						continue;
					const otherBoundaryUs = track.clips.find(
						(clip) => clip.id === other.toClipId,
					)!.startUs;
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
	}
	validateSequence(p, id, compositionOwners);
	if (p.repurposeBoard) {
		requireValue(Array.isArray(p.repurposeBoard.artboards), "Invalid repurpose artboards");
		requireValue(Array.isArray(p.repurposeBoard.slices), "Invalid repurpose slices");
		const artboardIds = new Set<string>();
		for (const ab of p.repurposeBoard.artboards) {
			requireValue(!artboardIds.has(ab.id), "Duplicate artboard ID");
			artboardIds.add(ab.id);
			requireValue(typeof ab.id === "string" && ab.id.length > 0, "Invalid artboard ID");
			requireValue(typeof ab.name === "string", "Invalid artboard name");
			requireValue(integer(ab.width) && ab.width > 0, "Invalid artboard width");
			requireValue(integer(ab.height) && ab.height > 0, "Invalid artboard height");
			requireValue(ab.framing && typeof ab.framing === "object", "Invalid artboard framing");
			requireValue(
				Number.isFinite(ab.framing.scale) && ab.framing.scale > 0,
				"Invalid artboard scale",
			);
			requireValue(
				Number.isFinite(ab.framing.offsetX) && Number.isFinite(ab.framing.offsetY),
				"Invalid artboard offset",
			);
			if (ab.tracks !== undefined) {
				requireValue(Array.isArray(ab.tracks), "Invalid artboard tracks");
			}
			if (ab.clipTransitions !== undefined) {
				requireValue(
					Array.isArray(ab.clipTransitions),
					"Invalid artboard clip transitions",
				);
			}
			if (options.mode === "canonical")
				requireValue(
					ab.tracks !== undefined,
					"Canonical Story owner must have explicit tracks",
				);
			if (ab.tracks !== undefined) {
				const view = getStoryProject(p, { kind: "artboard", artboardId: ab.id });
				// Old Artboard snapshots may share placement IDs until normalization remaps them.
				const localIds = new Set<string>();
				const legacyId = (value: string) => {
					requireValue(
						typeof value === "string" &&
							/^[a-zA-Z0-9_-]+$/.test(value) &&
							!localIds.has(value),
						"Duplicate or invalid ID",
					);
					localIds.add(value);
				};
				validateSequence(
					view,
					options.mode === "canonical" ? id : legacyId,
					options.mode === "canonical" ? compositionOwners : new Set(),
				);
			}
		}
		for (const slice of p.repurposeBoard.slices) {
			requireValue(typeof slice.id === "string" && slice.id.length > 0, "Invalid slice ID");
			requireValue(typeof slice.name === "string", "Invalid slice name");
			requireValue(integer(slice.startUs) && integer(slice.endUs), "Invalid slice clock");
			requireValue(slice.endUs > slice.startUs, "Slice end must be after start");
		}
	}
	if (p.designTemplates !== undefined) {
		requireValue(Array.isArray(p.designTemplates), "Invalid design templates");
		for (const template of p.designTemplates) {
			id(template.id);
			requireValue(
				typeof template.name === "string" &&
					template.content &&
					template.kind === template.content.kind,
				"Invalid template kind or name",
			);
			requireValue(
				integer(template.width) &&
					template.width > 0 &&
					integer(template.height) &&
					template.height > 0 &&
					integer(template.defaultDurationUs) &&
					template.defaultDurationUs > 0 &&
					template.defaultDurationUs <= template.content.durationUs,
				"Invalid template dimensions or duration",
			);
			inlineContent(template.content, template.width, template.height);
		}
	}
	if (p.stories) {
		requireValue(Array.isArray(p.stories), "Invalid stories: must be an array");
		const storyIds = new Set<string>();
		for (const story of p.stories) {
			requireValue(typeof story.id === "string" && story.id.length > 0, "Invalid story ID");
			requireValue(!storyIds.has(story.id), "Duplicate story ID");
			storyIds.add(story.id);
			requireValue(
				typeof story.name === "string" && story.name.length > 0,
				"Invalid story name",
			);
			requireValue(
				story.canvas && integer(story.canvas.width) && integer(story.canvas.height),
				"Invalid story canvas",
			);
			requireValue(Array.isArray(story.tracks), "Invalid story tracks");
			const candidates = (p.repurposeBoard?.artboards ?? []).filter((ab) =>
				story.artboardId !== undefined
					? ab.id === story.artboardId
					: ab.id === story.id || `story-${ab.id}` === story.id,
			);
			requireValue(candidates.length <= 1, "Ambiguous Story owner");
			const artboard = candidates[0];
			const isRoot =
				story.artboardId === undefined && story.id === (p.defaultStoryId ?? "story-main");
			requireValue(!(isRoot && artboard), "Ambiguous root Story owner");
			if (story.artboardId !== undefined)
				requireValue(artboard, "Missing Story projection owner");
			if (options.mode === "canonical")
				requireValue(isRoot || artboard, "Standalone Story must be normalized to an owner");
			const owner = isRoot ? p : artboard;
			if (owner && story.localAssets !== undefined) {
				requireValue(
					Array.isArray(story.localAssets),
					"Invalid Story private media mirror",
				);
				for (const media of story.localAssets) {
					const canonical = owner.localAssets?.find((asset) => asset.id === media.id);
					// Missing metadata in old owners may be hydrated at the normalization boundary.
					if (options.mode === "canonical" || owner.localAssets !== undefined)
						requireValue(
							canonical && sameMetadata(canonical, media),
							"Inconsistent Story private media mirror",
						);
				}
			}
			// Projection IDs and composition references are checked independently, not registered
			// again in the canonical owner sets. Standalone legacy Stories are ingress only.
			validateTimelineProject(
				{
					...p,
					canvas: story.canvas,
					tracks: story.tracks,
					localAssets:
						owner?.localAssets ??
						(options.mode === "legacy" ? story.localAssets : undefined),
					clipTransitions: story.clipTransitions,
					subtitles: story.subtitles,
					repurposeBoard: undefined,
					stories: undefined,
					designTemplates: undefined,
				},
				options,
			);
		}
	}
	if (p.storyManifest) {
		requireValue(Array.isArray(p.storyManifest), "Invalid story manifest");
		for (const item of p.storyManifest) {
			requireValue(
				typeof item.id === "string" && item.id.length > 0,
				"Invalid story manifest ID",
			);
			requireValue(
				typeof item.file === "string" && !item.file.includes(".."),
				"Invalid story manifest file path",
			);
		}
	}
	if (p.hyperframes) {
		requireValue(Array.isArray(p.hyperframes), "Invalid hyperframes: must be an array");
		for (const hf of p.hyperframes) {
			requireValue(typeof hf.id === "string" && hf.id.length > 0, "Invalid hyperframe ID");
			requireValue(
				typeof hf.name === "string" && hf.name.length > 0,
				"Invalid hyperframe name",
			);
			requireValue(
				typeof hf.entryHtml === "string" && !hf.entryHtml.includes(".."),
				"Invalid hyperframe entry path",
			);
			requireValue(
				integer(hf.width) && hf.width > 0 && integer(hf.height) && hf.height > 0,
				"Invalid hyperframe dimensions",
			);
			requireValue(positive(hf.durationUs), "Invalid hyperframe duration");
		}
	}
	if (p.hyperframeManifest) {
		requireValue(Array.isArray(p.hyperframeManifest), "Invalid hyperframe manifest");
		for (const item of p.hyperframeManifest) {
			requireValue(
				typeof item.id === "string" && item.id.length > 0,
				"Invalid hyperframe manifest ID",
			);
			requireValue(
				typeof item.entryHtml === "string" && !item.entryHtml.includes(".."),
				"Invalid hyperframe manifest entry path",
			);
		}
	}
	if (p.whiteboardSnapshot !== undefined) {
		requireValue(
			p.whiteboardSnapshot !== null &&
				typeof p.whiteboardSnapshot === "object" &&
				!Array.isArray(p.whiteboardSnapshot),
			"Invalid whiteboard snapshot: must be an object",
		);
	}
	if (p.terminalConfig !== undefined) {
		requireValue(
			p.terminalConfig !== null &&
				typeof p.terminalConfig === "object" &&
				!Array.isArray(p.terminalConfig),
			"Invalid project terminal config: must be an object",
		);
		if (p.terminalConfig.preferredShell !== undefined) {
			requireValue(
				["powershell", "cmd", "bash", "default"].includes(p.terminalConfig.preferredShell),
				"Invalid terminal preferred shell",
			);
		}
		if (p.terminalConfig.startupCommand !== undefined) {
			requireValue(
				typeof p.terminalConfig.startupCommand === "string",
				"Invalid terminal startup command",
			);
		}
		if (p.terminalConfig.customEnv !== undefined) {
			requireValue(
				p.terminalConfig.customEnv !== null &&
					typeof p.terminalConfig.customEnv === "object" &&
					!Array.isArray(p.terminalConfig.customEnv),
				"Invalid terminal custom env",
			);
		}
	}
	return p;
}
