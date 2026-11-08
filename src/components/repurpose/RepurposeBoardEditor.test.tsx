import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { createTimelineProject } from "@/core/timeline/commands";
import { addRepurposeArtboard, ensureRepurposeBoard } from "@/core/timeline/repurposeCommands";
import { RepurposeBoardEditor } from "./RepurposeBoardEditor";

const featureFlags = vi.hoisted(() => ({ ai: true, hyperframe: true }));
vi.mock("@/core/featureFlags", () => ({
	get FEATURE_AI_ENABLED() {
		return featureFlags.ai;
	},
	get FEATURE_HYPERFRAME_ENABLED() {
		return featureFlags.hyperframe;
	},
}));

describe("RepurposeBoardEditor", () => {
	it("renders empty state by default with preset selection buttons and + Hyperframe option", () => {
		const base = createTimelineProject("p1", "Test Project");
		const project = ensureRepurposeBoard(base);

		const html = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(RepurposeBoardEditor, {
					project,
					projectTitle: "Test Project",
					onChange: vi.fn(),
					onClose: vi.fn(),
				}),
			),
		);

		// Breadcrumb & header
		expect(html).toContain("Multi-Artboard Hub");
		expect(html).toContain("0 Video Cards");
		// Empty state
		expect(html).toContain("Artboard Belum Memiliki Video");
		expect(html).toContain("9:16");
		expect(html).toContain("1:1");
		expect(html).toContain("16:9");
		// Docked asset library
		expect(html).toContain("Project Assets");
		// Header buttons
		expect(html).toContain("Add Video");
		expect(html).toContain("Hyperframe");
	});

	it("renders artboard cards with rename button and individual playback controls", () => {
		const base = createTimelineProject("p1", "Test Project");
		let project = ensureRepurposeBoard(base);
		project = addRepurposeArtboard(project, {
			aspectRatio: "9:16",
			name: "Shorts Hook",
			width: 1080,
			height: 1920,
			defaultFitMode: "cover",
		});
		project = addRepurposeArtboard(project, {
			aspectRatio: "1:1",
			name: "Feed Square",
			width: 1080,
			height: 1080,
			defaultFitMode: "cover",
		});

		const html = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(RepurposeBoardEditor, {
					project,
					projectTitle: "Test Project",
					onChange: vi.fn(),
					onClose: vi.fn(),
				}),
			),
		);

		expect(html).toContain("2 Video Cards");
		expect(html).toContain("Shorts Hook");
		expect(html).toContain("Feed Square");
		// Individual scrubber & play button
		expect(html).toContain("repurpose-card-scrubber");
		expect(html).toContain("repurpose-card-play-btn");
		expect(html).toContain("repurpose-card-name-edit-btn");
		// Header actions
		expect(html).toContain("Add Video");
		expect(html).toContain("Hyperframe");
	});

	it("renders unified canvas with both Story cards and Hyperframe cards simultaneously", () => {
		const base = createTimelineProject("p1", "Test Project");
		let project = ensureRepurposeBoard(base);
		project = addRepurposeArtboard(project, {
			aspectRatio: "16:9",
			name: "Main Feature",
			width: 1920,
			height: 1080,
			defaultFitMode: "cover",
		});
		project.hyperframes = [
			{
				id: "hf-promo",
				name: "Kinetic Promo Card",
				entryHtml: "hyperframe/hf-promo.html",
				htmlContent: "<div>Promo Card</div>",
				durationUs: 3_000_000,
				width: 1920,
				height: 1080,
				aspectRatio: "16:9",
			},
		];

		const html = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(RepurposeBoardEditor, {
					project,
					projectTitle: "Test Project",
					onChange: vi.fn(),
					onClose: vi.fn(),
				}),
			),
		);

		// Shows combined total
		expect(html).toContain("2 Video Cards");
		// Shows story card
		expect(html).toContain("Main Feature");
		// Shows hyperframe card on the same canvas stage!
		expect(html).toContain("Kinetic Promo Card");
		expect(html).toContain("HYPERFRAME");
		expect(html).toContain("repurpose-hyperframe-card");
	});

	it("passes onOpenHyperframeEditor handler and renders without crashing", () => {
		const base = createTimelineProject("p1", "Test Project");
		const project = ensureRepurposeBoard(base);
		project.hyperframes = [
			{
				id: "hf-test-1",
				name: "Intro Frame",
				entryHtml: "hyperframe/hf-test-1.html",
				htmlContent: "<div>Intro</div>",
				durationUs: 2_000_000,
				width: 1920,
				height: 1080,
				aspectRatio: "16:9",
			},
		];

		const onOpenHyperframeEditor = vi.fn();
		const html = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(RepurposeBoardEditor, {
					project,
					projectTitle: "Test Project",
					onChange: vi.fn(),
					onOpenHyperframeEditor,
				}),
			),
		);

		expect(html).toContain("Intro Frame");
		expect(html).toContain("Open Code");
	});

	it("hides Hyperframe entry points and cards while the feature is disabled", () => {
		featureFlags.hyperframe = false;
		try {
			const render = (project: ReturnType<typeof ensureRepurposeBoard>) =>
				renderToStaticMarkup(
					createElement(
						I18nProvider,
						null,
						createElement(RepurposeBoardEditor, {
							project,
							projectTitle: "Test Project",
							onChange: vi.fn(),
							onClose: vi.fn(),
						}),
					),
				);
			const empty = render(ensureRepurposeBoard(createTimelineProject("p1", "Test Project")));
			expect(empty).toContain("Artboard Belum Memiliki Video");
			expect(empty).not.toContain("Hyperframe");

			const withHyperframe = {
				...ensureRepurposeBoard(createTimelineProject("p2", "Test Project")),
				hyperframes: [
					{
						id: "hf-1",
						name: "Hidden Hyperframe",
						entryHtml: "hyperframe/hyperframe-hf-1.html",
						specJson: "hyperframe/hyperframe-hf-1.json",
						htmlContent: "<html></html>",
						durationUs: 5_000_000,
						width: 1920,
						height: 1080,
						fps: 60,
						aspectRatio: "16:9",
						createdAt: "2026-11-08T00:00:00.000Z",
					},
				],
			} as ReturnType<typeof ensureRepurposeBoard>;
			const html = render(withHyperframe);
			expect(html).not.toContain("Hidden Hyperframe");
			expect(html).toContain("0 Video Cards");
		} finally {
			featureFlags.hyperframe = true;
		}
	});
});

