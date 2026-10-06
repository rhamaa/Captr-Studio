import type { RepurposeArtboard } from "../timeline/repurposeTypes";
import { clipDurationUs, type TimelineProject, type TimelineTrack } from "../timeline/types";
import type {
	HyperframeComposition,
	StoryComposition,
	StoryManifestItem,
} from "./storyTypes";

/**
 * Calculates total duration of a story based on its clips.
 */
export function calculateStoryDurationUs(tracks: TimelineTrack[]): number {
	return Math.max(
		0,
		...tracks.flatMap((t) =>
			t.clips.filter((c) => c.enabled).map((c) => c.startUs + clipDurationUs(c)),
		),
	);
}

/**
 * Creates a default StoryComposition from the root project tracks and canvas.
 */
export function createDefaultStory(
	project: TimelineProject,
	id = "story-main",
	name = "Main Video",
): StoryComposition {
	const durationUs = Math.max(
		0,
		...project.tracks.flatMap((t) =>
			t.clips.filter((c) => c.enabled).map((c) => c.startUs + clipDurationUs(c)),
		),
	);

	const aspect = project.canvas.width >= project.canvas.height ? "16:9" : "9:16";

	return {
		id,
		name,
		aspectRatio: aspect,
		canvas: {
			width: project.canvas.width,
			height: project.canvas.height,
			fps: project.canvas.fps,
			background: "#000000",
		},
		framing: {
			scale: 1,
			offsetX: 0,
			offsetY: 0,
			fitMode: "contain",
		},
		tracks: structuredClone(project.tracks),
		clipTransitions: project.clipTransitions ? structuredClone(project.clipTransitions) : [],
		durationUs,
		createdAt: project.createdAt,
		updatedAt: project.updatedAt,
	};
}

/**
 * Converts a RepurposeArtboard to a StoryComposition.
 */
export function artboardToStory(artboard: RepurposeArtboard, fps = 60): StoryComposition {
	const tracks = artboard.tracks ? structuredClone(artboard.tracks) : [];
	const durationUs = calculateStoryDurationUs(tracks);

	return {
		id: artboard.id.startsWith("story-") ? artboard.id : `story-${artboard.id}`,
		name: artboard.name,
		aspectRatio: artboard.aspectRatio,
		canvas: {
			width: artboard.width,
			height: artboard.height,
			fps,
		},
		framing: structuredClone(artboard.framing),
		tracks,
		clipTransitions: artboard.clipTransitions ? structuredClone(artboard.clipTransitions) : [],
		durationUs,
	};
}

/**
 * Converts a StoryComposition back to a RepurposeArtboard.
 */
export function storyToArtboard(story: StoryComposition): RepurposeArtboard {
	return {
		id: story.id.replace(/^story-/, ""),
		name: story.name,
		aspectRatio: story.aspectRatio,
		width: story.canvas.width,
		height: story.canvas.height,
		framing: story.framing ?? { scale: 1, offsetX: 0, offsetY: 0, fitMode: "cover" },
		tracks: structuredClone(story.tracks),
		clipTransitions: story.clipTransitions ? structuredClone(story.clipTransitions) : [],
	};
}

/**
 * Extracts all stories from a TimelineProject.
 * If project already has explicit stories, returns them.
 * Otherwise, synthesizes stories from root tracks and repurposeBoard artboards.
 */
export function extractStoriesFromProject(project: TimelineProject): StoryComposition[] {
	if (project.stories && project.stories.length > 0) {
		return structuredClone(project.stories);
	}

	const stories: StoryComposition[] = [];

	// 1. Root timeline story
	const mainStory = createDefaultStory(project);
	stories.push(mainStory);

	// 2. Artboard stories
	if (project.repurposeBoard?.artboards) {
		for (const artboard of project.repurposeBoard.artboards) {
			if (artboard.tracks && artboard.tracks.length > 0) {
				stories.push(artboardToStory(artboard, project.canvas.fps));
			}
		}
	}

	return stories;
}

/**
 * Generates manifest items for all stories in a project.
 */
export function generateStoryManifest(stories: StoryComposition[]): StoryManifestItem[] {
	return stories.map((story) => ({
		id: story.id,
		name: story.name,
		file: `Story/${story.id.startsWith("story-") ? story.id : `story-${story.id}`}.json`,
		aspectRatio: story.aspectRatio,
		durationUs: story.durationUs ?? calculateStoryDurationUs(story.tracks),
	}));
}

