import type { AssetTranscript } from "./transcriptTypes";
import {
	type TimelineClip,
	type TimelineProject,
	clipDurationUs,
	projectDurationUs,
} from "./types";
import { validateTimelineProject } from "./validation";

export interface AgentEditingContext {
	systemPrompt: string;
	userPrompt: string;
	projectJson: string;
	formattedTranscripts: string;
	clipsSummary: string;
	fullContextMarkdown: string;
}

export interface AgentDiffSummary {
	clipsBefore: number;
	clipsAfter: number;
	clipsAdded: string[];
	clipsRemoved: string[];
	clipsModified: string[];
	durationBeforeUs: number;
	durationAfterUs: number;
	durationDeltaUs: number;
}

function formatTimestamp(us: number): string {
	const totalSec = Math.floor(us / 1_000_000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const hundredths = Math.floor((us % 1_000_000) / 10_000);
	return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${hundredths.toString().padStart(2, "0")}`;
}

/**
 * Assembles a comprehensive context document for LLM / CLI agents
 * containing timeline structure, asset library, and aligned speech transcripts.
 */
export function assembleAgentEditingContext(
	project: TimelineProject,
	transcripts: Record<string, AssetTranscript>,
	userPrompt: string,
): AgentEditingContext {
	const projectJson = JSON.stringify(project, null, 2);

	// Format transcripts
	const transcriptLines: string[] = [];
	for (const [assetId, t] of Object.entries(transcripts)) {
		const asset = project.assets.find((a) => a.id === assetId);
		const assetName = asset?.name ?? assetId;
		transcriptLines.push(`### Asset: ${assetName} (ID: ${assetId}, Lang: ${t.language ?? "auto"})`);
		for (const seg of t.segments) {
			const timeRange = `${formatTimestamp(seg.startUs)} - ${formatTimestamp(seg.endUs)}`;
			transcriptLines.push(`- [${timeRange}] "${seg.text}"`);
		}
		transcriptLines.push("");
	}
	const formattedTranscripts = transcriptLines.join("\n").trim() || "No transcripts available.";

	// Format clips summary
	const clipLines: string[] = [];
	for (const track of project.tracks) {
		clipLines.push(`Track ${track.id} (${track.kind}):`);
		for (const clip of track.clips) {
			const asset = project.assets.find((a) => a.id === clip.assetId);
			const start = formatTimestamp(clip.startUs);
			const dur = (clipDurationUs(clip) / 1_000_000).toFixed(2);
			const srcIn = formatTimestamp(clip.sourceInUs);
			const srcOut = formatTimestamp(clip.sourceOutUs);
			clipLines.push(
				`  • Clip ${clip.id} [${asset?.name ?? clip.assetId}]: timeline ${start} (dur ${dur}s), source range ${srcIn} -> ${srcOut}`,
			);
		}
	}
	const clipsSummary = clipLines.join("\n").trim() || "No clips on timeline.";

	const systemPrompt = `You are an AI Video Editor Assistant for Captr Studio.
Your goal is to edit the provided \`TimelineProject\` JSON according to the user instructions.
You can trim clip start/duration, slice clips into multiple segments, reorder clips, or remove unwanted segments.

CRITICAL RULES:
1. Always preserve the JSON schema of TimelineProject. Do not remove required fields.
2. Maintain positive integer microsecond values (startUs, durationUs, sourceInUs, sourceOutUs).
3. Do not create overlapping clips on the same visual track.
4. Keep asset IDs matched to existing assets in the assets list.
5. Return ONLY the updated JSON of the project.`;

	const fullContextMarkdown = `# Captr Studio Project: ${project.title} (ID: ${project.projectId})

## Current Timeline Structure
${clipsSummary}

## Speech Transcripts
${formattedTranscripts}

## User Editing Request
${userPrompt}

## Instructions
Please modify the project JSON to fulfill the user request. Respond with the modified JSON.`;

	return {
		systemPrompt,
		userPrompt,
		projectJson,
		formattedTranscripts,
		clipsSummary,
		fullContextMarkdown,
	};
}

/**
 * Parses and validates raw stdout/string output from an AI agent into a validated TimelineProject.
 */
export function parseAgentProjectOutput(rawOutput: string): {
	success: boolean;
	project?: TimelineProject;
	error?: string;
} {
	if (!rawOutput || !rawOutput.trim()) {
		return { success: false, error: "Agent produced empty output." };
	}

	let jsonStr = rawOutput.replace(/^\uFEFF/, "").trim();

	// Match markdown code block ```json ... ```
	const codeBlockMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(jsonStr);
	if (codeBlockMatch && codeBlockMatch[1]) {
		jsonStr = codeBlockMatch[1].trim();
	} else {
		// Look for first '{' and last '}'
		const firstBrace = jsonStr.indexOf("{");
		const lastBrace = jsonStr.lastIndexOf("}");
		if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
			jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
		}
	}

	try {
		const parsed = JSON.parse(jsonStr);
		const validated = validateTimelineProject(parsed);
		return {
			success: true,
			project: validated,
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			error: `Invalid project JSON from agent: ${msg}`,
		};
	}
}

/**
 * Summarizes the difference between original and edited timeline projects.
 */
export function summarizeProjectDiff(
	before: TimelineProject,
	after: TimelineProject,
): AgentDiffSummary {
	const beforeClips = new Map<string, TimelineClip>();
	for (const track of before.tracks) {
		for (const clip of track.clips) {
			beforeClips.set(clip.id, clip);
		}
	}

	const afterClips = new Map<string, TimelineClip>();
	for (const track of after.tracks) {
		for (const clip of track.clips) {
			afterClips.set(clip.id, clip);
		}
	}

	const clipsAdded: string[] = [];
	const clipsRemoved: string[] = [];
	const clipsModified: string[] = [];

	for (const [id] of afterClips) {
		if (!beforeClips.has(id)) {
			clipsAdded.push(id);
		} else {
			const b = beforeClips.get(id)!;
			const a = afterClips.get(id)!;
			if (
				b.startUs !== a.startUs ||
				b.sourceInUs !== a.sourceInUs ||
				b.sourceOutUs !== a.sourceOutUs ||
				b.rate !== a.rate
			) {
				clipsModified.push(id);
			}
		}
	}

	for (const [id] of beforeClips) {
		if (!afterClips.has(id)) {
			clipsRemoved.push(id);
		}
	}

	const durBefore = projectDurationUs(before);
	const durAfter = projectDurationUs(after);

	return {
		clipsBefore: beforeClips.size,
		clipsAfter: afterClips.size,
		clipsAdded,
		clipsRemoved,
		clipsModified,
		durationBeforeUs: durBefore,
		durationAfterUs: durAfter,
		durationDeltaUs: durAfter - durBefore,
	};
}
