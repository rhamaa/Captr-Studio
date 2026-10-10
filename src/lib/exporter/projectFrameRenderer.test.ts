import { afterEach, expect, it, vi } from "vitest";
import {
	createTimelineProject,
	placeAsset,
	registerMedia,
	registerRecording,
	updateComposition,
} from "@/core/timeline/commands";
import { evaluateProject } from "@/core/timeline/evaluation";
import { createAndPlaceShape, setShapeStyleOverride } from "@/core/timeline/shapeCommands";
import type { ClipTransitionPreset, ShapeDefinition, TimelineProject } from "@/core/timeline/types";

const configs = vi.hoisted(() => [] as any[]);
const videoFrames = vi.hoisted(() => [] as any[]);
const renderedCanvases = vi.hoisted(() => [] as any[]);
vi.mock("./frameRenderer", () => ({
	FrameRenderer: class {
		constructor(config: any) {
			configs.push(config);
		}
		async initialize() {}
		async renderFrame() {}
		getCanvas() {
			return { width: 100, height: 100, marker: "record-effect-frame" };
		}
		setProjectWebcamFrame() {}
		destroy() {}
	},
}));
vi.mock("./layerVideoSource", () => ({
	LayerVideoSource: class {
		path = "";
		async load(path: string) { this.path = path; }
		async frame(timeSec: number, options?: unknown) {
			videoFrames.push({ timeSec, options });
			return { width: 2, height: 2, marker: `video:${this.path}:${timeSec}` };
		}
		destroy() {}
	},
}));

import { ProjectFrameRenderer } from "./projectFrameRenderer";

afterEach(() => {
	vi.unstubAllGlobals();
	configs.length = 0;
	videoFrames.length = 0;
	renderedCanvases.length = 0;
});

function installCanvas() {
	const makeCanvas = () => {
		const canvas: any = { width: 0, height: 0, marker: "canvas" };
		const context: any = {
			operations: [],
			globalAlpha: 1,
			globalCompositeOperation: "source-over",
			fillStyle: "#000",
			strokeStyle: "#000",
			lineWidth: 1,
			font: "",
			textAlign: "center",
			textBaseline: "middle",
				record(name: string, ...args: unknown[]) {
					this.operations.push({ name, args, alpha: this.globalAlpha, composite: this.globalCompositeOperation, fill: this.fillStyle, stroke: this.strokeStyle, lineWidth: this.lineWidth });
			},
			fillRect(...args: unknown[]) { this.record("fillRect", ...args); },
			strokeRect(...args: unknown[]) { this.record("strokeRect", ...args); },
			beginPath() { this.record("beginPath"); },
			closePath() { this.record("closePath"); },
			ellipse(...args: unknown[]) { this.record("ellipse", ...args); },
			moveTo(...args: unknown[]) { this.record("moveTo", ...args); },
			lineTo(...args: unknown[]) { this.record("lineTo", ...args); },
			fill() { this.record("fill"); },
			stroke() { this.record("stroke"); },
			save() { this.record("save"); },
			restore() { this.record("restore"); },
			translate(...args: unknown[]) { this.record("translate", ...args); },
			rotate(...args: unknown[]) { this.record("rotate", ...args); },
			scale(...args: unknown[]) { this.record("scale", ...args); },
			drawImage(source: any, ...args: unknown[]) { this.record("drawImage", source?.marker ?? source, ...args); },
			clearRect(...args: unknown[]) { this.record("clearRect", ...args); },
			fillText(...args: unknown[]) { this.record("fillText", ...args); },
			rect(...args: unknown[]) { this.record("rect", ...args); },
			clip() { this.record("clip"); },
			getImageData() {
				const marker = JSON.stringify(this.operations.slice(this.lastFrameStart ?? 0));
				const data = new Uint8ClampedArray(16);
				for (let i = 0; i < Math.min(marker.length, data.length); i++) data[i] = marker.charCodeAt(i);
				return { data };
			},
		};
		canvas.context = context;
		canvas.getContext = () => context;
		renderedCanvases.push(canvas);
		return canvas;
	};
	vi.stubGlobal("document", { createElement: () => makeCanvas() });
	vi.stubGlobal("VideoFrame", class { close() {} });
	vi.stubGlobal("HTMLVideoElement", class {});
	vi.stubGlobal("HTMLImageElement", class {});
	return () => renderedCanvases;
}

function videoProject(): TimelineProject {
	const base = createTimelineProject("p", "P");
	const withOutgoing = registerMedia(base, {
		id: "a", kind: "video", name: "Outgoing", durationUs: 2_000_000, width: 2, height: 2,
		source: { path: "outgoing.mp4", durationUs: 4_000_000, offsetUs: 0 },
	});
	const withIncoming = registerMedia(withOutgoing, {
		id: "b", kind: "video", name: "Incoming", durationUs: 2_000_000, width: 2, height: 2,
		source: { path: "incoming.mp4", durationUs: 4_000_000, offsetUs: 0 },
	});
	const first = placeAsset(withIncoming, "a", "visual-1", 0, { clipId: "from" });
	const project = placeAsset(first, "b", "visual-1", 2_000_000, { clipId: "to" });
	const [outgoing, incoming] = project.tracks[0]!.clips;
	outgoing!.sourceOutUs = 1_800_000;
	incoming!.startUs = 1_800_000;
	incoming!.sourceInUs = 200_000;
	return project;
}

