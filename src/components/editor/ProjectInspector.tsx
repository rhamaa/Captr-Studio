import {
	ArrowCounterClockwise,
	Diamond,
	Plus,
	SlidersHorizontal,
	SpeakerHigh,
	SpeakerSimpleX,
	Trash,
	VideoCamera,
} from "@phosphor-icons/react";
import { resolveClipSource } from "@/core/timeline/clipSource";
import { extendInlineClip } from "@/core/timeline/designTemplateCommands";
import type { KeyframeEasing, KeyframeProperty } from "@/components/video-editor/types";
import {
	addClipKeyframe,
	moveClip,
	removeClipKeyframe,
	resetClipTransform,
	setClipRate,
	trimClip,
	updateClip,
	updateClipKeyframe,
	updateTextOverlay,
} from "@/core/timeline/commands";
import {
	getMaxClipTransitionDurationUs,
	removeClipTransition,
	setComponentAnimation,
	updateClipTransition,
} from "@/core/timeline/clipTransitions";
import { setShapeStyleOverride } from "@/core/timeline/shapeCommands";
import type { ProjectCommand } from "@/core/timeline/history";
import { clipDurationUs, type ClipTransition, type ClipTransitionPreset, type ComponentAnimation, type ShapeStyle, type TimelineProject } from "@/core/timeline/types";
import { CanvasProjectInspector } from "./CanvasProjectInspector";
import { useProjectMessages } from "./useProjectMessages";

type Direction = "left" | "right" | "up" | "down";

export function transitionPresetFromControl(
	value: string,
	direction: Direction = "left",
): ClipTransitionPreset {
	if (value === "fade-through-black") return { kind: "fade-through", color: "black" };
	if (value === "fade-through-white") return { kind: "fade-through", color: "white" };
	if (value === "wipe") return { kind: "wipe", direction };
	if (value === "push") return { kind: "push", direction };
	return { kind: "cross-dissolve" };
}

export function transitionPresetControlValue(preset: ClipTransitionPreset) {
	if (preset.kind === "fade-through") return `fade-through-${preset.color}`;
	return preset.kind;
}

export function componentAnimationDurationLimitUs(clipDuration: number, otherDuration: number) {
	return Math.max(0, Math.min(2_000_000, clipDuration - otherDuration));
}

export function defaultComponentAnimationDurationUs(clipDuration: number, otherDuration: number) {
	return Math.min(300_000, componentAnimationDurationLimitUs(clipDuration, otherDuration));
}

