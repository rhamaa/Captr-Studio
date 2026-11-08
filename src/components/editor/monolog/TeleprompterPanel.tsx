import { useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { useProjectMessages } from "../useProjectMessages";
import type { MonologPhase } from "./monologDialogController";
import {
	createTeleprompterState,
	TELEPROMPTER_MAX_WPM,
	TELEPROMPTER_MIN_WPM,
	TELEPROMPTER_WPM_STEP,
	teleprompterReducer,
	tickTeleprompter,
} from "./teleprompterModel";

export interface TeleprompterPanelProps {
	/** Script text. Owned by the dialog; never persisted. */
	script: string;
	onScriptChange(script: string): void;
	phase: MonologPhase;
	fontSize: number;
	onFontSizeChange(size: number): void;
	mirrorText: boolean;
	onMirrorTextChange(mirror: boolean): void;
}

type Action =
	| Parameters<typeof teleprompterReducer>[1]
	| { type: "tick"; dtMs: number; metrics: Parameters<typeof tickTeleprompter>[2] };

function reducer(state: ReturnType<typeof createTeleprompterState>, action: Action) {
	return action.type === "tick"
		? tickTeleprompter(state, action.dtMs, action.metrics)
		: teleprompterReducer(state, action);
}

export function TeleprompterPanel(props: TeleprompterPanelProps) {
	const m = useProjectMessages();
	const [scroll, dispatch] = useReducer(reducer, undefined, () => createTeleprompterState());
	const viewportRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const reading = props.phase === "countdown" || props.phase === "recording";

	// Phase drives the scroll: reset on countdown/setup, run while recording, hold on review.
	useLayoutEffect(() => {
		if (props.phase === "countdown" || props.phase === "setup") dispatch({ type: "reset" });
		else if (props.phase === "recording") dispatch({ type: "start" });
		else dispatch({ type: "pause" });
	}, [props.phase]);

	useEffect(() => {
		if (scroll.status !== "running") return;
		let frame = 0;
		let last = performance.now();
		const loop = (time: number) => {
			const content = contentRef.current;
			const viewport = viewportRef.current;
			if (content && viewport) {
				const lineHeightPx = props.fontSize * 1.5;
				const lines = Math.max(1, content.scrollHeight / lineHeightPx);
				const words = props.script.trim().split(/\s+/).filter(Boolean).length;
				dispatch({
					type: "tick",
					dtMs: time - last,
					metrics: {
						wordsPerLine: words / lines,
						lineHeightPx,
						maxOffsetPx: content.scrollHeight,
					},
				});
			}
			last = time;
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	}, [scroll.status, props.fontSize, props.script]);

	// Space and arrows control the scroll while reading; they never reach editor hotkeys.
	useEffect(() => {
		if (!reading) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === " ") dispatch({ type: "toggle" });
			else if (event.key === "ArrowUp") dispatch({ type: "faster" });
			else if (event.key === "ArrowDown") dispatch({ type: "slower" });
			else return;
			event.preventDefault();
			event.stopPropagation();
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [reading]);

	const showReader = props.phase !== "setup";

	return (
		<section className="monolog-teleprompter" aria-label="Teleprompter">
			<div
				ref={viewportRef}
				className={`monolog-teleprompter-viewport ${props.mirrorText ? "mirrored" : ""}`}
				style={{ fontSize: props.fontSize }}
			>
				{showReader ? (
					<>
						<div className="monolog-teleprompter-marker" aria-hidden="true" />
						<div
							ref={contentRef}
							className="monolog-teleprompter-content"
							style={{ transform: `translateY(${-scroll.offsetPx}px)` }}
						>
							{props.script}
						</div>
					</>
				) : (
					<textarea
						className="monolog-teleprompter-input"
						aria-label={m("teleprompterPlaceholder")}
						placeholder={m("teleprompterPlaceholder")}
						value={props.script}
						onChange={(event) => props.onScriptChange(event.currentTarget.value)}
						spellCheck={false}
					/>
				)}
			</div>
			<div className="monolog-teleprompter-controls">
				<label>
					<span>{m("teleprompterSpeed")}</span>
					<input
						type="range"
						min={TELEPROMPTER_MIN_WPM}
						max={TELEPROMPTER_MAX_WPM}
						step={TELEPROMPTER_WPM_STEP}
						value={scroll.wpm}
						onChange={(event) =>
							dispatch({ type: "setWpm", wpm: Number(event.currentTarget.value) })
						}
					/>
					<output>
						{scroll.wpm} {m("wordsPerMinute")}
					</output>
				</label>
				<label>
					<span>{m("teleprompterFontSize")}</span>
					<input
						type="range"
						min={18}
						max={64}
						step={2}
						value={props.fontSize}
						onChange={(event) =>
							props.onFontSizeChange(Number(event.currentTarget.value))
						}
					/>
				</label>
				<label className="monolog-checkbox">
					<input
						type="checkbox"
						checked={props.mirrorText}
						onChange={(event) => props.onMirrorTextChange(event.currentTarget.checked)}
					/>
					<span>{m("teleprompterMirrorText")}</span>
				</label>
				{reading && <span className="monolog-hint">{m("teleprompterHint")}</span>}
			</div>
		</section>
	);
}
