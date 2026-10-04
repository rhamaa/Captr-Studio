import { Diamond, Plus, SlidersHorizontal, Trash, VideoCamera } from "@phosphor-icons/react";
import type { KeyframeEasing, KeyframeProperty } from "@/components/video-editor/types";
import {
	addClipKeyframe,
	moveClip,
	removeClipKeyframe,
	setClipRate,
	trimClip,
	updateClip,
	updateClipKeyframe,
	updateTextOverlay,
} from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import { clipDurationUs, type TimelineProject } from "@/core/timeline/types";
export function ProjectInspector({
	project,
	selection,
	playheadUs = 0,
	onCommand,
	onOpenRecording,
}: {
	project: TimelineProject;
	selection: string[];
	playheadUs?: number;
	onCommand: (command: ProjectCommand) => void;
	onOpenRecording: (id: string) => void;
}) {
	const track = project.tracks.find((t) => t.clips.some((c) => selection.includes(c.id))),
		clip = track?.clips.find((c) => selection.includes(c.id)),
		asset = project.assets.find((a) => a.id === clip?.assetId);
	const localMs = clip ? Math.round(Math.max(0, (playheadUs - clip.startUs) / 1000)) : 0;
	const handleAddKeyframe = (property: KeyframeProperty) => {
		if (!clip) return;
		const value =
			property === "position"
				? { x: clip.transform.x, y: clip.transform.y }
				: clip.transform[property];
		onCommand((p) =>
			addClipKeyframe(p, clip.id, {
				id: `kf_${crypto.randomUUID()}`,
				timeMs: localMs,
				property,
				value,
				easing: "ease-in-out",
			}),
		);
	};
	return (
		<aside className="project-inspector" aria-label="Clip inspector">
			<header className="project-panel-header">
				<h2>Inspector</h2>
				{selection.length > 1 && (
					<span className="project-multi-select-badge">{selection.length} selected</span>
				)}
				<SlidersHorizontal size={18} />
			</header>
			{!clip || !asset || !track ? (
				<div className="project-inspector-empty">
					<SlidersHorizontal size={27} />
					<p>Select a clip to edit its properties</p>
				</div>
			) : (
				<fieldset disabled={track.locked}>
					<div className="project-inspector-title">
						<strong>{asset.name}</strong>
						<span>{asset.kind}</span>
					</div>
					{asset.kind === "recording" && (
						<button
							className="project-edit-recording"
							onClick={() => onOpenRecording(clip.id)}
						>
							<VideoCamera size={18} />
							Edit recording effects
						</button>
					)}
					{asset.kind === "text" && (
						<>
							<label className="project-text-content-field">
								Text
								<textarea
									aria-label="Overlay text"
									rows={4}
									maxLength={20000}
									value={(clip.text ?? asset.text)?.content ?? ""}
									onChange={(e) =>
										onCommand((p) =>
											updateTextOverlay(p, clip.id, {
												content: e.target.value,
											}),
										)
									}
								/>
							</label>
							<label>
								Font
								<input
									aria-label="Overlay font family"
									maxLength={120}
									value={(clip.text ?? asset.text)?.fontFamily ?? "Arial"}
									onChange={(e) =>
										onCommand((p) =>
											updateTextOverlay(p, clip.id, {
												fontFamily: e.target.value || "Arial",
											}),
										)
									}
								/>
							</label>
							<label>
								Size
								<input
									aria-label="Overlay font size"
									type="number"
									min={1}
									max={1000}
									step={1}
									value={(clip.text ?? asset.text)?.fontSizePx ?? 96}
									onChange={(e) =>
										onCommand((p) =>
											updateTextOverlay(p, clip.id, {
												fontSizePx: Number(e.target.value),
											}),
										)
									}
								/>
								<span>px</span>
							</label>
							<label>
								Color
								<input
									aria-label="Overlay text color"
									type="color"
									value={(clip.text ?? asset.text)?.color ?? "#ffffff"}
									onChange={(e) =>
										onCommand((p) =>
											updateTextOverlay(p, clip.id, {
												color: e.target.value,
											}),
										)
									}
								/>
							</label>
							<label>
								Align
								<select
									aria-label="Overlay text alignment"
									value={(clip.text ?? asset.text)?.align ?? "center"}
									onChange={(e) =>
										onCommand((p) =>
											updateTextOverlay(p, clip.id, {
												align: e.target.value as
													| "left"
													| "center"
													| "right",
											}),
										)
									}
								>
									<option value="left">Left</option>
									<option value="center">Center</option>
									<option value="right">Right</option>
								</select>
							</label>
						</>
					)}
					<label>
						Start
						<input
							aria-label="Clip start seconds"
							type="number"
							min={0}
							step={0.1}
							value={clip.startUs / 1_000_000}
							onChange={(e) =>
								onCommand((p) =>
									moveClip(
										p,
										clip.id,
										track.id,
										Math.round(Number(e.target.value) * 1_000_000),
									),
								)
							}
						/>
						<span>sec</span>
					</label>
					<label>
						Duration<span>{(clipDurationUs(clip) / 1_000_000).toFixed(2)} sec</span>
					</label>
					<label>
						In
						<input
							aria-label="Clip source in seconds"
							type="number"
							min={0}
							step={0.1}
							value={clip.sourceInUs / 1_000_000}
							onChange={(e) =>
								onCommand((p) =>
									trimClip(
										p,
										clip.id,
										Math.round(Number(e.target.value) * 1_000_000),
										clip.sourceOutUs,
									),
								)
							}
						/>
						<span>sec</span>
					</label>
					<label>
						Out
						<input
							aria-label="Clip source out seconds"
							type="number"
							min={0}
							step={0.1}
							value={clip.sourceOutUs / 1_000_000}
							onChange={(e) =>
								onCommand((p) =>
									trimClip(
										p,
										clip.id,
										clip.sourceInUs,
										Math.round(Number(e.target.value) * 1_000_000),
									),
								)
							}
						/>
						<span>sec</span>
					</label>
					<label>
						Speed
						<select
							aria-label="Clip playback speed"
							value={clip.rate}
							onChange={(e) =>
								onCommand((p) => setClipRate(p, clip.id, Number(e.target.value)))
							}
						>
							{[0.5, 1, 2].map((rate) => (
								<option key={rate} value={rate}>
									{rate}×
								</option>
							))}
						</select>
					</label>
					<label>
						Volume
						<input
							aria-label="Clip volume"
							type="range"
							min={0}
							max={2}
							step={0.01}
							value={clip.gain}
							onChange={(e) =>
								onCommand((p) =>
									updateClip(p, clip.id, { gain: Number(e.target.value) }),
								)
							}
						/>
						<span>{Math.round(clip.gain * 100)}%</span>
					</label>
					{asset.kind !== "audio" && (
						<>
							<h3>Transform</h3>
							{(["x", "y", "scale", "rotation", "opacity"] as const).map((key) => (
								<label key={key}>
									{key.charAt(0).toUpperCase() + key.slice(1)}
									<input
										aria-label={`Clip ${key}`}
										type="number"
										step={key === "scale" || key === "opacity" ? 0.05 : 1}
										value={clip.transform[key]}
										min={
											key === "scale"
												? 0.05
												: key === "opacity"
													? 0
													: undefined
										}
										max={key === "opacity" ? 1 : undefined}
										onChange={(e) =>
											onCommand((p) =>
												updateClip(p, clip.id, {
													transform: {
														...clip.transform,
														[key]: Number(e.target.value),
													},
												}),
											)
										}
									/>
								</label>
							))}
							<div className="project-keyframe-section">
								<div className="project-keyframe-header">
									<h4>
										<Diamond
											size={13}
											weight="fill"
											style={{ color: "#6fa8ff", marginRight: 4 }}
										/>
										Keyframe Engine
									</h4>
									<span className="project-keyframe-time">
										{(localMs / 1000).toFixed(2)}s
									</span>
								</div>
								<div className="project-keyframe-buttons">
									<button
										type="button"
										className="project-kf-btn"
										title="Add position keyframe at playhead"
										onClick={() => handleAddKeyframe("position")}
									>
										<Plus size={11} />
										Pos
									</button>
									<button
										type="button"
										className="project-kf-btn"
										title="Add scale keyframe at playhead"
										onClick={() => handleAddKeyframe("scale")}
									>
										<Plus size={11} />
										Scale
									</button>
									<button
										type="button"
										className="project-kf-btn"
										title="Add rotation keyframe at playhead"
										onClick={() => handleAddKeyframe("rotation")}
									>
										<Plus size={11} />
										Rot
									</button>
									<button
										type="button"
										className="project-kf-btn"
										title="Add opacity keyframe at playhead"
										onClick={() => handleAddKeyframe("opacity")}
									>
										<Plus size={11} />
										Opacity
									</button>
								</div>
								{clip.keyframes && clip.keyframes.length > 0 && (
									<div className="project-keyframe-list">
										<span className="project-kf-list-title">
											Active Keyframes ({clip.keyframes.length})
										</span>
										{clip.keyframes.map((kf) => (
											<div key={kf.id} className="project-kf-row">
												<span className="project-kf-tag">
													{kf.property}
												</span>
												<span className="project-kf-time">
													{(kf.timeMs / 1000).toFixed(2)}s
												</span>
												<select
													aria-label={`${kf.property} keyframe easing`}
													className="project-kf-easing"
													value={kf.easing}
													onChange={(e) =>
														onCommand((p) =>
															updateClipKeyframe(p, clip.id, kf.id, {
																easing: e.target
																	.value as KeyframeEasing,
															}),
														)
													}
												>
													<option value="ease-in-out">ease-in-out</option>
													<option value="linear">linear</option>
													<option value="ease-in">ease-in</option>
													<option value="ease-out">ease-out</option>
													<option value="spring-bounce">
														spring-bounce
													</option>
												</select>
												<button
													type="button"
													aria-label={`Remove ${kf.property} keyframe at ${(kf.timeMs / 1000).toFixed(2)}s`}
													className="project-kf-delete"
													title="Remove keyframe"
													onClick={() =>
														onCommand((p) =>
															removeClipKeyframe(p, clip.id, kf.id),
														)
													}
												>
													<Trash size={12} />
												</button>
											</div>
										))}
									</div>
								)}
							</div>
						</>
					)}
					{track.locked && (
						<p className="project-muted">Unlock the track to edit this clip</p>
					)}
				</fieldset>
			)}
		</aside>
	);
}