function TransitionInspector({
	transition,
	maximumDurationUs,
	locked,
	fromName,
	toName,
	onCommand,
}: {
	transition: ClipTransition;
	maximumDurationUs: number;
	locked: boolean;
	fromName: string;
	toName: string;
	onCommand: (command: ProjectCommand) => void;
}) {
	const m = useProjectMessages();
	const maxDurationMs = maximumDurationUs === Number.MAX_SAFE_INTEGER ? undefined : maximumDurationUs / 1000;
	return (
		<fieldset disabled={locked} className="project-transition-inspector">
			<div className="project-inspector-title">
				<strong>{fromName} → {toName}</strong>
				<span>{m("transition")}</span>
			</div>
			<label>
				{m("transitionPreset")}
				<select aria-label={m("transitionPreset")} value={transitionPresetControlValue(transition.preset)} onChange={(event) => {
					const direction = transition.preset.kind === "wipe" || transition.preset.kind === "push" ? transition.preset.direction : "left";
					onCommand((p) => updateClipTransition(p, transition.id, { preset: transitionPresetFromControl(event.target.value, direction) }));
				}}>
					<option value="cross-dissolve">{m("transitionCrossDissolve")}</option>
					<option value="fade-through-black">{m("transitionFadeThroughBlack")}</option>
					<option value="fade-through-white">{m("transitionFadeThroughWhite")}</option>
					<option value="wipe">{m("transitionWipe")}</option>
					<option value="push">{m("transitionPush")}</option>
				</select>
			</label>
			{(transition.preset.kind === "wipe" || transition.preset.kind === "push") && (
				<label>
					{m("transitionDirection")}
					<select aria-label={m("transitionDirection")} value={transition.preset.direction} onChange={(event) => {
						const direction = event.target.value as Direction;
						const kind = transition.preset.kind as "wipe" | "push";
						onCommand((p) => updateClipTransition(p, transition.id, { preset: { kind, direction } }));
					}}>
						{(["left", "right", "up", "down"] as const).map((direction) => <option key={direction} value={direction}>{m(direction)}</option>)}
					</select>
				</label>
			)}
			{transition.preset.kind === "fade-through" && (
				<label>
					{m("transitionColor")}
					<select aria-label={m("transitionColor")} value={transition.preset.color} onChange={(event) => onCommand((p) => updateClipTransition(p, transition.id, { preset: { kind: "fade-through", color: event.target.value as "black" | "white" } }))}>
						<option value="black">{m("black")}</option>
						<option value="white">{m("white")}</option>
					</select>
				</label>
			)}
			<label>
				{m("transitionDuration")}
				<input aria-label={m("transitionDuration")} type="number" min={100} step={50} max={maxDurationMs} disabled={maximumDurationUs < 100_000} value={maximumDurationUs < 100_000 ? 0 : Math.min(transition.durationUs, maximumDurationUs) / 1000} onChange={(event) => {
					const durationUs = Math.max(100_000, Math.min(maximumDurationUs, Math.round(Number(event.target.value) * 1000)));
					onCommand((p) => updateClipTransition(p, transition.id, { durationUs }));
				}} />
				<span>ms</span>
			</label>
			<div className="project-transition-maximum"><span>{m("maximumTransitionDuration")}</span><strong>{maximumDurationUs === Number.MAX_SAFE_INTEGER ? m("unlimited") : `${(maximumDurationUs / 1_000_000).toFixed(2)}s`}</strong></div>
			<label>
				{m("transitionEasing")}
				<select aria-label={m("transitionEasing")} value={transition.easing} onChange={(event) => onCommand((p) => updateClipTransition(p, transition.id, { easing: event.target.value as ClipTransition["easing"] }))}>
					<option value="linear">{m("linear")}</option>
					<option value="ease-in">{m("easeIn")}</option>
					<option value="ease-out">{m("easeOut")}</option>
					<option value="ease-in-out">{m("easeInOut")}</option>
				</select>
			</label>
			<button type="button" className="project-transition-remove" aria-label={m("removeTransition")} onClick={() => onCommand((p) => removeClipTransition(p, transition.id))}>{m("removeTransition")}</button>
		</fieldset>
	);
}

/** The numeric Out control is an explicit extension; trim gestures stay within extent. */
export function setInspectorClipSourceOut(
	project: TimelineProject,
	clipId: string,
	sourceOutUs: number,
): TimelineProject {
	const clip = project.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
	if (!clip) throw new Error("Clip not found in this Story");
	return clip.content && sourceOutUs > clip.content.durationUs
		? extendInlineClip(project, clipId, sourceOutUs)
		: trimClip(project, clipId, clip.sourceInUs, sourceOutUs);
}

