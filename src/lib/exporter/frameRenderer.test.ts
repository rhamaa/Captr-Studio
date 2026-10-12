import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WEBCAM_OVERLAY } from "../../components/video-editor/types";

const {
	cancelForwardFrameSourceMock,
	destroyForwardFrameSourceMock,
	getForwardFrameAtTimeMock,
	initializeForwardFrameSourceMock,
	resolveMediaElementSourceMock,
} = vi.hoisted(() => ({
	cancelForwardFrameSourceMock: vi.fn(),
	destroyForwardFrameSourceMock: vi.fn(async () => undefined),
	getForwardFrameAtTimeMock: vi.fn(async () => null),
	initializeForwardFrameSourceMock: vi.fn(async () => undefined),
	resolveMediaElementSourceMock: vi.fn(async () => ({
		src: "blob:background",
		revoke: vi.fn(),
	})),
}));

vi.mock("pixi.js", () => ({
	Application: vi.fn(),
	Container: vi.fn(),
	Sprite: vi.fn(),
	Graphics: vi.fn(),
	BlurFilter: vi.fn(),
	Texture: {
		from: vi.fn(() => ({ destroy: vi.fn() })),
	},
}));

vi.mock("pixi-filters/motion-blur", () => ({
	MotionBlurFilter: vi.fn(),
}));

vi.mock("@/lib/assetPath", () => ({
	getAssetPath: vi.fn(async (value: string) => value),
	getExportableVideoUrl: vi.fn(async (value: string) => value),
	getRenderableAssetUrl: vi.fn((value: string) => value),
}));

vi.mock("@/components/video-editor/videoPlayback/zoomRegionUtils", () => ({
	findDominantRegion: vi.fn(() => ({
		region: null,
		strength: 0,
		blendedScale: 1,
		transition: null,
	})),
}));

vi.mock("@/components/video-editor/videoPlayback/zoomTransform", () => ({
	applyZoomTransform: vi.fn(),
	computeFocusFromTransform: vi.fn(() => ({ cx: 0.5, cy: 0.5 })),
	computeZoomTransform: vi.fn(() => ({ scale: 1, x: 0, y: 0 })),
	createMotionBlurState: vi.fn(() => ({})),
}));

vi.mock("./annotationRenderer", () => ({
	renderAnnotations: vi.fn(),
}));

vi.mock("@/components/video-editor/videoPlayback/cursorRenderer", () => ({
	PixiCursorOverlay: class {
		container = {};
		update = vi.fn();
		destroy = vi.fn();
	},
	DEFAULT_CURSOR_CONFIG: {
		dotRadius: 28,
		smoothingFactor: 0.18,
		motionBlur: 0,
		clickBounce: 1,
		sway: 0,
	},
	preloadCursorAssets: vi.fn(async () => undefined),
}));

vi.mock("./forwardFrameSource", () => ({
	ForwardFrameSource: class {
		cancel = cancelForwardFrameSourceMock;
		destroy = destroyForwardFrameSourceMock;
		getFrameAtTime = getForwardFrameAtTimeMock;
		initialize = initializeForwardFrameSourceMock;
	},
}));

vi.mock("./localMediaSource", () => ({
	resolveMediaElementSource: resolveMediaElementSourceMock,
}));

import { FrameRenderer } from "./frameRenderer";

type MockFunction = ReturnType<typeof vi.fn>;
type MockContext = {
	beginPath: MockFunction;
	roundRect: MockFunction;
	moveTo: MockFunction;
	lineTo: MockFunction;
	closePath: MockFunction;
	clip: MockFunction;
	drawImage: MockFunction;
	fillRect: MockFunction;
	save: MockFunction;
	restore: MockFunction;
	translate: MockFunction;
	scale: MockFunction;
	clearRect: MockFunction;
	filter: string;
};
type MockCanvas = ReturnType<typeof createMockCanvas>;
type FrameRendererTestAccess = {
	webcamVideoElement: FakeVideoElement | null;
	webcamSeekPromise: Promise<void> | null;
	webcamFrameCacheCanvas: MockCanvas | null;
	webcamFrameCacheCtx: CanvasRenderingContext2D | null;
	lastSyncedWebcamTime: number | null;
	currentVideoTime: number;
	animationState: { appliedScale: number };
	syncWebcamFrame: (targetTimeSec: number) => Promise<void>;
	drawWebcamOverlay: (
		outputCtx: CanvasRenderingContext2D,
		outputWidth: number,
		outputHeight: number,
	) => void;
};

