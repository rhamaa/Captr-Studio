import { describe, expect, it } from "vitest";
import { createTimelineProject, placeAsset, registerMedia } from "../timeline/commands";
import type { RepurposeArtboard } from "../timeline/repurposeTypes";
import { ownershipFixture } from "../timeline/storyOwnership.fixtures";
import {
	artboardToStory,
	calculateStoryDurationUs,
	createDefaultHyperframeTemplate,
	createDefaultStory,
	extractStoriesFromProject,
	generateStoryManifest,
	storyToArtboard,
	validateHyperframeComposition,
	validateStoryComposition,
} from "./storyUtils";

describe("storyUtils", () => {
	it("keeps prefix and case distinct Story identities portable in generated manifests", () => {
		const project = createTimelineProject("filenames", "Filenames");
		const stories = ["foo", "story-foo", "Foo", "CON", "con"].map((id) =>
			createDefaultStory(project, id),
		);
		const manifest = generateStoryManifest(stories);
		expect(manifest.map((entry) => entry.id)).toEqual([
			"foo",
			"story-foo",
			"Foo",
			"CON",
			"con",
		]);
		expect(manifest.map((entry) => entry.file)).toEqual([
			"Story/story-666f6f.json",
			"Story/story-73746f72792d666f6f.json",
			"Story/story-466f6f.json",
			"Story/story-434f4e.json",
			"Story/story-636f6e.json",
		]);
		expect(new Set(manifest.map((entry) => entry.file.toLowerCase())).size).toBe(5);
	});
	it("rejects invalid Story identities before producing a file path", () => {
		const project = createTimelineProject("invalid-filenames", "Invalid filenames");
		for (const id of ["", "../escape", "non-ASCII-é"])
			expect(() => generateStoryManifest([createDefaultStory(project, id)])).toThrow(
				/Story ID/,
			);
	});
	it("projects current canonical owners including empty Artboards", () => {
		const project = ownershipFixture();
		project.stories = extractStoriesFromProject(project);
		project.stories[0].durationUs = 99_000_000;
		project.tracks = [];
		project.repurposeBoard!.artboards[1].tracks = [];
		const stories = extractStoriesFromProject(project);
		expect(stories).toHaveLength(3);
		expect(stories[0].tracks).toEqual([]);
		expect(stories[0].durationUs).toBe(0);
		expect(stories.find((s) => s.artboardId === "B")!.tracks).toEqual([]);
	});
	it("round-trips private media, explicit empty metadata, caption and canvas settings", () => {
		const story = artboardToStory(ownershipFixture().repurposeBoard!.artboards[0]);
		story.id = "stable-story-identity";
		story.canvas = { ...story.canvas, fps: 24, background: "#123456" };
		story.subtitles = { enabled: false };
		story.clipTransitions = [];
		story.durationUs = 5_000_000;
		expect(artboardToStory(storyToArtboard(story))).toEqual(story);
		const empty = { ...story, localAssets: [], tracks: [], durationUs: 0 };
		expect(artboardToStory(storyToArtboard(empty))).toEqual(empty);
	});
	it("creates default story from project root tracks and canvas", () => {
		const project = createTimelineProject("test-p", "My Video Project");
		const story = createDefaultStory(project);

		expect(story.id).toBe("story-main");
		expect(story.name).toBe("Main Video");
		expect(story.aspectRatio).toBe("16:9");
		expect(story.canvas.width).toBe(1920);
		expect(story.canvas.height).toBe(1080);
		expect(story.tracks).toHaveLength(2);
	});

	it("converts RepurposeArtboard to StoryComposition and vice versa", () => {
		const artboard: RepurposeArtboard = {
			id: "artboard-shorts",
			name: "Viral Shorts",
			aspectRatio: "9:16",
			width: 1080,
			height: 1920,
			framing: { scale: 1.5, offsetX: 0.1, offsetY: -0.2, fitMode: "cover" },
			tracks: [],
		};

		const story = artboardToStory(artboard, 60);
		expect(story.id).toBe("story-artboard-shorts");
		expect(story.name).toBe("Viral Shorts");
		expect(story.aspectRatio).toBe("9:16");
		expect(story.canvas.width).toBe(1080);
		expect(story.canvas.height).toBe(1920);
		expect(story.canvas.fps).toBe(60);

		const roundtrip = storyToArtboard(story);
		expect(roundtrip.id).toBe("artboard-shorts");
		expect(roundtrip.name).toBe("Viral Shorts");
		expect(roundtrip.aspectRatio).toBe("9:16");
	});

	it("extracts stories from project including artboards", () => {
		let project = createTimelineProject("test-extract", "Extraction Test");
		project = registerMedia(project, {
			id: "media-1",
			kind: "video",
			name: "Video 1",
			durationUs: 10_000_000,
			width: 1920,
			height: 1080,
			source: { path: "source.mp4", durationUs: 10_000_000, offsetUs: 0 },
		});
		project = placeAsset(project, "media-1", "visual-1", 0, { clipId: "c1" });

		project.repurposeBoard = {
			slices: [],
			activeSliceId: null,
			artboards: [
				{
					id: "reels",
					name: "Instagram Reel",
					aspectRatio: "9:16",
					width: 1080,
					height: 1920,
					framing: { scale: 1, offsetX: 0, offsetY: 0, fitMode: "cover" },
					tracks: project.tracks,
				},
			],
		};

		const stories = extractStoriesFromProject(project);
		expect(stories).toHaveLength(2);
		expect(stories[0].id).toBe("story-main");
		expect(stories[1].id).toBe("story-reels");

		const manifest = generateStoryManifest(stories);
		expect(manifest).toHaveLength(2);
		expect(manifest[0].file).toBe("Story/story-73746f72792d6d61696e.json");
		expect(manifest[1].file).toBe("Story/story-73746f72792d7265656c73.json");
	});

	it("generates a valid HTML5/GSAP Hyperframe template with seekFrame driver", () => {
		const { html, spec } = createDefaultHyperframeTemplate("hf-kinetic", "Kinetic Hook", {
			title: "CLAUDE CODE MODS",
			subtitle: "Zero Config Terminal",
			durationSec: 4,
		});

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("gsap.timeline");
		expect(html).toContain("window.seekFrame = function(timeInSeconds)");
		expect(html).toContain("CLAUDE CODE MODS");
		expect(spec).toMatchObject({
			id: "hf-kinetic",
			name: "Kinetic Hook",
			durationSec: 4,
		});
	});

	it("validates story and hyperframe compositions", () => {
		const validStory = {
			id: "story-1",
			name: "Story 1",
			aspectRatio: "16:9" as const,
			canvas: { width: 1920, height: 1080, fps: 60 },
			tracks: [],
		};
		expect(() => validateStoryComposition(validStory)).not.toThrow();

		expect(() => validateStoryComposition({ id: "", name: "Story" })).toThrow(/valid id/);
		expect(() => validateStoryComposition({ id: "s", name: "", canvas: {} })).toThrow(
			/valid name/,
		);

		const validHf = {
			id: "hf-1",
			name: "Hyperframe 1",
			entryHtml: "hyperframe/hf-1.html",
			durationUs: 5_000_000,
			width: 1920,
			height: 1080,
		};
		expect(() => validateHyperframeComposition(validHf)).not.toThrow();
		expect(() => validateHyperframeComposition({ id: "hf-1" })).toThrow(/valid name/);
	});
});