function addTransition(project: TimelineProject, preset: ClipTransitionPreset, durationUs = 400_000) {
	return {
		...project,
		clipTransitions: [{ id: "transition", trackId: "visual-1", fromClipId: "from", toClipId: "to", preset, durationUs, easing: "linear" as const }],
	};
}

function shapeProject(shape: ShapeDefinition): TimelineProject {
	return createAndPlaceShape(createTimelineProject("shape", "Shape"), shape, 0, {
		assetId: "shape-asset", clipId: "shape-clip", trackId: "new-track",
	});
}
it("undo followed by another edit at the same revision uses different effect settings", async () => {
	vi.stubGlobal("document", {
		createElement: () => ({
			getContext: () => ({
				fillRect() {},
				save() {},
				restore() {},
				translate() {},
				rotate() {},
				scale() {},
				drawImage() {},
				clearRect() {},
			}),
		}),
	});
	vi.stubGlobal(
		"VideoFrame",
		class {
			close() {}
		},
	);
	vi.stubGlobal("HTMLVideoElement", class {});
	vi.stubGlobal("HTMLImageElement", class {});
	const base = placeAsset(
		registerRecording(
			createTimelineProject("p", "P"),
			{
				captureId: "r",
				name: "R",
				durationUs: 1_000_000,
				width: 100,
				height: 100,
				screen: { path: "screen.mp4", durationUs: 1_000_000, offsetUs: 0 },
				settings: {},
			},
			{ assetId: "a", packageId: "pkg" },
		),
		"a",
		"visual-1",
		0,
		{ clipId: "c", compositionId: "e" },
	);
	const first = updateComposition(base, "e", {
		...base.compositions[0],
		settings: { background: "#ff0000" },
	});
	const alternate = updateComposition(base, "e", {
		...base.compositions[0],
		settings: { background: "#0000ff" },
	});
	expect(first.compositions[0].revision).toBe(alternate.compositions[0].revision);
	const renderer = new ProjectFrameRenderer();
	await renderer.render(evaluateProject(first, 0));
	await renderer.render(evaluateProject(base, 0));
	await renderer.render(evaluateProject(alternate, 0));
	expect(configs.map((c) => c.background)).toEqual(["#ff0000", undefined, "#0000ff"]);
	await renderer.render(evaluateProject(first, 0));
	expect(configs).toHaveLength(3);
	await renderer.render(evaluateProject(first, 0), { continuousPlayback: true });
	expect(videoFrames.at(-1)).toEqual({
		timeSec: 0,
		options: { continuousPlayback: true, playbackRate: 1 },
	});
	renderer.destroy();
});

it.each([
	["rectangle", { kind: "rectangle", width: 120, height: 60, style: { fill: "#ff0000", stroke: null } }],
	["ellipse", { kind: "ellipse", width: 120, height: 60, style: { fill: null, stroke: { color: "#00ff00", width: 3 } } }],
	["line", { kind: "line", from: { x: 0, y: 0 }, to: { x: 100, y: 40 }, style: { stroke: { color: "#0000ff", width: 2 } } }],
	["arrow", { kind: "arrow", from: { x: 0, y: 20 }, to: { x: 100, y: 20 }, headLength: 16, style: { stroke: { color: "#ffffff", width: 4 } } }],
] as const)("projectFrameRenderer renders the %s shape primitive", async (_name, shape) => {
	const canvases = installCanvas();
	const renderer = new ProjectFrameRenderer();
	await renderer.render(evaluateProject(shapeProject(shape as ShapeDefinition), 0));
	const operations = canvases().flatMap((canvas: any) => canvas.context.operations);
	if (_name === "rectangle") expect(operations.some((op: any) => op.name === "fillRect" && op.fill === "#ff0000")).toBe(true);
	if (_name === "ellipse") expect(operations.some((op: any) => op.name === "ellipse")).toBe(true);
	if (_name === "line" || _name === "arrow") expect(operations.filter((op: any) => op.name === "lineTo").length).toBeGreaterThan(0);
	renderer.destroy();
});

it("projectFrameRenderer applies per-placement shape style without changing the shared asset", async () => {
	const canvases = installCanvas();
	const definition: ShapeDefinition = { kind: "rectangle", width: 100, height: 50, style: { fill: "#0000ff", stroke: null } };
	let project = shapeProject(definition);
	project = placeAsset(project, "shape-asset", "visual-1", 6_000_000, { clipId: "second-placement" });
	project = setShapeStyleOverride(project, "second-placement", { fill: "#ff0000", stroke: null });
	const renderer = new ProjectFrameRenderer();
	await renderer.render(evaluateProject(project, 0));
	await renderer.render(evaluateProject(project, 6_000_000));
	const fills = canvases().flatMap((canvas: any) => canvas.context.operations).filter((op: any) => op.name === "fillRect").map((op: any) => op.fill);
	expect(fills).toContain("#0000ff");
	expect(fills).toContain("#ff0000");
	expect(project.assets[0]!.shapeDefinition?.kind).toBe("rectangle");
	renderer.destroy();
});

