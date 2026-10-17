import { projectCaptionSegments } from "@/core/timeline/storyCaptions";
import type { TimelineProject } from "@/core/timeline/types";

/** Shared by the project renderer for both playback and final export. */
export function drawStoryCaptions(
	ctx: CanvasRenderingContext2D,
	project: TimelineProject,
	timeUs: number,
) {
	const cue = projectCaptionSegments(project).find(
		(c) => timeUs >= c.startUs && timeUs < c.endUs,
	);
	if (!cue) return;
	const s = project.subtitles!,
		{ width, height } = project.canvas,
		size = s.fontSize ?? Math.round(height * 0.045);
	ctx.save();
	ctx.font = `700 ${size}px sans-serif`;
	ctx.textBaseline = "middle";
	ctx.textAlign = "left";
	const tokens = cue.words.length
		? cue.words.map((w) => ({
				text: w.word.trim(),
				active: timeUs >= w.startUs && timeUs < w.endUs,
			}))
		: cue.text
				.trim()
				.split(/\s+/)
				.map((text) => ({ text, active: false }));
	const lines: (typeof tokens)[] = [[]];
	let used = 0;
	const space = ctx.measureText(" ").width,
		maxWidth = width * 0.86;
	for (const token of tokens) {
		const n = ctx.measureText(token.text).width;
		if (used && used + space + n > maxWidth) {
			lines.push([]);
			used = 0;
		}
		lines[lines.length - 1].push(token);
		used += (used ? space : 0) + n;
	}
	const lineHeight = size * 1.35,
		blockHeight = lines.length * lineHeight;
	const top =
		s.position === "top"
			? height * 0.08
			: s.position === "center"
				? (height - blockHeight) / 2
				: height * 0.92 - blockHeight;
	for (const [i, line] of lines.entries()) {
		const text = line.map((t) => t.text).join(" "),
			lineWidth = Math.min(maxWidth, ctx.measureText(text).width);
		const x = (width - lineWidth) / 2,
			y = top + i * lineHeight;
		ctx.fillStyle = s.backgroundColor ?? "#000000B8";
		ctx.fillRect(x - size * 0.3, y, lineWidth + size * 0.6, lineHeight);
		ctx.fillStyle = s.primaryColor ?? "#FFFFFF";
		if (!s.highlightWords || !cue.words.length)
			ctx.fillText(text, x, y + lineHeight / 2, maxWidth);
		else {
			let cursor = x;
			for (const word of line) {
				ctx.fillStyle = word.active
					? (s.secondaryColor ?? "#8DDB9B")
					: (s.primaryColor ?? "#FFFFFF");
				ctx.fillText(word.text, cursor, y + lineHeight / 2, maxWidth);
				cursor += ctx.measureText(word.text).width + space;
			}
		}
	}
	ctx.restore();
}