export function ProjectInspector({
	project,
	selection,
	playheadUs = 0,
	onCommand,
	onOpenRecording,
	selectedTransitionId = null,
}: {
	project: TimelineProject;
	selection: string[];
	playheadUs?: number;
	onCommand: (command: ProjectCommand) => void;
	onOpenRecording: (id: string) => void;
	selectedTransitionId?: string | null;
}) {
	const m = useProjectMessages();
	const track = project.tracks.find((t) => t.clips.some((c) => selection.includes(c.id))),
		clip = track?.clips.find((c) => selection.includes(c.id)),
		asset = clip ? resolveClipSource(project, clip) : undefined;
	const shape = clip?.content?.kind === "shape" ? clip.content.shapeDefinition : asset?.media?.shapeDefinition;
	const text = clip?.content?.kind === "text" ? clip.content.text : (clip?.text ?? asset?.media?.text);
	const selectedTransition = project.clipTransitions?.find((item) => item.id === selectedTransitionId),
		transitionTrack = selectedTransition && project.tracks.find((item) => item.id === selectedTransition.trackId),
		transitionFrom = selectedTransition && project.tracks.flatMap((item) => item.clips).find((item) => item.id === selectedTransition.fromClipId),
		transitionTo = selectedTransition && project.tracks.flatMap((item) => item.clips).find((item) => item.id === selectedTransition.toClipId),
		transitionMaximumUs = selectedTransition
				? getMaxClipTransitionDurationUs(project, selectedTransition.fromClipId, selectedTransition.toClipId, selectedTransition.id)
			: 0;
	const fromAsset = transitionFrom && resolveClipSource(project, transitionFrom),
		toAsset = transitionTo && resolveClipSource(project, transitionTo);
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
	const componentDurationLimit = (edge: "enter" | "exit") => {
		if (!clip) return 0;
		const other = edge === "enter" ? clip.componentAnimation?.exit : clip.componentAnimation?.enter;
		return componentAnimationDurationLimitUs(clipDurationUs(clip), other?.durationUs ?? 0);
	};
	const setAnimation = (edge: "enter" | "exit", value: string) => {
		if (!clip) return;
		if (value === "none") {
			onCommand((p) => setComponentAnimation(p, clip.id, edge, null));
			return;
		}
		const current = clip.componentAnimation?.[edge],
			other = edge === "enter" ? clip.componentAnimation?.exit : clip.componentAnimation?.enter,
			preset = value as ComponentAnimation["preset"],
			animation: ComponentAnimation = {
				preset,
				durationUs: current?.durationUs ?? defaultComponentAnimationDurationUs(clipDurationUs(clip), other?.durationUs ?? 0),
				easing: current?.easing ?? "ease-out",
				...((preset === "slide" || preset === "wipe-reveal") ? { direction: current?.direction ?? "left" } : {}),
			};
		onCommand((p) => setComponentAnimation(p, clip.id, edge, animation));
	};
	const setAnimationDuration = (edge: "enter" | "exit", rawMs: string) => {
		if (!clip) return;
		const current = clip.componentAnimation?.[edge];
		if (!current) return;
		const limit = componentDurationLimit(edge),
			durationUs = Math.max(Math.min(50_000, limit), Math.min(limit, Math.round(Number(rawMs) * 1000)));
		onCommand((p) => setComponentAnimation(p, clip.id, edge, { ...current, durationUs }));
	};
	const setAnimationDirection = (edge: "enter" | "exit", direction: Direction) => {
		if (!clip) return;
		const current = clip.componentAnimation?.[edge];
		if (!current) return;
		onCommand((p) => setComponentAnimation(p, clip.id, edge, { ...current, direction }));
	};
	return (
		<aside className="project-inspector" aria-label={selectedTransition ? m("transitionInspector") : m("clipInspector")}>
			<header className="project-panel-header">
				<h2>{selectedTransition ? m("transition") : m("inspector")}</h2>
				{selection.length > 1 && (
					<span className="project-multi-select-badge">{selection.length} selected</span>
				)}
				<SlidersHorizontal size={18} />
			</header>
			{selectedTransition && transitionTrack && transitionFrom && transitionTo ? (
				<TransitionInspector
					transition={selectedTransition}
					maximumDurationUs={transitionMaximumUs}
					locked={transitionTrack.locked}
					fromName={fromAsset?.name ?? m("clip")}
					toName={toAsset?.name ?? m("clip")}
					onCommand={onCommand}
				/>
			) : !clip || !asset || !track ? (
				<CanvasProjectInspector project={project} onCommand={onCommand} />
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
									value={text?.content ?? ""}
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
									value={text?.fontFamily ?? "Arial"}
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
									value={text?.fontSizePx ?? 96}
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
									value={text?.color ?? "#ffffff"}
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
									value={text?.align ?? "center"}
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
									setInspectorClipSourceOut(
										p,
										clip.id,
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
							{[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
								<option key={rate} value={rate}>
									{rate}×
								</option>
							))}
						</select>
					</label>
					<label>
						Volume
						<div className="flex items-center gap-2 w-full mt-1">
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
								className="flex-1"
							/>
							<button
								type="button"
								className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/80 transition-colors cursor-pointer"
								title={clip.gain === 0 ? "Unmute" : "Mute"}
								onClick={() =>
									onCommand((p) =>
										updateClip(p, clip.id, { gain: clip.gain === 0 ? 1 : 0 }),
									)
								}
							>
								{clip.gain === 0 ? (
									<SpeakerSimpleX size={14} className="text-red-400" />
								) : (
									<SpeakerHigh size={14} />
								)}
							</button>
						</div>
						<span>{Math.round(clip.gain * 100)}%</span>
					</label>
					{asset.kind !== "audio" && (
						<>
							{asset.kind === "shape" && shape && (() => {
								const base = shape!.style;
								const defaultStyle: ShapeStyle = { fill: "fill" in base ? base.fill : null, stroke: base.stroke };
								const style = clip.shapeStyleOverride ?? defaultStyle;
								return (
									<div className="project-shape-style">
										<h3>{m("shapeStyle")}</h3>
										{shape!.kind !== "line" && shape!.kind !== "arrow" && (
											<label>{m("shapeFill")}<input aria-label={m("shapeFill")} type="color" value={style.fill ?? "#6387ff"} onChange={(event) => onCommand((p) => setShapeStyleOverride(p, clip.id, { ...style, fill: event.target.value }))} /></label>
										)}
										<label>{m("shapeStroke")}<input aria-label={m("shapeStroke")} type="color" value={style.stroke?.color ?? "#ffffff"} onChange={(event) => onCommand((p) => setShapeStyleOverride(p, clip.id, { ...style, stroke: { color: event.target.value, width: style.stroke?.width ?? 4 } }))} /></label>
										<label>{m("shapeStrokeWidth")}<input aria-label={m("shapeStrokeWidth")} type="number" min={0} max={64} step={1} value={style.stroke?.width ?? 0} onChange={(event) => onCommand((p) => setShapeStyleOverride(p, clip.id, { ...style, stroke: Number(event.target.value) > 0 ? { color: style.stroke?.color ?? "#ffffff", width: Number(event.target.value) } : null }))} /></label>
									</div>
								);
							})()}
							<div className="project-component-animations">
								<h3>{m("componentAnimations")}</h3>
								{(["enter", "exit"] as const).map((edge) => {
									const current = clip.componentAnimation?.[edge];
									const other = edge === "enter" ? clip.componentAnimation?.exit : clip.componentAnimation?.enter;
									const limit = componentDurationLimit(edge);
									const label = edge === "enter" ? m("enterAnimation") : m("exitAnimation");
									const durationLabel = edge === "enter" ? m("enterAnimationDuration") : m("exitAnimationDuration");
									return (
										<div className="project-component-animation-row" key={edge}>
											<label>{label}<select aria-label={label} value={current?.preset ?? "none"} disabled={!current && limit <= 0} onChange={(event) => setAnimation(edge, event.target.value)}>
												<option value="none">{m("animationNone")}</option>
												<option value="fade">{m("animationFade")}</option>
												<option value="slide">{m("animationSlide")}</option>
												<option value="scale-pop">{m("animationScalePop")}</option>
												<option value="wipe-reveal">{m("animationWipeReveal")}</option>
											</select></label>
											{current && <label>{durationLabel}<input aria-label={durationLabel} type="number" min={Math.min(50, limit / 1000)} max={limit / 1000} step={50} disabled={limit <= 0} value={Math.min(current.durationUs, limit) / 1000} onChange={(event) => setAnimationDuration(edge, event.target.value)} /><span>ms</span></label>}
											{current && (current.preset === "slide" || current.preset === "wipe-reveal") && <label>{m("animationDirection")}<select aria-label={`${label} ${m("animationDirection")}`} value={current.direction ?? "left"} onChange={(event) => setAnimationDirection(edge, event.target.value as Direction)}>{(["left", "right", "up", "down"] as const).map((direction) => <option key={direction} value={direction}>{m(direction)}</option>)}</select></label>}
											{other && current && current.durationUs + other.durationUs > clipDurationUs(clip) && <span className="project-muted">{m("animationsCannotOverlap")}</span>}
										</div>
									);
								})}
							</div>
							<div className="flex items-center justify-between mt-2 mb-1">
								<h3 className="m-0">Transform</h3>
								<div className="flex items-center gap-1.5">
									<button
										type="button"
										className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-white/80 hover:text-white border border-white/5 flex items-center gap-1 transition-colors cursor-pointer"
										title="Reset transform to default"
										onClick={() => onCommand((p) => resetClipTransform(p, clip.id))}
									>
										<ArrowCounterClockwise size={11} />
										<span>Reset</span>
									</button>
									<button
										type="button"
										className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-white/80 hover:text-white border border-white/5 flex items-center gap-1 transition-colors cursor-pointer"
										title="Center clip in canvas"
										onClick={() =>
											onCommand((p) =>
												updateClip(p, clip.id, {
													transform: { ...clip.transform, x: 0, y: 0 },
												}),
											)
										}
									>
										<span>Center</span>
									</button>
								</div>
							</div>
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