it.each([
	["cross dissolve", { kind: "cross-dissolve" }, (ops: any[]) => ops.filter((op) => op.name === "drawImage" && op.alpha === 0.5 && op.composite === "lighter").length >= 2],
	["fade through", { kind: "fade-through", color: "white" }, (ops: any[]) => ops.some((op) => op.name === "fillRect" && op.fill === "#fff")],
	["wipe", { kind: "wipe", direction: "left" }, (ops: any[]) => ops.some((op) => op.name === "clip")],
	["push", { kind: "push", direction: "right" }, (ops: any[]) => ops.some((op) => op.name === "drawImage" && [960, -960].includes(op.args[1]))],
] as const)("projectFrameRenderer composites the %s transition", async (_name, preset, hasExpectedComposite) => {
	const canvases = installCanvas();
	const project = addTransition(videoProject(), preset as ClipTransitionPreset);
	const renderer = new ProjectFrameRenderer();
	await renderer.render(evaluateProject(project, 1_800_000));
	const operations = canvases().flatMap((canvas: any) => canvas.context.operations);
	expect(hasExpectedComposite(operations)).toBe(true);
	const main = (renderer as any).canvas;
	expect(main.context.operations.some((operation: any) => operation.name === "drawImage")).toBe(true);
	renderer.destroy();
});

it.each([
	["fade", (ops: any[]) => ops.some((op) => op.name === "drawImage" && op.alpha === 0.5)],
	["slide", (ops: any[]) => ops.some((op) => op.name === "translate" && op.args[0] < 980)],
	["scale-pop", (ops: any[]) => ops.some((op) => op.name === "scale" && Math.abs(op.args[0] - 0.925) < 1e-9)],
	["wipe-reveal", (ops: any[]) => ops.some((op) => op.name === "clip")],
] as const)("projectFrameRenderer applies %s enter animation after clip transform", async (preset, check) => {
	const canvases = installCanvas();
	const project = videoProject();
	const clip = project.tracks[0]!.clips[0]!;
	clip.componentAnimation = { enter: { preset, durationUs: 500_000, easing: "linear", direction: "left" } };
	clip.transform.x = 20;
	const renderer = new ProjectFrameRenderer();
	await renderer.render(evaluateProject(project, 250_000));
	const operations = canvases().flatMap((canvas: any) => canvas.context.operations);
	expect(check(operations)).toBe(true);
	renderer.destroy();
});

it("projectFrameRenderer starts Push from the selected incoming edge", async () => {
	const canvases = installCanvas();
	const project = addTransition(videoProject(), { kind: "push", direction: "right" });
	const renderer = new ProjectFrameRenderer();
	await renderer.render(evaluateProject(project, 1_600_000));
	const transitionCanvas = canvases()[3]!;
	const draws = transitionCanvas.context.operations.filter((op: any) => op.name === "drawImage");
	expect(draws).toHaveLength(2);
	expect(draws[0]!.args[1]).toBeCloseTo(0);
	expect(draws[1]!.args[1]).toBe(1920);
	renderer.destroy();
});

it("projectFrameRenderer composites the fully effected Record frame during a transition", async () => {
	const canvases = installCanvas();
	const recording = registerRecording(createTimelineProject("p", "P"), {
		captureId: "capture", name: "Record", durationUs: 2_000_000, width: 100, height: 100,
		screen: { path: "record.mp4", durationUs: 2_000_000, offsetUs: 0 }, settings: {},
	}, { assetId: "record-asset", packageId: "record-package" });
	const media = registerMedia(recording, {
		id: "video-asset", kind: "video", name: "Incoming", durationUs: 2_000_000, width: 100, height: 100,
		source: { path: "incoming.mp4", durationUs: 2_000_000, offsetUs: 0 },
	});
	const placedRecord = placeAsset(media, "record-asset", "visual-1", 0, { clipId: "record-clip", compositionId: "record-composition" });
	const placed = placeAsset(placedRecord, "video-asset", "visual-1", 2_000_000, { clipId: "incoming-clip" });
	placed.tracks[0]!.clips[0]!.sourceOutUs = 1_800_000;
	placed.tracks[0]!.clips[1]!.startUs = 1_800_000;
	placed.tracks[0]!.clips[1]!.sourceInUs = 200_000;
	placed.clipTransitions = [{ id: "record-transition", trackId: "visual-1", fromClipId: "record-clip", toClipId: "incoming-clip", preset: { kind: "cross-dissolve" }, durationUs: 400_000, easing: "linear" }];
	const renderer = new ProjectFrameRenderer();
	await renderer.render(evaluateProject(placed, 1_800_000));
	expect(configs).toHaveLength(1);
	expect(videoFrames).toHaveLength(2);
	expect(canvases().flatMap((canvas: any) => canvas.context.operations).some((op: any) => op.name === "drawImage" && op.args[0] === "record-effect-frame")).toBe(true);
	renderer.destroy();
});