/**
 * Generates a modern HTML5 + GSAP Hyperframe animation template.
 */
export function createDefaultHyperframeTemplate(
	id: string,
	name: string,
	options: {
		title?: string;
		subtitle?: string;
		badge?: string;
		durationSec?: number;
		width?: number;
		height?: number;
	} = {},
): { html: string; spec: Record<string, unknown> } {
	const title = options.title ?? name;
	const subtitle = options.subtitle ?? "Automated AI Motion Graphic";
	const badge = options.badge ?? "CAPTR HYPERFRAME";
	const durationSec = options.durationSec ?? 5;
	const width = options.width ?? 1920;
	const height = options.height ?? 1080;

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .hyperframe-viewport {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .card {
      position: relative;
      width: 760px;
      padding: 40px 48px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1.5px solid rgba(56, 189, 248, 0.45);
      border-radius: 28px;
      box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.6), 0 0 40px rgba(56, 189, 248, 0.15);
      color: #ffffff;
      opacity: 0;
      transform: translateY(30px) scale(0.92);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .badge {
      display: inline-flex;
      align-self: flex-start;
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      color: #030712;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 6px 16px;
      border-radius: 9999px;
      box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
    }
    .title {
      font-size: 42px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.02em;
      background: linear-gradient(180deg, #ffffff, #cbd5e1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 20px;
      font-weight: 500;
      color: #94a3b8;
      line-height: 1.4;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
</head>
<body>
  <div class="hyperframe-viewport">
    <div class="card" id="card">
      <div class="badge">${escapeHtml(badge)}</div>
      <h1 class="title">${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
    </div>
  </div>

  <script>
    const tl = gsap.timeline({ paused: true });
    
    // Entrance: Spring bounce
    tl.to("#card", {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.65,
      ease: "back.out(1.6)"
    })
    // Exit: Graceful blur fade-out
    .to("#card", {
      opacity: 0,
      y: -20,
      scale: 0.96,
      duration: 0.45,
      ease: "power2.in"
    }, ${Math.max(0.5, durationSec - 0.5)});

    // Programmatic Render Driver API
    window.seekFrame = function(timeInSeconds) {
      tl.seek(Math.max(0, Math.min(${durationSec}, timeInSeconds)));
    };

    window.getDuration = function() {
      return ${durationSec};
    };
  </script>
</body>
</html>`;

	const spec = {
		id,
		name,
		type: "kinetic-card",
		version: 1,
		dimensions: { width, height },
		durationSec,
		props: { title, subtitle, badge },
	};

	return { html, spec };
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Validates a StoryComposition object.
 */
export function validateStoryComposition(value: unknown): StoryComposition {
	if (!value || typeof value !== "object") {
		throw new Error("Invalid story: must be an object");
	}
	const s = value as Partial<StoryComposition>;
	if (typeof s.id !== "string" || !s.id.trim()) throw new Error("Story must have a valid id");
	if (typeof s.name !== "string" || !s.name.trim()) throw new Error("Story must have a valid name");
	if (!s.canvas || typeof s.canvas !== "object") throw new Error("Story canvas is required");
	if (
		typeof s.canvas.width !== "number" ||
		s.canvas.width <= 0 ||
		typeof s.canvas.height !== "number" ||
		s.canvas.height <= 0
	) {
		throw new Error("Invalid story canvas dimensions");
	}
	if (!Array.isArray(s.tracks)) throw new Error("Story tracks must be an array");

	return value as StoryComposition;
}

/**
 * Validates a HyperframeComposition object.
 */
export function validateHyperframeComposition(value: unknown): HyperframeComposition {
	if (!value || typeof value !== "object") {
		throw new Error("Invalid hyperframe: must be an object");
	}
	const h = value as Partial<HyperframeComposition>;
	if (typeof h.id !== "string" || !h.id.trim()) throw new Error("Hyperframe must have a valid id");
	if (typeof h.name !== "string" || !h.name.trim())
		throw new Error("Hyperframe must have a valid name");
	if (typeof h.entryHtml !== "string" || !h.entryHtml.trim())
		throw new Error("Hyperframe entryHtml is required");
	if (typeof h.durationUs !== "number" || h.durationUs <= 0)
		throw new Error("Hyperframe durationUs must be positive");
	if (
		typeof h.width !== "number" ||
		h.width <= 0 ||
		typeof h.height !== "number" ||
		h.height <= 0
	) {
		throw new Error("Invalid hyperframe dimensions");
	}

	return value as HyperframeComposition;
}
