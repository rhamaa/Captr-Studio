import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ActiveSurface } from "@/core/timeline/aiTypes";
import type { AgentDiffSummary } from "@/core/timeline/agentPayload";
import { AiCommandBar } from "./AiCommandBar";
import { AiSpeculativeDrawer } from "./AiSpeculativeDrawer";

describe("AiCommandBar", () => {
	it("renders contextual action pills matching active surface (record-editor)", () => {
		const surface: ActiveSurface = {
			kind: "record-editor",
			recordingAssetId: "asset-1",
			packageId: "pkg-1",
			activeTab: "appearance",
			outwardBorderWidth: 2,
		};
		const onAction = vi.fn();
		const html = renderToStaticMarkup(
			createElement(AiCommandBar, {
				open: true,
				onClose: vi.fn(),
				activeSurface: surface,
				onExecuteAction: onAction,
			}),
		);

		expect(html).toContain("Auto-Zoom to Clicks");
		expect(html).toContain("Style: Brutalism");
		expect(html).toContain("Style: Glassmorphism");
		expect(html).toContain("Outward Border +4px");
		expect(html).toContain("Record Editor • Framing &amp; Appearance");
	});

	it("renders contextual action pills matching active surface (story-editor)", () => {
		const surface: ActiveSurface = {
			kind: "story-editor",
			selectedClipIds: ["c1", "c2"],
			playheadUs: 3_000_000,
		};
		const html = renderToStaticMarkup(
			createElement(AiCommandBar, {
				open: true,
				onClose: vi.fn(),
				activeSurface: surface,
			}),
		);

		expect(html).toContain("Remove Silence");
		expect(html).toContain("Split Clip");
		expect(html).toContain("Add B-Roll Card");
		expect(html).toContain("Story Timeline • 2 clips selected");
	});

	it("renders contextual action pills matching active surface (caption-editor)", () => {
		const surface: ActiveSurface = {
			kind: "caption-editor",
			selectedSegmentIndex: 1,
		};
		const html = renderToStaticMarkup(
			createElement(AiCommandBar, {
				open: true,
				onClose: vi.fn(),
				activeSurface: surface,
			}),
		);

		expect(html).toContain("Fix Typos with AI");
		expect(html).toContain("Split into Short Lines");
		expect(html).toContain("Sync Word Timestamps");
		expect(html).toContain("Caption Editor • Segment #2");
	});

	it("renders contextual action pills matching active surface (artboard-canvas)", () => {
		const surface: ActiveSurface = {
			kind: "artboard-canvas",
			artboardId: "board-1",
			aspectRatio: "9:16",
		};
		const html = renderToStaticMarkup(
			createElement(AiCommandBar, {
				open: true,
				onClose: vi.fn(),
				activeSurface: surface,
			}),
		);

		expect(html).toContain("Repurpose 9:16 Shorts");
		expect(html).toContain("Auto-Center Webcam &amp; Screen");
		expect(html).toContain("Artboard Canvas • 9:16");
	});

	it("does not render when open is false", () => {
		const html = renderToStaticMarkup(
			createElement(AiCommandBar, {
				open: false,
				onClose: vi.fn(),
				activeSurface: { kind: "none" },
			}),
		);

		expect(html).toBe("");
	});

	it("renders generative prompt suggestions when input is empty", () => {
		const html = renderToStaticMarkup(
			createElement(AiCommandBar, {
				open: true,
				onClose: vi.fn(),
				activeSurface: { kind: "none" },
			}),
		);

		expect(html).toContain("Suggestions:");
		expect(html).toContain("Cyberpunk Neon");
		expect(html).toContain("Minimalist Dark");
		expect(html).toContain("macOS Glass");
	});

	it("triggers action execution directly when called", () => {
		const onAction = vi.fn();
		const surface: ActiveSurface = {
			kind: "record-editor",
			recordingAssetId: "a1",
			packageId: "p1",
			activeTab: "appearance",
			outwardBorderWidth: 2,
		};
		const element = createElement(AiCommandBar, {
			open: true,
			onClose: vi.fn(),
			activeSurface: surface,
			onExecuteAction: onAction,
		});

		expect(element.props.open).toBe(true);
		element.props.onExecuteAction("auto_zoom_to_clicks");
		expect(onAction).toHaveBeenCalledWith("auto_zoom_to_clicks");
	});
});

describe("AiSpeculativeDrawer", () => {
	it("renders speculative ghost preview drawer with diff summary metrics", () => {
		const diff: AgentDiffSummary = {
			clipsBefore: 5,
			clipsAfter: 7,
			clipsAdded: ["clip-new-1", "clip-new-2"],
			clipsRemoved: ["clip-old-1"],
			clipsModified: ["clip-mod-1"],
			durationBeforeUs: 20_000_000,
			durationAfterUs: 18_500_000,
			durationDeltaUs: -1_500_000,
		};

		const onApply = vi.fn();
		const onDiscard = vi.fn();

		const html = renderToStaticMarkup(
			createElement(AiSpeculativeDrawer, {
				diff,
				onApplyDraft: onApply,
				onDiscardDraft: onDiscard,
			}),
		);

		expect(html).toContain("AI Speculative Preview");
		expect(html).toContain("-1.5s duration");
		expect(html).toContain("+2 clips");
		expect(html).toContain("-1 clip");
		expect(html).toContain("1 modified");
		expect(html).toContain("Accept Changes (Enter)");
		expect(html).toContain("Discard (Esc)");
	});

	it("handles positive duration delta correctly", () => {
		const diff: AgentDiffSummary = {
			clipsBefore: 2,
			clipsAfter: 3,
			clipsAdded: ["clip-new-1"],
			clipsRemoved: [],
			clipsModified: [],
			durationBeforeUs: 10_000_000,
			durationAfterUs: 12_400_000,
			durationDeltaUs: 2_400_000,
		};

		const html = renderToStaticMarkup(
			createElement(AiSpeculativeDrawer, {
				diff,
				onApplyDraft: vi.fn(),
				onDiscardDraft: vi.fn(),
			}),
		);

		expect(html).toContain("+2.4s duration");
		expect(html).toContain("+1 clip");
	});
});