type Listener = {
	callback: () => void;
	once: boolean;
};

class FakeVideoElement {
	duration: number;
	readyState: number;
	seeking = false;
	videoWidth: number;
	videoHeight: number;
	muted = true;
	preload = "auto";
	playsInline = true;
	src = "";

	private currentTimeValue: number;
	private listeners = new Map<string, Listener[]>();

	constructor({
		duration = 5,
		currentTime = 0,
		readyState = 2,
		videoWidth = 1280,
		videoHeight = 720,
	}: {
		duration?: number;
		currentTime?: number;
		readyState?: number;
		videoWidth?: number;
		videoHeight?: number;
	} = {}) {
		this.duration = duration;
		this.currentTimeValue = currentTime;
		this.readyState = readyState;
		this.videoWidth = videoWidth;
		this.videoHeight = videoHeight;
	}

	get currentTime() {
		return this.currentTimeValue;
	}

	set currentTime(next: number) {
		this.currentTimeValue = next;
		this.seeking = true;
		queueMicrotask(() => {
			this.seeking = false;
			this.dispatch("seeked");
		});
	}

	addEventListener(
		name: string,
		callback: () => void,
		options?: boolean | AddEventListenerOptions,
	) {
		const listeners = this.listeners.get(name) ?? [];
		listeners.push({
			callback,
			once: !!(typeof options === "object" && options?.once),
		});
		this.listeners.set(name, listeners);
	}

	removeEventListener(name: string, callback: () => void) {
		const listeners = this.listeners.get(name) ?? [];
		this.listeners.set(
			name,
			listeners.filter((listener) => listener.callback !== callback),
		);
	}

	load() {
		// Intentional no-op for the mock video element.
	}

	pause() {
		// Intentional no-op for the mock video element.
	}

	private dispatch(name: string) {
		const listeners = [...(this.listeners.get(name) ?? [])];
		if (listeners.length === 0) {
			return;
		}

		for (const listener of listeners) {
			listener.callback();
			if (listener.once) {
				this.removeEventListener(name, listener.callback);
			}
		}
	}
}

function createMockContext() {
	return {
		beginPath: vi.fn(),
		roundRect: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		closePath: vi.fn(),
		clip: vi.fn(),
		drawImage: vi.fn(),
		fillRect: vi.fn(),
		arc: vi.fn(),
		ellipse: vi.fn(),
		fill: vi.fn(),
		fillStyle: "",
		globalAlpha: 1,
		save: vi.fn(),
		restore: vi.fn(),
		translate: vi.fn(),
		scale: vi.fn(),
		clearRect: vi.fn(),
		filter: "",
	};
}

function createMockCanvas() {
	const context = createMockContext();
	return {
		width: 0,
		height: 0,
		context,
		getContext: vi.fn((_type?: string) => context as unknown as CanvasRenderingContext2D),
	};
}

function createRenderer() {
	return new FrameRenderer({
		width: 1920,
		height: 1080,
		wallpaper: "#000000",
		zoomRegions: [],
		showShadow: false,
		shadowIntensity: 0,
		backgroundBlur: 0,
		cropRegion: { x: 0, y: 0, width: 1, height: 1 },
		webcam: {
			...DEFAULT_WEBCAM_OVERLAY,
			enabled: true,
			mirror: false,
			shadow: 0,
		},
		webcamUrl: "file:///tmp/webcam.webm",
		videoWidth: 1920,
		videoHeight: 1080,
	});
}

