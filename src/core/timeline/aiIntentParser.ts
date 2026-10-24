import { summarizeProjectDiff, type AgentDiffSummary } from "./agentPayload";
import {
	applyAutoZoomToClicks,
	applyRemoveSilence,
	applySetFrameAppearance,
	applySplitClip,
} from "./agentTools";
import { synthesizeGenerativeFrameStyle } from "./aiStyleSynthesizer";
import { refreshStoryProjections } from "./storyOwnership";
import type { AssetTranscript } from "./transcriptTypes";
import type { TimelineProject } from "./types";
import { validateTimelineProject } from "./validation";

export interface NaturalLanguageAiCommandResult {
	success: boolean;
	project: TimelineProject;
	diff: AgentDiffSummary;
	summary: string;
	error?: string;
}

export interface NaturalLanguageAiCommandOptions {
	transcripts?: Record<string, AssetTranscript>;
	playheadUs?: number;
	compositionId?: string;
	clipId?: string;
	clickTimestampsUs?: number[];
}

/**
 * Natural language intent parser and generative executor.
 * Interprets aesthetic descriptions (styling, colors, borders, themes) and editing commands
 * (silence, zoom, split) directly into validated TimelineProject mutations without disk writes.
 */
export function executeNaturalLanguageAiCommand(
	project: TimelineProject,
	prompt: string,
	options?: NaturalLanguageAiCommandOptions,
): NaturalLanguageAiCommandResult {
	if (!prompt || !prompt.trim()) {
		return {
			success: false,
			project,
			diff: summarizeProjectDiff(project, project),
			summary: "Prompt is empty.",
			error: "Please enter an editing or styling instruction.",
		};
	}

	const lower = prompt.toLowerCase();
	let current = structuredClone(project);
	const summaryNotes: string[] = [];

	// 1. Detect Frame Styling & Visual Appearance intent
	const isStyleIntent =
		lower.includes("style") ||
		lower.includes("gaya") ||
		lower.includes("tema") ||
		lower.includes("theme") ||
		lower.includes("tampilan") ||
		lower.includes("frame") ||
		lower.includes("border") ||
		lower.includes("sudut") ||
		lower.includes("radius") ||
		lower.includes("corner") ||
		lower.includes("warna") ||
		lower.includes("color") ||
		lower.includes("neon") ||
		lower.includes("cyberpunk") ||
		lower.includes("minimalis") ||
		lower.includes("minimal") ||
		lower.includes("glass") ||
		lower.includes("kaca") ||
		lower.includes("brutalism") ||
		lower.includes("retro") ||
		lower.includes("terminal") ||
		lower.includes("matrix") ||
		lower.includes("sunset") ||
		lower.includes("ocean") ||
		lower.includes("pastel") ||
		lower.includes("shadow") ||
		lower.includes("bayangan") ||
		lower.includes("wallpaper");

	if (isStyleIntent) {
		const targetComp =
			(options?.compositionId
				? current.compositions.find((c) => c.id === options.compositionId)
				: null) || current.compositions[0];

		if (targetComp) {
			const synth = synthesizeGenerativeFrameStyle(
				prompt,
				targetComp.settings?.windowAppearance,
			);
			current = applySetFrameAppearance(
				current,
				targetComp.id,
				"window",
				synth.appearance,
			);

			// Apply matching wallpaper if synthesized
			if (synth.wallpaper) {
				const compRef = current.compositions.find((c) => c.id === targetComp.id);
				if (compRef && compRef.settings) {
					compRef.settings.wallpaper = synth.wallpaper;
				}
			}

			summaryNotes.push(synth.explanation);
		}
	}

	// 2. Detect Silence / Pause Removal intent
	const isSilenceIntent =
		lower.includes("silence") ||
		lower.includes("hening") ||
		lower.includes("jeda") ||
		lower.includes("diam") ||
		lower.includes("pause");

	if (isSilenceIntent) {
		let minDurationMs = 800;
		const secMatch = /(\d+(?:\.\d+)?)\s*(?:detik|sec|second)/i.exec(lower);
		if (secMatch) {
			minDurationMs = Math.round(parseFloat(secMatch[1]) * 1000);
		} else {
			const msMatch = /(\d+)\s*ms/i.exec(lower);
			if (msMatch) {
				minDurationMs = parseInt(msMatch[1], 10);
			}
		}

		const res = applyRemoveSilence(current, options?.transcripts ?? {}, { minDurationMs });
		current = res.project;
		summaryNotes.push(`Cut speech pauses and silence gaps > ${minDurationMs}ms.`);
	}

	// 3. Detect Auto-Zoom / Click Zoom intent
	const isZoomIntent =
		lower.includes("zoom") ||
		lower.includes("klik") ||
		lower.includes("click");

	if (isZoomIntent) {
		let zoomScale = 1.35;
		const scaleMatch = /(\d+(?:\.\d+)?)\s*x/i.exec(lower);
		if (scaleMatch) {
			zoomScale = parseFloat(scaleMatch[1]);
		}

		// Find target clip
		const targetClip =
			(options?.clipId
				? current.tracks.flatMap((t) => t.clips).find((c) => c.id === options.clipId)
				: null) || current.tracks.find((t) => t.kind === "visual")?.clips[0];

		if (targetClip) {
			const clicks =
				options?.clickTimestampsUs ?? [1_500_000, 3_500_000, 6_000_000];
			current = applyAutoZoomToClicks(current, targetClip.id, clicks, {
				zoomScale,
				durationUs: 400_000,
			});
			summaryNotes.push(`Applied auto-zoom (${zoomScale}x) around cursor clicks.`);
		}
	}

	// 4. Detect Split Clip intent
	const isSplitIntent =
		(lower.includes("split") || lower.includes("potong") || lower.includes("bagi")) &&
		(lower.includes("playhead") || lower.includes("sini") || lower.includes("here") || lower.includes("posisi"));

	if (isSplitIntent && options?.playheadUs !== undefined) {
		const targetClip = current.tracks
			.flatMap((t) => t.clips)
			.find(
				(c) =>
					options.playheadUs! >= c.startUs &&
					options.playheadUs! <= c.startUs + (c.sourceOutUs - c.sourceInUs),
			);
		if (targetClip) {
			const res = applySplitClip(current, targetClip.id, options.playheadUs);
			current = res.project;
			summaryNotes.push(`Split clip ${targetClip.id} at ${(options.playheadUs / 1_000_000).toFixed(2)}s.`);
		}
	}

	// Fallback if no specific keyword matched
	if (summaryNotes.length === 0) {
		// Default to generative style synthesis
		const targetComp = current.compositions[0];
		if (targetComp) {
			const synth = synthesizeGenerativeFrameStyle(
				prompt,
				targetComp.settings?.windowAppearance,
			);
			current = applySetFrameAppearance(
				current,
				targetComp.id,
				"window",
				synth.appearance,
			);
			if (synth.wallpaper && targetComp.settings) {
				targetComp.settings.wallpaper = synth.wallpaper;
			}
			summaryNotes.push(synth.explanation);
		}
	}

	const validated = validateTimelineProject(refreshStoryProjections(current));
	const diff = summarizeProjectDiff(project, validated);

	return {
		success: true,
		project: validated,
		diff,
		summary: summaryNotes.join(" "),
	};
}
