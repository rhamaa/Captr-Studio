import { useState } from "react";
import { ColorPicker } from "@/components/ui/color-picker";
import { HelpPopover } from "@/components/ui/help-popover";
import type { StoryCaptionSegment, StorySubtitleSettings } from "@/core/story/storyTypes";
import type { ProjectCommand } from "@/core/timeline/history";
import {
	setStoryCaptionTime,
	generateStoryCaptions,
	projectCaptionSegments,
	updateStoryCaptions,
} from "@/core/timeline/storyCaptions";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import type { TimelineProject } from "@/core/timeline/types";

export function StoryCaptionPanel({
	project,
	transcripts,
	playheadUs,
	onCommand,
	onSeek,
	onClose,
}: {
	project: TimelineProject;
	transcripts: Record<string, AssetTranscript>;
	playheadUs: number;
	onCommand: (command: ProjectCommand) => void;
	onSeek: (time: number) => void;
	onClose: () => void;
}) {
	const [error, setError] = useState("");
	const settings = project.subtitles ?? { enabled: true, segments: [] };
	const cues = settings.segments ?? [];
	const mapped = projectCaptionSegments({
		...project,
		subtitles: { ...settings, enabled: true },
	});
	const run = (command: ProjectCommand) => {
		try {
			onCommand(command);
			setError("");
		} catch (e) {
			setError(String(e));
		}
	};
	const update = (patch: Partial<StorySubtitleSettings>) =>
		run((p) => updateStoryCaptions(p, { ...settings, ...patch }));
	const edit = (id: number, patch: Partial<StoryCaptionSegment>) =>
		update({ segments: cues.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
	const timing = (cue: StoryCaptionSegment, key: "startUs" | "endUs", raw: string) => {
		run(p=>setStoryCaptionTime(p,cue.id,key,Math.round(Number(raw)*1_000_000)));
	};
	return (
		<aside className="project-inspector story-caption-panel" aria-label="Caption editor">
			<header className="project-panel-header">
				<h2>Captions</h2>
				<button type="button" onClick={onClose} aria-label="Close captions">
					×
				</button>
			</header>
			<div className="project-inspector-content">
				<label>
					<input
						type="checkbox"
						checked={settings.enabled}
						onChange={(e) => update({ enabled: e.target.checked })}
					/>{" "}
					Enable captions in preview and export
				</label>
				<div className="story-edit-actions">
					<button
						type="button"
						disabled={!Object.keys(transcripts).length}
						onClick={() => run((p) => generateStoryCaptions(p, transcripts))}
					>
						Generate from transcripts
					</button>
					<button
						type="button"
						onClick={() =>
							update({
								segments: [
									...cues,
									{
										id: Math.max(-1, ...cues.map((c) => c.id)) + 1,
										text: "Caption",
										startUs: playheadUs,
										endUs: playheadUs + 1_000_000,
										words: [],
									},
								],
							})
						}
					>
						Add caption
					</button>
					{!Object.keys(transcripts).length && <HelpPopover label="Caption help">Transcribe a source in Assets, or add captions manually.</HelpPopover>}
				</div>
				<label>
					Position
					<select
						value={settings.position ?? "bottom"}
						onChange={(e) =>
							update({
								position: e.target.value as StorySubtitleSettings["position"],
							})
						}
					>
						{["top", "center", "bottom"].map((p) => (
							<option key={p}>{p}</option>
						))}
					</select>
				</label>
				<label>
					Font size
					<input
						type="number"
						min={1}
						max={512}
						value={settings.fontSize ?? Math.round(project.canvas.height * 0.045)}
						onChange={(e) => update({ fontSize: e.target.valueAsNumber })}
					/>
				</label>
				<ColorPicker
					label="Caption text color"
					value={settings.primaryColor ?? "#FFFFFF"}
					onChange={(primaryColor) => update({ primaryColor })}
				/>
				<ColorPicker
					label="Caption highlight color"
					value={settings.secondaryColor ?? "#8DDB9B"}
					onChange={(secondaryColor) => update({ secondaryColor })}
				/>
				<ColorPicker
					label="Caption background"
					value={settings.backgroundColor ?? "#000000"}
					onChange={(backgroundColor) => update({ backgroundColor })}
				/>
				<label>
					<input
						type="checkbox"
						checked={settings.highlightWords ?? false}
						onChange={(e) => update({ highlightWords: e.target.checked })}
					/>{" "}
					Highlight active word
				</label>
				{error && <p role="alert">{error}</p>}
				{cues.map((cue) => {
					const parts = mapped.filter((m) => m.id === cue.id),
						a = parts[0]?.startUs ?? cue.startUs,
						b = parts.at(-1)?.endUs ?? cue.endUs;
					return (
						<fieldset key={cue.id} className="story-caption-cue">
							<legend>
								<button type="button" onClick={() => onSeek(a)}>
									Caption {cue.id + 1}
								</button>
							</legend>
							<textarea
								aria-label={`Caption ${cue.id + 1} text`}
								key={cue.text}
								defaultValue={cue.text}
								onBlur={(e) => {
									if (e.target.value !== cue.text)
										edit(cue.id, { text: e.target.value, words: [] });
								}}
							/>
							<div className="story-edit-actions">
								{(["startUs", "endUs"] as const).map((key, i) => (
									<label key={`${key}-${i ? b : a}`}>
										{i ? "End" : "Start"} (s)
										<input
											type="number"
											min={0}
											step={0.01}
											defaultValue={(i ? b : a) / 1_000_000}
											onBlur={(e) => timing(cue, key, e.target.value)}
										/>
									</label>
								))}
							</div>
							<details>
								<summary>Words ({cue.words.length})</summary>
								{cue.words.map((word, i) => (
									<label key={i}>
										Word {i + 1}
										<input
											defaultValue={word.word}
											key={word.word}
											onBlur={(e) => {
												const words = cue.words.map((w, j) =>
													j === i ? { ...w, word: e.target.value } : w,
												);
												edit(cue.id, {
													words,
													text: words.map((w) => w.word.trim()).join(" "),
												});
											}}
										/>
									</label>
								))}
							</details>
							<button
								type="button"
								onClick={() =>
									update({ segments: cues.filter((c) => c.id !== cue.id) })
								}
							>
								Delete caption
							</button>
						</fieldset>
					);
				})}
			</div>
		</aside>
	);
}