describe("FrameRenderer webcam export path", () => {
	const createdCanvases: ReturnType<typeof createMockCanvas>[] = [];

	beforeEach(() => {
		createdCanvases.length = 0;

		Object.assign(globalThis, {
			window: globalThis,
			requestAnimationFrame: (callback: FrameRequestCallback) => {
				callback(0);
				return 1;
			},
			cancelAnimationFrame: vi.fn(),
			HTMLMediaElement: {
				HAVE_CURRENT_DATA: 2,
			},
			document: {
				createElement: vi.fn((tag: string) => {
					if (tag === "video") {
						return new FakeVideoElement();
					}
					if (tag !== "canvas") {
						throw new Error(`Unexpected element requested in test: ${tag}`);
					}

					const canvas = createMockCanvas();
					createdCanvases.push(canvas);
					return canvas;
				}),
			},
		});
	});

	it("clamps webcam sync seeks to the media duration", async () => {
		const renderer = createRenderer() as unknown as FrameRendererTestAccess;
		const webcamVideo = new FakeVideoElement({ duration: 4.5, currentTime: 0.25 });
		renderer.webcamVideoElement = webcamVideo;

		await renderer.syncWebcamFrame(12);

		expect(webcamVideo.currentTime).toBe(4.5);
		expect(renderer.lastSyncedWebcamTime).toBe(4.5);
		expect(renderer.webcamSeekPromise).toBeNull();
	});

	it("subtracts stored webcam offsets during export sync", async () => {
		const renderer = createRenderer() as unknown as FrameRendererTestAccess & {
			config: { webcam?: { timeOffsetMs?: number } };
		};
		const webcamVideo = new FakeVideoElement({ duration: 10, currentTime: 0.25 });
		renderer.webcamVideoElement = webcamVideo;
		renderer.config.webcam = {
			...(renderer.config.webcam ?? {}),
			timeOffsetMs: 250,
		};

		await renderer.syncWebcamFrame(2);

		expect(webcamVideo.currentTime).toBe(1.75);
		expect(renderer.lastSyncedWebcamTime).toBe(1.75);
		expect(renderer.webcamSeekPromise).toBeNull();
	});

	it("falls back to animation frame when requestVideoFrameCallback does not fire", async () => {
		const renderer = createRenderer() as unknown as FrameRendererTestAccess;
		const webcamVideo = new FakeVideoElement({
			duration: 4.5,
			currentTime: 0.25,
		}) as FakeVideoElement & {
			requestVideoFrameCallback?: (callback: () => void) => number;
			cancelVideoFrameCallback?: (handle: number) => void;
		};
		webcamVideo.requestVideoFrameCallback = vi.fn(() => 7);
		webcamVideo.cancelVideoFrameCallback = vi.fn();
		renderer.webcamVideoElement = webcamVideo;

		await renderer.syncWebcamFrame(1.5);

		expect(webcamVideo.currentTime).toBe(1.5);
		expect(renderer.lastSyncedWebcamTime).toBe(1.5);
		expect(webcamVideo.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
		expect(webcamVideo.cancelVideoFrameCallback).not.toHaveBeenCalled();
		expect(renderer.webcamSeekPromise).toBeNull();
	});

	it("uses the cached webcam frame when the live video is out of sync", () => {
		const renderer = createRenderer() as unknown as FrameRendererTestAccess;
		const outputContext = createMockContext();
		const webcamVideo = new FakeVideoElement({
			currentTime: 2,
			readyState: 2,
			videoWidth: 640,
			videoHeight: 360,
		});
		const cachedFrameCanvas = createMockCanvas();
		cachedFrameCanvas.width = 640;
		cachedFrameCanvas.height = 360;

		renderer.webcamVideoElement = webcamVideo;
		renderer.webcamFrameCacheCanvas = cachedFrameCanvas;
		renderer.webcamFrameCacheCtx = cachedFrameCanvas.getContext("2d");
		renderer.lastSyncedWebcamTime = 1.5;
		renderer.currentVideoTime = 2;
		renderer.animationState.appliedScale = 1;

		renderer.drawWebcamOverlay(outputContext as unknown as CanvasRenderingContext2D, 1280, 720);

		const bubbleCanvas = createdCanvases[0];
		expect(bubbleCanvas).toBeDefined();
		expect((bubbleCanvas.context as MockContext).drawImage.mock.calls[0][0]).toBe(
			cachedFrameCanvas,
		);
		expect((outputContext as MockContext).drawImage.mock.calls[0][0]).toBe(bubbleCanvas);
	});

	it("keeps drawing the cached webcam frame when the live element temporarily has no current data", () => {
		const renderer = createRenderer() as unknown as FrameRendererTestAccess;
		const outputContext = createMockContext();
		const webcamVideo = new FakeVideoElement({
			currentTime: 2,
			readyState: 0,
			videoWidth: 640,
			videoHeight: 360,
		});
		const cachedFrameCanvas = createMockCanvas();
		cachedFrameCanvas.width = 640;
		cachedFrameCanvas.height = 360;

		renderer.webcamVideoElement = webcamVideo;
		renderer.webcamFrameCacheCanvas = cachedFrameCanvas;
		renderer.webcamFrameCacheCtx = cachedFrameCanvas.getContext("2d");
		renderer.lastSyncedWebcamTime = 2;
		renderer.currentVideoTime = 2;
		renderer.animationState.appliedScale = 1;

		renderer.drawWebcamOverlay(outputContext as unknown as CanvasRenderingContext2D, 1280, 720);

		const bubbleCanvas = createdCanvases[0];
		expect(bubbleCanvas).toBeDefined();
		expect((bubbleCanvas.context as MockContext).drawImage.mock.calls[0][0]).toBe(
			cachedFrameCanvas,
		);
		expect((outputContext as MockContext).drawImage.mock.calls[0][0]).toBe(bubbleCanvas);
	});

	it("uses the live webcam frame and refreshes the cache when the video is synchronized", () => {
		const renderer = createRenderer() as unknown as FrameRendererTestAccess;
		const outputContext = createMockContext();
		const webcamVideo = new FakeVideoElement({
			currentTime: 2,
			readyState: 2,
			videoWidth: 800,
			videoHeight: 600,
		});

		renderer.webcamVideoElement = webcamVideo;
		renderer.lastSyncedWebcamTime = 2;
		renderer.currentVideoTime = 2;
		renderer.animationState.appliedScale = 1;

		renderer.drawWebcamOverlay(outputContext as unknown as CanvasRenderingContext2D, 1280, 720);

		const bubbleCanvas = createdCanvases[0];
		const cacheCanvas = createdCanvases[1];
		expect(cacheCanvas).toBeDefined();
		expect((cacheCanvas.context as MockContext).drawImage.mock.calls[0][0]).toBe(webcamVideo);
		expect((bubbleCanvas.context as MockContext).drawImage.mock.calls[0][0]).toBe(cacheCanvas);
		expect((outputContext as MockContext).drawImage.mock.calls[0][0]).toBe(bubbleCanvas);
	});

	it("reuses the webcam bubble canvas across frames", () => {
		const renderer = createRenderer() as unknown as FrameRendererTestAccess;
		const outputContext = createMockContext();
		const webcamVideo = new FakeVideoElement({
			currentTime: 2,
			readyState: 2,
			videoWidth: 800,
			videoHeight: 600,
		});

		renderer.webcamVideoElement = webcamVideo;
		renderer.lastSyncedWebcamTime = 2;
		renderer.currentVideoTime = 2;
		renderer.animationState.appliedScale = 1;

		renderer.drawWebcamOverlay(outputContext as unknown as CanvasRenderingContext2D, 1280, 720);
		renderer.drawWebcamOverlay(outputContext as unknown as CanvasRenderingContext2D, 1280, 720);

		expect(createdCanvases).toHaveLength(2);
	});

	it("repaints the cursor when seeking back to an exact animation checkpoint", () => {
		const renderer = createRenderer() as unknown as {
			prepareProjectAnimation: (ms: number) => void;
			cursorOverlay: unknown;
			layoutCache: unknown;
			updateAnimationState: (ms: number) => number;
		};
		let painted = -1;
		renderer.layoutCache = { maskRect: { x: 0, y: 0, width: 100, height: 100 } };
		renderer.cursorOverlay = {
			checkpoint: () => ({}),
			restore: () => {},
			reset: () => {},
			update: (_: unknown, ms: number) => {
				painted = ms;
			},
		};
		renderer.updateAnimationState = () => 0;
		renderer.prepareProjectAnimation(1000);
		renderer.prepareProjectAnimation(2000);
		renderer.prepareProjectAnimation(1000);
		expect(painted).toBe(1000);
	});
	it("prefers decoder-backed sync for video wallpapers during export", async () => {
		vi.clearAllMocks();
		const renderer = new FrameRenderer({
			width: 1920,
			height: 1080,
			wallpaper: "/wallpapers/wispysky.mp4",
			zoomRegions: [],
			showShadow: false,
			shadowIntensity: 0,
			backgroundBlur: 0,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			webcam: {
				...DEFAULT_WEBCAM_OVERLAY,
				enabled: false,
			},
			videoWidth: 1920,
			videoHeight: 1080,
		}) as unknown as {
			setupBackground: () => Promise<void>;
			backgroundForwardFrameSource: unknown;
			backgroundVideoElement: FakeVideoElement | null;
			backgroundSprite: MockCanvas | null;
		};

		await renderer.setupBackground();

		expect(initializeForwardFrameSourceMock).toHaveBeenCalledWith("wallpapers/wispysky.mp4");
		expect(resolveMediaElementSourceMock).not.toHaveBeenCalled();
		expect(renderer.backgroundForwardFrameSource).toBeTruthy();
		expect(renderer.backgroundVideoElement).toBeNull();
		expect(renderer.backgroundSprite).toBeTruthy();
	});

	it("renders dynamic wallpapers from the same timeline phase in fallback export", async () => {
		const renderer = new FrameRenderer({
			width: 640,
			height: 360,
			wallpaper:
				"captr-dynamic-bg:v1:%7B%22pattern%22%3A%22dot-noise%22%2C%22durationSeconds%22%3A4%7D",
			zoomRegions: [],
			showShadow: false,
			shadowIntensity: 0,
			backgroundBlur: 0,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			webcam: { ...DEFAULT_WEBCAM_OVERLAY, enabled: false },
			videoWidth: 640,
			videoHeight: 360,
		}) as unknown as {
			setupBackground: () => Promise<void>;
			syncBackgroundFrame: (timeSeconds: number) => Promise<void>;
			backgroundDynamicSettings: { pattern: string };
			backgroundCtx: ReturnType<typeof createMockContext>;
		};

		await renderer.setupBackground();
		const firstX = renderer.backgroundCtx.arc.mock.calls[0][0];
		await renderer.syncBackgroundFrame(0.5);

		expect(renderer.backgroundDynamicSettings.pattern).toBe("dot-noise");
		expect(renderer.backgroundCtx.arc.mock.calls[1][0]).not.toBe(firstX);
	});

	it("falls back to media-element sync when video wallpaper packet streaming fails", async () => {
		vi.clearAllMocks();
		initializeForwardFrameSourceMock.mockResolvedValue(undefined);
		getForwardFrameAtTimeMock.mockRejectedValueOnce(
			new Error("readAVPacket pipeline failed: Failed after 3 attempts"),
		);
		resolveMediaElementSourceMock.mockResolvedValueOnce({
			src: "blob:background-video",
			revoke: vi.fn(),
		});
		const renderer = new FrameRenderer({
			width: 1920,
			height: 1080,
			wallpaper: "/wallpapers/wispysky.mp4",
			zoomRegions: [],
			showShadow: false,
			shadowIntensity: 0,
			backgroundBlur: 0,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			webcam: {
				...DEFAULT_WEBCAM_OVERLAY,
				enabled: false,
			},
			videoWidth: 1920,
			videoHeight: 1080,
		}) as unknown as {
			setupBackground: () => Promise<void>;
			syncBackgroundFrame: (timeSeconds: number) => Promise<void>;
			backgroundForwardFrameSource: unknown;
			backgroundVideoElement: FakeVideoElement | null;
		};

		await renderer.setupBackground();
		await expect(renderer.syncBackgroundFrame(1)).resolves.toBeUndefined();

		expect(cancelForwardFrameSourceMock).toHaveBeenCalled();
		expect(destroyForwardFrameSourceMock).toHaveBeenCalled();
		expect(resolveMediaElementSourceMock).toHaveBeenCalledWith("wallpapers/wispysky.mp4");
		expect(renderer.backgroundForwardFrameSource).toBeNull();
		expect(renderer.backgroundVideoElement).toBeTruthy();
	});
});

// Canvas traces exercise the real compositor while keeping GPU/video decoding out of unit tests.
function appearanceContext(canvas: any) {
	const operations: any[] = [],
		stack: any[] = [];
	const ctx: any = {
		canvas,
		operations,
		path: [],
		clips: [],
		globalAlpha: 1,
		filter: "none",
		fillStyle: "#000",
		strokeStyle: "#000",
		lineWidth: 1,
		shadowColor: "transparent",
		shadowBlur: 0,
		shadowOffsetX: 0,
		shadowOffsetY: 0,
		save() {
			stack.push({
				globalAlpha: this.globalAlpha,
				clips: this.clips,
				filter: this.filter,
				fillStyle: this.fillStyle,
				strokeStyle: this.strokeStyle,
				lineWidth: this.lineWidth,
				shadowColor: this.shadowColor,
				shadowBlur: this.shadowBlur,
				shadowOffsetX: this.shadowOffsetX,
				shadowOffsetY: this.shadowOffsetY,
			});
		},
		restore() {
			Object.assign(this, stack.pop());
		},
	};
	for (const name of [
		"beginPath",
		"closePath",
		"moveTo",
		"lineTo",
		"roundRect",
		"ellipse",
		"rect",
		"clip",
		"fill",
		"stroke",
		"drawImage",
		"clearRect",
		"translate",
		"scale",
	])
		ctx[name] = (...args: any[]) => {
			if (name === "beginPath") ctx.path = [];
			if (["moveTo", "lineTo", "roundRect", "rect", "ellipse"].includes(name))
				ctx.path.push([name, ...args]);
			if (name === "clip") ctx.clips = [...ctx.clips, [...ctx.path]];
			operations.push({
				clips: ctx.clips,
				name,
				args,
				alpha: ctx.globalAlpha,
				filter: ctx.filter,
				fill: ctx.fillStyle,
				stroke: ctx.strokeStyle,
				lineWidth: ctx.lineWidth,
				shadowColor: ctx.shadowColor,
				shadowBlur: ctx.shadowBlur,
				shadowOffsetX: ctx.shadowOffsetX,
				shadowOffsetY: ctx.shadowOffsetY,
			});
		};
	return ctx;
}
function bareAppearance(overrides: any = {}) {
	return {
		framePadding: 0,
		borderWidth: 0,
		borderColor: "#000000",
		borderOpacity: 0,
		cornerRadius: 0,
		surfaceColor: "#000000",
		surfaceOpacity: 0,
		backdropBlur: 0,
		shadow: { color: "#000000", opacity: 0, blur: 0, offsetX: 0, offsetY: 0 },
		...overrides,
	};
}
function appearanceHarness(frameAppearances?: any) {
	const canvases: any[] = [];
	vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
	vi.stubGlobal("document", {
		createElement: () => {
			const canvas: any = { width: 0, height: 0 };
			canvas.context = appearanceContext(canvas);
			canvas.getContext = () => canvas.context;
			canvases.push(canvas);
			return canvas;
		},
	});
	const renderer: any = createRenderer();
	renderer.config.width = 400;
	renderer.config.height = 300;
	renderer.config.frameAppearances = frameAppearances;
	renderer.config.webcam = {
		...renderer.config.webcam,
		size: 50,
		margin: 0,
		cornerRadius: 40,
		cornerRadiusPercent: 0.5,
		shadow: 0.6,
	};
	const output: any = document.createElement("canvas");
	output.width = 400;
	output.height = 300;
	const video: any = document.createElement("canvas");
	video.width = 400;
	video.height = 300;
	const background: any = document.createElement("canvas");
	renderer.compositeCanvas = output;
	renderer.compositeCtx = output.context;
	renderer.backgroundSprite = background;
	renderer.app = { canvas: video };
	renderer.layoutCache = { maskRect: { x: 40, y: 30, width: 320, height: 240 } };
	renderer.animationState = { appliedScale: 1, x: 0, y: 0 };
	renderer.webcamVideoElement = new FakeVideoElement({ videoWidth: 640, videoHeight: 480 });
	renderer.currentVideoTime = 0;
	renderer.lastSyncedWebcamTime = null;
	return { renderer, output, video, background, canvases };
}
describe("Record frame appearances", () => {
	it("independently insets and paints both Window and Webcam frames", () => {
		const window = bareAppearance({
			framePadding: 12,
			cornerRadius: 18,
			borderWidth: 4,
			borderColor: "#ff0000",
			borderOpacity: 0.25,
			surfaceColor: "#00ff00",
			surfaceOpacity: 0.5,
			shadow: { color: "#112233", opacity: 0.4, blur: 7, offsetX: 3, offsetY: 5 },
		});
		const webcam = bareAppearance({
			framePadding: 8,
			cornerRadius: 11,
			borderWidth: 2,
			borderColor: "#0000ff",
			borderOpacity: 0.75,
			surfaceColor: "#ffffff",
			surfaceOpacity: 0.3,
		});
		const { renderer, output, video } = appearanceHarness({ window, webcam });
		renderer.compositeWithShadows();
		const ops = output.context.operations;
		expect(
			ops.find((o: any) => o.name === "drawImage" && o.args[0] === video)?.args.slice(1),
		).toEqual([40, 30, 320, 240, 52, 42, 296, 216]);
		expect(
			ops.some((o: any) => o.name === "fill" && o.fill === "#00ff00" && o.alpha === 0.5),
		).toBe(true);
		expect(
			ops.some((o: any) => o.name === "fill" && o.fill === "#ffffff" && o.alpha === 0.3),
		).toBe(true);
		expect(
			ops
				.filter((o: any) => o.name === "stroke")
				.map((o: any) => [o.stroke, o.alpha, o.lineWidth]),
		).toEqual([
			["#ff0000", 0.25, 4],
			["#0000ff", 0.75, 2],
		]);
		expect(
			ops.some(
				(o: any) =>
					o.name === "fill" &&
					o.shadowColor === "#112233" &&
					o.shadowBlur === 7 &&
					o.shadowOffsetX === 3 &&
					o.shadowOffsetY === 5 &&
					o.alpha === 0.4,
			),
		).toBe(true);
		expect(
			ops.some(
				(o: any) =>
					o.name === "roundRect" &&
					JSON.stringify(o.args) === JSON.stringify([52, 42, 296, 216, 6]),
			),
		).toBe(true);
		const webcamDraw = ops.find(
			(o: any) => o.name === "drawImage" && o.args[0] instanceof FakeVideoElement,
		);
		expect(webcamDraw?.args.slice(-4)).toEqual([258, 158, 134, 134]);
	});

	it("clips zoomed Window decorations and media to the rounded non-fullscreen layout viewport", () => {
		const { renderer, output, video, background } = appearanceHarness({
			window: bareAppearance({
				surfaceColor: "#ffffff",
				surfaceOpacity: 0.5,
				borderWidth: 4,
				borderOpacity: 1,
				backdropBlur: 8,
				shadow: { color: "#000000", opacity: 0.4, blur: 12, offsetX: 4, offsetY: 8 },
			}),
			webcam: bareAppearance(),
		});
		renderer.config.webcam.sourcePath = "webcam.mp4";
		renderer.config.layoutRegions = [
			{ id: "center", startMs: 0, endMs: 1000, preset: "screen-center", transitionMs: 0 },
		];
		renderer.animationState = { appliedScale: 2, x: -200, y: -150 };
		renderer.compositeWithShadows();
		const ops = output.context.operations;
		const paintedWindow = ops.filter(
			(op: any) =>
				["fill", "stroke"].includes(op.name) ||
				(op.name === "drawImage" && op.args[0] !== background),
		);
		expect(paintedWindow.some((op: any) => op.name === "stroke")).toBe(true);
		expect(paintedWindow.some((op: any) => op.filter === "blur(8px)")).toBe(true);
		expect(
			paintedWindow.some((op: any) => op.name === "drawImage" && op.args[0] === video),
		).toBe(true);
		// A 400x300 screen-center layout is [36,33,328,234], with 24px rounded corners.
		// The zoomed frame extends beyond it; every shadow/surface/blur/border/media paint must keep this clip.
		expect(
			paintedWindow.every((op: any) =>
				op.clips.some(
					(path: any[]) =>
						path.length > 4 &&
						path[0][0] === "moveTo" &&
						Math.abs(path[0][1] - 60) < 1e-8 &&
						Math.abs(path[0][2] - 33) < 1e-8 &&
						Math.abs(Math.min(...path.map((point) => point[1])) - 36) < 1e-8 &&
						Math.abs(Math.max(...path.map((point) => point[1])) - 364) < 1e-8 &&
						Math.abs(Math.min(...path.map((point) => point[2])) - 33) < 1e-8 &&
						Math.abs(Math.max(...path.map((point) => point[2])) - 267) < 1e-8,
				),
			),
		).toBe(true);
		expect(
			ops.find((op: any) => op.name === "drawImage" && op.args[0] === video)?.args[5],
		).toBeLessThan(36);
	});

	it("blurs only a bounded sample behind the layer and reuses its canvas", () => {
		const { renderer, output, video, canvases } = appearanceHarness({
			window: bareAppearance({ backdropBlur: 9, surfaceOpacity: 0.2 }),
			webcam: bareAppearance(),
		});
		renderer.config.webcam.enabled = false;
		renderer.compositeWithShadows();
		const scratch = canvases.find(
			(c: any) =>
				c !== output &&
				c.context.operations.some(
					(o: any) => o.name === "drawImage" && o.args[0] === output,
				),
		);
		expect(scratch).toBeDefined();
		expect([scratch.width, scratch.height]).toEqual([320, 240]);
		expect(
			scratch.context.operations.find((o: any) => o.name === "drawImage")?.args.slice(1),
		).toEqual([40, 30, 320, 240, 0, 0, 320, 240]);
		expect(
			output.context.operations.find(
				(o: any) => o.name === "drawImage" && o.args[0] === scratch,
			)?.filter,
		).toBe("blur(9px)");
		expect(
			output.context.operations.find(
				(o: any) => o.name === "drawImage" && o.args[0] === video,
			)?.filter,
		).toBe("none");
		const count = canvases.length;
		renderer.compositeWithShadows();
		expect(canvases).toHaveLength(count);
	});
	it("zero added styles retain media geometry without painting decoration", () => {
		const { renderer, output, video } = appearanceHarness({
			window: bareAppearance(),
			webcam: bareAppearance(),
		});
		renderer.config.webcam.enabled = false;
		renderer.compositeWithShadows();
		expect(
			output.context.operations.filter((o: any) => ["stroke", "fill"].includes(o.name)),
		).toEqual([]);
		expect(
			output.context.operations
				.find((o: any) => o.name === "drawImage" && o.args[0] === video)
				?.args.slice(1),
		).toEqual([40, 30, 320, 240, 40, 30, 320, 240]);
	});
	it("legacy webcam radius and shadow remain relative to its dimensions", () => {
		const { renderer, output, canvases } = appearanceHarness({
			window: bareAppearance({ cornerRadius: 31 }),
			webcam: bareAppearance({
				cornerRadius: 40,
				shadow: { color: "#000000", opacity: 0.6, blur: 0, offsetX: 0, offsetY: 0 },
			}),
		});
		renderer.config.legacyFrameAppearances = true;
		renderer.compositeWithShadows();
		expect(
			canvases
				.flatMap((c: any) => c.context.operations)
				.some(
					(o: any) => o.name === "roundRect" && o.args[2] === 150 && o.args[4] === 37.5,
				),
		).toBe(true);
		expect(
			output.context.operations.some(
				(o: any) =>
					o.name === "drawImage" &&
					o.filter === "drop-shadow(0 9px 33px rgba(0,0,0,0.6))",
			),
		).toBe(true);
	});

	it("keeps legacy window radius in the source mask while explicit styles clip in the compositor", () => {
		const { renderer } = appearanceHarness({
			window: bareAppearance({ cornerRadius: 90 }),
			webcam: bareAppearance(),
		});
		renderer.config.borderRadius = 31;
		renderer.config.legacyFrameAppearances = true;
		renderer.videoSprite = { scale: { set() {} }, position: { set() {} } };
		renderer.videoContainer = { position: { set() {} } };
		renderer.maskGraphics = {
			clear() {},
			fill() {},
			moveTo: vi.fn(),
			lineTo() {},
			closePath() {},
		};
		renderer.updateLayout();
		expect(renderer.maskGraphics.moveTo.mock.calls.at(-1)?.[0]).toBeCloseTo((31 * 400) / 1920);
		renderer.config.legacyFrameAppearances = false;
		renderer.updateLayout();
		expect(renderer.maskGraphics.moveTo.mock.calls.at(-1)?.[0]).toBe(0);
	});

	it("bounds malformed and extreme frame inputs to finite geometry", () => {
		const { renderer, output, canvases } = appearanceHarness({
			window: bareAppearance({
				framePadding: Infinity,
				cornerRadius: 1e12,
				borderWidth: 1e12,
				backdropBlur: 1e12,
				surfaceOpacity: 9,
				shadow: { color: "#112233", opacity: 9, blur: 1e12, offsetX: -1e12, offsetY: NaN },
			}),
			webcam: bareAppearance(),
		});
		renderer.config.webcam.enabled = false;
		renderer.compositeWithShadows();
		const ops = output.context.operations;
		expect(
			ops
				.filter((o: any) => o.name === "roundRect")
				.every((o: any) => o.args.every((n: any) => Number.isFinite(n) && n >= 0)),
		).toBe(true);
		expect(ops.some((o: any) => o.name === "drawImage" && o.filter === "blur(120px)")).toBe(
			true,
		);
		expect(
			ops
				.filter((o: any) => ["fill", "stroke"].includes(o.name))
				.every(
					(o: any) =>
						o.alpha >= 0 &&
						o.alpha <= 1 &&
						o.shadowBlur <= 120 &&
						Math.abs(o.shadowOffsetX) <= 320 &&
						Math.abs(o.shadowOffsetY) <= 240,
				),
		).toBe(true);
		expect(canvases.every((c: any) => c.width <= 400 && c.height <= 300)).toBe(true);
	});
});
